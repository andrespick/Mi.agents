#!/usr/bin/env python3
"""Offline, value-redacting publication checks. Uses only Python's standard library."""
import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys


PATTERNS = {
    'provider-api-key': r'\b(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{30,}|(?:sk|rk)_live_[A-Za-z0-9]{16,})',
    'github-token': r'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})',
    'aws-access-key': r'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b',
    'slack-token': r'\bxox[baprs]-[A-Za-z0-9-]{15,}',
    'private-key': r'-----BEGIN (?:RSA |OPENSSH |EC |DSA |ENCRYPTED )?PRIVATE KEY-----',
    'jwt': r'\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}',
    'live-credential-id': r'\bcred_[A-Za-z0-9_-]{16,}',
    'live-session-id': r'\bses_[A-Za-z0-9_-]{16,}',
    'url-credentials': r'https?://[^\s/\"\'<>:@]+:[^\s/\"\'<>@]+@',
    'literal-credential': r'''(?i)(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|authorization|secret)["']?\s*[:=]\s*["'][A-Za-z0-9_+/.=~-]{24,}["']''',
}
EMAIL = re.compile(r'(?<![\w@])[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})')
USER_PATH = re.compile(r'(?:[A-Z]:[\\/]+Users[\\/]+|/Users/|/home/)([^\s\\/`\"\']+)', re.I)
EXAMPLE_USERS = {'user', 'username', 'yourname', 'your-username', 'you', 'example', 'public', 'default', 'runner', '...'}
TEMPLATE = re.compile(r'(?:^\.env(?:\.[^.]+)*\.(?:example|sample|template)$|^(?:credentials|auth|secrets)(?:\.[^.]+)*\.(?:example|sample|template)\.json$)')


def git(root, *args):
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True)
    if result.returncode:
        # stderr may contain credentials in a configured URL: never echo it.
        raise RuntimeError('A local Git read failed; check the repository and Git installation.')
    return result.stdout


def sensitive_path(path):
    parts = PurePosixPath(path.replace('\\', '/')).parts
    name = parts[-1].lower() if parts else ''
    if any(p.lower() in {'.local', '.superpowers', '.swarm', '.ssh', 'node_modules'} for p in parts):
        return True
    if TEMPLATE.fullmatch(name):
        return False
    return (name == '.env' or name.startswith('.env.') or
            bool(re.fullmatch(r'(?:credentials|auth|secrets)(?:\.[^.]+)*\.json', name)) or
            name in {'id_rsa', 'id_ed25519', 'id_ecdsa', '.npmrc', '.pypirc', '.netrc', '_netrc'} or
            name.endswith(('.key', '.pem', '.p12', '.pfx', '.keystore', '.db', '.sqlite', '.sqlite3', '.db-wal', '.db-shm', '.log')))


def scan_text(text):
    findings = set()
    for kind, expression in PATTERNS.items():
        for match in re.finditer(expression, text):
            findings.add((text.count('\n', 0, match.start()) + 1, kind))
    for match in EMAIL.finditer(text):
        domain = match.group(1).lower()
        if not (domain in {'example.com', 'example.org', 'example.net', 'users.noreply.github.com'} or
                domain.endswith(('.example', '.invalid', '.test'))):
            findings.add((text.count('\n', 0, match.start()) + 1, 'personal-email'))
    for match in USER_PATH.finditer(text):
        user = match.group(1)
        if user.rstrip(',;:').lower() not in EXAMPLE_USERS and not user.startswith(('$', '{', '(', '[', '<', '%', '\\', '|', ')')):
            findings.add((text.count('\n', 0, match.start()) + 1, 'personal-user-path'))
    return sorted(findings)


def check(root, all_files=False, check_identity=False):
    if all_files:
        names = git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z')
    else:
        names = git(root, 'diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z')
    paths = sorted(set(p for p in names.decode('utf-8').split('\0') if p))
    issues = []
    for path in paths:
        if sensitive_path(path):
            issues.append((path, 0, 'private-file-name'))
        if all_files:
            file = root / path
            if file.is_symlink():
                data = os.readlink(file).encode('utf-8')
            elif file.is_file():
                data = file.read_bytes()
            else:
                continue
        else:
            # Scan the exact staged blob, even if the working copy was edited later.
            data = git(root, 'show', ':' + path)
        # Binary containers cannot be checked safely by these text heuristics.
        if b'\0' in data:
            issues.append((path, 0, 'binary-needs-review'))
            continue
        for line, kind in scan_text(data.decode('utf-8', errors='replace')):
            issues.append((path, line, kind))
    if check_identity:
        for variable in ('GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT'):
            ident = git(root, 'var', variable).decode('utf-8')
            match = re.search(r'<([^<>]+)>', ident)
            if not match or not match.group(1).lower().endswith('@users.noreply.github.com'):
                issues.append(('<git-identity>', 0, 'use-github-noreply-email'))
    return len(paths), sorted(set(issues))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--all', action='store_true', help='Check current tracked and non-ignored new files.')
    parser.add_argument('--check-identity', action='store_true', help='Require noreply author/committer for a local commit.')
    args = parser.parse_args(argv)
    try:
        count, issues = check(args.root, args.all, args.check_identity)
    except (OSError, RuntimeError):
        print('Publication check could not complete. No credential values are shown.', file=sys.stderr)
        return 2
    for path, line, kind in issues:
        print(f'{json.dumps(path, ensure_ascii=True)}:{line}: {kind}')
    print(f'Publication check: {count} files, {len(issues)} findings. Values are never printed.')
    return 1 if issues else 0


if __name__ == '__main__':
    raise SystemExit(main())
