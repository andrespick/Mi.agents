import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

SOURCE=Path(__file__).resolve().parents[1]
TEST_TEMP=SOURCE/'.local/router-tests'
TEST_TEMP.mkdir(parents=True,exist_ok=True)
tempfile.tempdir=str(TEST_TEMP)
spec=importlib.util.spec_from_file_location('router_setup',SOURCE/'scripts/setup_router.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class RouterSetupTests(unittest.TestCase):
    def test_preserves_unrelated_agents_settings_and_replaces_raw_swarm(self):
        old={'default_agent':'mi-simple','agents':{'own':{'system':'keep'}},'plugins':['custom','opencode-swarm@7.197.1'],'permissions':[{'action':'edit','resource':'*','effect':'deny'}]}
        new=mod.render_config(old,SOURCE)
        self.assertEqual(new['default_agent'],'mi-router')
        self.assertEqual(new['agents']['own'],old['agents']['own'])
        self.assertEqual(new['permissions'],old['permissions'])
        self.assertEqual(new['plugins'][0],'custom')
        self.assertNotIn('opencode-swarm@7.197.1',new['plugins'])
        self.assertEqual(len(new['plugins']),2)
        self.assertEqual(new['agents']['mi-router']['request']['body']['tool_choice']['name'],'router_route')
        self.assertEqual(mod.render_config(new,SOURCE),new)

    def test_agent_collision_rejected(self):
        with self.assertRaises(ValueError): mod.render_config({'agents':{'mi-router':{'system':'mine'}}},SOURCE)

    def test_swarm_settings_keep_qa_and_use_real_parallel_runner(self):
        new=mod.render_swarm({'quiet':True,'agents':{'own':{'model':'mine'}}})
        self.assertTrue(new['quiet'])
        self.assertEqual(new['agents']['own']['model'],'mine')
        self.assertEqual(new['turbo']['strategy'],'lean')
        self.assertFalse(new['turbo_mode'])
        self.assertEqual(new['turbo']['lean']['max_parallel_coders'],3)
        self.assertEqual(new['agents']['coder']['fallback_models'],[])

    def test_backup_restore_exact_and_no_codex_writes(self):
        with tempfile.TemporaryDirectory() as td:
            home=Path(td);config=home/'.config/opencode/opencode.json'
            config.parent.mkdir(parents=True);original=b'{"default_agent":"mi-simple"}\r\n';config.write_bytes(original)
            binding={'openai':'oauth-id','anthropic':'api-id'}
            plan=mod.plan_install(SOURCE,home,binding)
            self.assertFalse(any('.codex' in str(p) for p in plan))
            backup=mod.apply_plan(plan,home/'backups')
            self.assertEqual(json.loads(config.read_text())['default_agent'],'mi-router')
            mod.restore(backup)
            self.assertEqual(config.read_bytes(),original)

    def test_backup_refuses_restore_over_later_user_changes(self):
        with tempfile.TemporaryDirectory() as td:
            dest=Path(td)/'file';dest.write_bytes(b'old')
            backup=mod.apply_plan({dest:b'new'},Path(td)/'backups')
            dest.write_bytes(b'user edits')
            with self.assertRaises(ValueError):mod.restore(backup)

    def test_readiness_waits_for_native_async_plugin_loading(self):
        replies=iter([{'data':[]},{'data':[{'id':'mi-opencode-router','state':{'status':'loading'}}]},{'data':[{'id':'mi-opencode-router','state':{'status':'active'}}]}])
        sleeps=[]
        self.assertTrue(mod.wait_active('test',lambda *a:next(replies),sleeps.append))
        self.assertEqual(len(sleeps),2)

    def test_readiness_never_accepts_a_failed_plugin(self):
        with self.assertRaises(ValueError):mod.wait_active('test',lambda *a:{'data':[{'id':'mi-opencode-router','state':{'status':'failed'}}]},lambda _:None)

if __name__=='__main__':unittest.main()
