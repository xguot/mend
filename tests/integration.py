#!/usr/bin/env python3
"""Exercise the actual Lisp server and MariaDB, using an isolated temporary database."""
import json
import os
from pathlib import Path
import re
import secrets
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent
DB = 'mend_test_' + secrets.token_hex(6)
ENV = os.environ.copy()
if not ENV.get('MEND_DB_USER', '').strip():
    raise SystemExit('Set MEND_DB_USER to your local database username before running tests.')
with socket.socket() as listener:
    listener.bind(('127.0.0.1', 0))
    PORT = listener.getsockname()[1]
ENV.update(MEND_DB_NAME=DB, MEND_PORT=str(PORT))
if ENV.get('MEND_DB_PASSWORD'):
    ENV['MYSQL_PWD'] = ENV['MEND_DB_PASSWORD']
BASE = f'http://localhost:{PORT}'
process = None
log = tempfile.TemporaryFile(mode='w+')
checks = 0

def check(condition, message):
    global checks
    assert condition, message
    checks += 1
    print(f'  PASS {message}', flush=True)

def request(path='/api/requests', method='GET', data=None, token=None, headers=None):
    extra = dict(headers or {})
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode()
        extra['Content-Type'] = 'application/x-www-form-urlencoded'
    if token is not None:
        extra['X-CSRF-Token'] = token
    req = urllib.request.Request(BASE + path, data=body, method=method, headers=extra)
    try:
        response = urllib.request.urlopen(req, timeout=6)
    except urllib.error.HTTPError as error:
        response = error
    raw = response.read().decode()
    return response.status, json.loads(raw) if response.headers.get_content_type() == 'application/json' else raw

def start():
    global process
    process = subprocess.Popen([str(ROOT / 'start.sh')], cwd=ROOT, env=ENV, stdout=log, stderr=log)
    deadline = time.monotonic() + 15
    while time.monotonic() < deadline:
        if process.poll() is not None:
            log.seek(0)
            raise RuntimeError(log.read())
        try:
            code, data = request()
            if code == 200:
                return data
        except (OSError, urllib.error.URLError):
            pass
        time.sleep(.1)
    raise RuntimeError('Server did not start within 15 seconds.')

def stop():
    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()

try:
    print(f'Integration test: isolated database {DB}', flush=True)
    initial = start()
    token = initial['csrf']
    check(initial['requests'] == [], 'Startup creates a clean database and requests table')
    for path, marker in [('/', '<title>Mend'), ('/app.css', ':root'), ('/app.js', "'use strict'"), ('/favicon.svg', '<svg')]:
        code, text = request(path)
        check(code == 200 and marker in text, f'Serves {path}')
    check(request('/not-found')[0] == 404, 'Unknown page returns 404')
    form = dict(requested_date='2024-02-29', room='T1 · Test room', requested_by='Zoë O’Connor',
                description="Repair café light 🔧\nO'Brien's switch. <script>alert('test')</script> '; DROP TABLE requests; --",
                priority='high', status='open')
    check(request(method='POST', data=form)[0] == 403, 'Mutation without CSRF token is rejected')
    check(request(method='POST', data=form, token=token, headers={'Origin': 'https://example.com'})[0] == 403,
          'Cross-origin mutation is rejected')
    check(request(headers={'Host': 'example.com'})[0] == 403, 'Untrusted Host is rejected')
    invalid = dict(form, requested_date='2025-02-29', room='  ', priority='urgent', status='unknown')
    code, error = request(method='POST', data=invalid, token=token)
    check(code == 422 and set(error['errors']) == {'requested_date', 'room', 'priority', 'status'},
          'Server rejects invalid calendar dates, blank fields, and invalid enums')
    check(request(method='POST', data=dict(form, description='x' * 2001), token=token)[0] == 422,
          'Server enforces description length')
    check(request(method='POST', data=dict(form, description='x' * 40000), token=token)[0] == 413,
          'Server rejects oversized request bodies')
    check(request(method='POST', data=form, token=token)[0] == 201, 'Create writes a request to MariaDB')
    rows = request()[1]['requests']
    check(len(rows) == 1 and all(rows[0][key] == value for key, value in form.items()),
          'Unicode, newlines, quotes, HTML, and SQL-like text round-trip unchanged')
    record_id = rows[0]['id']
    edited = dict(form, room='T2', priority='low', status='completed', description='Fixed and verified.')
    check(request(f'/api/requests/{record_id}', 'POST', edited, token)[0] == 200, 'Update succeeds')
    row = request()[1]['requests'][0]
    check(row['id'] == record_id and all(row[key] == value for key, value in edited.items()),
          'Update changes the same record without inserting a duplicate')
    check(request('/api/requests/2147483647', 'POST', edited, token)[0] == 404, 'Updating a missing request returns 404')
    check(request('/api/requests/not-an-id', 'POST', edited, token)[0] == 404, 'Invalid request ID returns 404')
    check(request(f'/api/requests/{record_id}/delete')[0] == 405, 'GET cannot delete a request')
    stop()
    restarted = start()
    check(restarted['requests'] == [row], 'Data persists after restarting the Lisp server')
    check(restarted['csrf'] != token, 'Restart rotates the CSRF token')
    token = restarted['csrf']
    check(request(f'/api/requests/{record_id}/delete', 'POST', token=token)[0] == 200, 'Delete removes the test request')
    check(request()[1]['requests'] == [], 'Deleted request is absent from the database')
    check(request(f'/api/requests/{record_id}/delete', 'POST', token=token)[0] == 404, 'Deleting a missing request returns 404')
    print(f'\n{checks} checks passed.', flush=True)
finally:
    stop()
    # Only the generated test database can be dropped here, never MEND_DB_NAME.
    assert re.fullmatch(r'mend_test_[0-9a-f]{12}', DB)
    subprocess.run([ENV.get('MEND_MYSQL', '/Applications/XAMPP/xamppfiles/bin/mysql'),
        '--protocol=SOCKET', '--socket=' + ENV.get('MEND_DB_SOCKET', '/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock'),
        '--user=' + ENV['MEND_DB_USER'], '--execute=DROP DATABASE IF EXISTS `' + DB + '`;'],
        env=ENV, check=True)
    log.close()
