"""Integration tests: generated configuration, preservation, rollback and scope."""
import importlib.util
import json
from pathlib import Path
import tempfile
import tomllib
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('setup_agents', ROOT / 'scripts' / 'setup_agents.py')


class SetupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not SPEC or not SPEC.loader or not Path(SPEC.origin).exists():
            raise AssertionError('Shared configuration installer has not been implemented')
        cls.app = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(cls.app)

    def setUp(self):
        temp_root = ROOT / '.local/tests'
        temp_root.mkdir(parents=True, exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(dir=temp_root)
        self.addCleanup(self.tmp.cleanup)
        self.home = Path(self.tmp.name) / 'home with spaces'
        self.home.mkdir()
        self.state = Path(self.tmp.name) / 'state'

    def build(self, **kwargs):
        return self.app.build_plan(ROOT, self.home, **kwargs)

    def apply(self, plan):
        return self.app.apply_plan(plan, self.state)

    def test_dry_plan_never_writes(self):
        plan = self.build()
        self.assertGreater(len(plan), 5)
        self.assertEqual(list(self.home.iterdir()), [])

    def test_preserves_existing_config_and_is_idempotent(self):
        config = self.home / '.codex/config.toml'
        config.parent.mkdir()
        original = '# Personal\nmodel = "my-model"\n[mcp_servers.keep]\ncommand = "my-server"\n'
        config.write_text(original, encoding='utf-8')
        self.apply(self.build())
        text = config.read_text(encoding='utf-8')
        data = tomllib.loads(text)
        self.assertTrue(text.startswith(original))
        self.assertEqual(data['mcp_servers']['keep']['command'], 'my-server')
        self.assertEqual(data['model'], 'my-model')
        self.assertTrue(all(p['before'] == p['after'] for p in self.build()))

    def test_agents_render_native_formats_and_skills(self):
        self.apply(self.build())
        codex = tomllib.loads((self.home / '.codex/agents/cybersecurity.toml').read_text())
        self.assertEqual(codex['name'], 'cybersecurity')
        self.assertIn('security-audit-m', codex['developer_instructions'])
        self.assertEqual(codex['sandbox_mode'], 'workspace-write')
        worker = tomllib.loads((self.home / '.codex/agents/security-auth.toml').read_text())
        self.assertEqual(worker['sandbox_mode'], 'read-only')
        self.assertFalse(worker['agents']['enabled'])
        oc = json.loads((self.home / '.config/opencode/opencode.json').read_text())
        role = oc['agents']['cybersecurity']
        self.assertEqual(role['mode'], 'all')
        perms = {(p['action'], p['resource']): p['effect'] for p in role['permissions']}
        self.assertEqual(perms['subagent', '*'], 'deny')
        self.assertEqual(perms['subagent', 'security-auth'], 'allow')
        self.assertEqual(perms['edit', '*'], 'deny')
        self.assertEqual(perms['edit', 'docs/security/**'], 'allow')
        self.assertIn({'action': 'edit', 'resource': '*', 'effect': 'deny'}, oc['agents']['security-auth']['permissions'])

    def test_existing_custom_agent_collision_is_not_overwritten(self):
        target = self.home / '.codex/agents/cybersecurity.toml'
        target.parent.mkdir(parents=True)
        target.write_text('name = "mine"\n')
        with self.assertRaisesRegex(ValueError, 'existing|Existente|conflict|Conflicto'):
            self.build()
        self.assertEqual(target.read_text(), 'name = "mine"\n')

    def test_project_configuration_does_not_change_global(self):
        project = self.home / 'projects/demo'
        project.mkdir(parents=True)
        plan = self.build(project=project, profile='security')
        self.assertTrue(all(Path(p['path']).is_relative_to(project) for p in plan))
        self.apply(plan)
        self.assertFalse((self.home / '.codex').exists())
        cfg = tomllib.loads((project / '.codex/config.toml').read_text())
        disabled = {p['path'] for p in cfg['skills']['config'] if not p['enabled']}
        self.assertTrue(any('brainstorming' in p for p in disabled))
        self.assertFalse(any('security-audit-m' in p for p in disabled))

    def test_rollback_restores_original_and_removes_only_created_files(self):
        target = self.home / '.codex/AGENTS.md'
        target.parent.mkdir()
        original = b'# Personal\r\nMis preferencias\r\n'
        target.write_bytes(original)
        backup = self.apply(self.build())
        self.app.restore(backup)
        self.assertEqual(target.read_bytes(), original)
        self.assertFalse((self.home / '.config/opencode/opencode.json').exists())

    def test_rollback_refuses_to_overwrite_later_user_edit(self):
        backup = self.apply(self.build())
        target = self.home / '.codex/AGENTS.md'
        target.write_text(target.read_text() + '\nNew personal preference\n')
        with self.assertRaisesRegex(ValueError, 'changed|cambi'):
            self.app.restore(backup)
        self.assertTrue((self.home / '.config/opencode/opencode.json').exists())

    def test_stale_plan_is_rejected_before_any_writes(self):
        plan = self.build()
        target = Path(plan[-1]['path'])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text('user edit')
        with self.assertRaisesRegex(ValueError, 'changed|cambi'):
            self.apply(plan)
        self.assertFalse(Path(plan[0]['path']).exists())

    def test_custom_mcp_is_disabled_except_selected_project(self):
        config = self.home / '.codex/config.toml'
        config.parent.mkdir()
        config.write_text('[mcp_servers.notebook]\ncommand = "nb"\n')
        plan = self.build(managed_mcp=['notebook'])
        self.apply(plan)
        data = tomllib.loads(config.read_text())
        self.assertFalse(data['mcp_servers']['notebook']['enabled'])
        project = self.home / 'demo'
        project.mkdir()
        self.apply(self.build(project=project, profile='development', managed_mcp=['notebook'], enabled_mcp=['notebook']))
        local = tomllib.loads((project / '.codex/config.toml').read_text())
        self.assertTrue(local['mcp_servers']['notebook']['enabled'])

    def test_jsonc_is_rejected_without_modification(self):
        folder = self.home / '.config/opencode'
        folder.mkdir(parents=True)
        text = '{\n// My comments\n"theme": "custom",\n}\n'
        (folder / 'opencode.jsonc').write_text(text)
        with self.assertRaisesRegex(ValueError, 'JSONC|jsonc'):
            self.build()
        self.assertEqual((folder / 'opencode.jsonc').read_text(), text)

    def test_existing_opencode_agent_conflict_is_not_overwritten(self):
        target = self.home / '.config/opencode/opencode.json'
        target.parent.mkdir(parents=True)
        target.write_text(json.dumps({'agents': {'cybersecurity': {'system': 'personal'}}}))
        with self.assertRaisesRegex(ValueError, 'conflict|Conflicto'):
            self.build()

    def test_library_has_portable_names_and_manual_activation(self):
        issues = self.app.validate_library(ROOT)
        self.assertEqual(issues, [])

    def test_opencode_v2_mcp_disabled_and_project_requires_full_definition(self):
        codex = self.home / '.codex/config.toml'
        codex.parent.mkdir()
        codex.write_text('[mcp_servers.notebook]\ncommand = "nb"\n', encoding='utf-8')
        oc = self.home / '.config/opencode/opencode.json'
        oc.parent.mkdir(parents=True)
        server = {'type': 'remote', 'url': 'https://example.invalid/mcp'}
        oc.write_text(json.dumps({'mcp': {'servers': {'notebook': server}}}), encoding='utf-8')
        self.apply(self.build(managed_mcp=['notebook']))
        actual = json.loads(oc.read_text(encoding='utf-8'))['mcp']['servers']['notebook']
        self.assertTrue(actual['disabled'])
        self.assertEqual(actual['url'], server['url'])
        project = self.home / 'demo'
        project.mkdir()
        with self.assertRaisesRegex(ValueError, 'definición completa'):
            self.build(project=project, managed_mcp=['notebook'], enabled_mcp=['notebook'])
        self.assertFalse((project / '.codex').exists())
        (project / 'opencode.json').write_text(json.dumps({'mcp': {'servers': {'notebook': server}}}), encoding='utf-8')
        self.apply(self.build(project=project, managed_mcp=['notebook'], enabled_mcp=['notebook']))
        self.assertFalse(json.loads((project / 'opencode.json').read_text(encoding='utf-8'))['mcp']['servers']['notebook']['disabled'])

    def test_failed_replace_keeps_original_bytes_and_rolls_back_prior_writes(self):
        target = self.home / '.codex/AGENTS.md'
        target.parent.mkdir()
        target.write_bytes(b'Original\r\n')
        plan = self.build()
        real_replace = self.app.os.replace

        def fail_one(source, destination):
            if Path(destination) == target:
                raise OSError('simulated disk error')
            return real_replace(source, destination)

        with patch.object(self.app.os, 'replace', side_effect=fail_one):
            with self.assertRaisesRegex(OSError, 'disk error'):
                self.apply(plan)
        self.assertEqual(target.read_bytes(), b'Original\r\n')
        self.assertFalse((self.home / '.config/opencode/opencode.json').exists())
        self.assertEqual(list(target.parent.glob('.mi-agents-*')), [])

    def test_project_idempotence_and_preset_switch(self):
        project = self.home / 'demo'
        project.mkdir()
        self.apply(self.build(project=project, profile='security'))
        self.assertTrue(all(p['before'] == p['after'] for p in self.build(project=project, profile='security')))
        self.apply(self.build(project=project, profile='development'))
        config = tomllib.loads((project / '.codex/config.toml').read_text(encoding='utf-8'))
        settings = {Path(c['path']).parent.name: c['enabled'] for c in config['skills']['config']}
        self.assertTrue(settings['requirements-engineering-m'])
        self.assertFalse(settings['security-audit-m'])

    def test_parent_link_is_rejected_before_mutation(self):
        target = self.home / 'linked/.codex/AGENTS.md'
        original_stat = self.app.Path.lstat

        def stat_with_reparse(path, *args, **kwargs):
            if path == self.home / 'linked':
                class LinkStat:
                    st_mode = 0
                    st_file_attributes = 0x400
                return LinkStat()
            return original_stat(path, *args, **kwargs)

        with patch.object(self.app.Path, 'lstat', stat_with_reparse):
            with self.assertRaisesRegex(ValueError, 'enlazado'):
                self.app.check_path(target)
        self.assertFalse(target.exists())


if __name__ == '__main__':
    unittest.main()
