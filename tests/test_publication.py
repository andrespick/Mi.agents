"""Regression tests for offline publication checks; all secret fixtures are synthetic."""
import importlib.util
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('check_publication', ROOT / 'scripts/check_publication.py')
app = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(app)


class PublicationTests(unittest.TestCase):
    def test_provider_key_and_private_key_are_detected_without_values(self):
        value = 'sk-' + 'x' * 60
        findings = app.scan_text('API_KEY="' + value + '"\n' + '-----BEGIN ' + 'PRIVATE KEY-----')
        self.assertIn((1, 'provider-api-key'), findings)
        self.assertIn((2, 'private-key'), findings)
        self.assertNotIn(value, repr(findings))

    def test_real_ids_and_machine_paths_are_detected(self):
        text = 'ses_' + 'A' * 24 + '\n' + 'C:/Users/' + 'private-owner' + '/project\n'
        self.assertIn((1, 'live-session-id'), app.scan_text(text))
        self.assertIn((2, 'personal-user-path'), app.scan_text(text))

    def test_public_examples_and_noreply_are_allowed(self):
        text = 'user@example.com\nowner@users.noreply.github.com\nC:/Users/<user>/project\n/home/([^/]+)/\n'
        self.assertEqual(app.scan_text(text), [])

    def test_generic_paths_and_the_detector_pattern_do_not_trigger(self):
        text = 'C:/Users/... /c/Users/...,\n' + repr(app.USER_PATH.pattern)
        self.assertEqual(app.scan_text(text), [])

    def test_personal_email_is_detected_without_echoing_address(self):
        address = 'private-owner' + '@' + 'gmail.com'
        findings = app.scan_text(address)
        self.assertEqual(findings, [(1, 'personal-email')])
        self.assertNotIn(address, repr(findings))

    def test_private_paths_and_safe_examples(self):
        for path in ['.env', 'nested/.env.local', 'credentials.json', 'auth.json', 'key.pem', 'id_rsa', '.local/state.json', '.swarm/swarm.db']:
            self.assertTrue(app.sensitive_path(path), path)
        for path in ['.env.example', '.env.local.example', '.env.template', 'credentials.example.json', 'auth.sample.json', 'README.md']:
            self.assertFalse(app.sensitive_path(path), path)

    @unittest.skipUnless(shutil.which('git'), 'Git is required for index integration checks')
    def test_staged_blob_cannot_be_hidden_by_editing_working_copy(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            def git(*args):
                return subprocess.run(['git', '-C', tmp, *args], check=True, capture_output=True)
            git('init', '-q')
            file = root / 'sample.txt'
            file.write_text('sk-' + 'x' * 60, encoding='utf-8')
            git('add', 'sample.txt')
            file.write_text('safe working copy', encoding='utf-8')
            count, issues = app.check(root)
            self.assertEqual(count, 1)
            self.assertIn(('sample.txt', 1, 'provider-api-key'), issues)
            self.assertEqual(app.check(root, all_files=True)[1], [])

    @unittest.skipUnless(shutil.which('git'), 'Git is required for ignore integration checks')
    def test_real_gitignore_excludes_secrets_but_keeps_examples(self):
        with tempfile.TemporaryDirectory() as tmp:
            subprocess.run(['git', '-C', tmp, 'init', '-q'], check=True, capture_output=True)
            (Path(tmp) / '.gitignore').write_bytes((ROOT / '.gitignore').read_bytes())
            for path in ['.env', 'nested/.env.local', 'credentials.json', 'key.pem', '.swarm/swarm.db', 'id_ed25519']:
                result = subprocess.run(['git', '-C', tmp, 'check-ignore', '--no-index', '-q', '--', path])
                self.assertEqual(result.returncode, 0, path)
            for path in ['.env.example', 'nested/.env.test.example', 'credentials.example.json', 'README.md']:
                result = subprocess.run(['git', '-C', tmp, 'check-ignore', '--no-index', '-q', '--', path])
                self.assertEqual(result.returncode, 1, path)


if __name__ == '__main__':
    unittest.main()
