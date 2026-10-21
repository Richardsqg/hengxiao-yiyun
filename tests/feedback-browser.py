"""Check HTTP-style mobile crypto, real feedback storage, and visible failures.

Uses temporary local data and Chromium touch emulation; this is not an iPhone,
Safari, Samsung, or WeChat hardware test. Build the application before running.
"""
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
(ROOT / 'work').mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix='feedback-browser-', dir=ROOT / 'work') as temporary:
    folder = Path(temporary)
    password = secrets.token_hex(24)
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    config_script = "const{writeFileSync}=require('fs');const{scryptSync}=require('crypto');writeFileSync(process.argv[1],JSON.stringify({origin:process.argv[3],password:{salt:'test',hash:scryptSync(process.argv[2],'test',32).toString('hex')},feedbackSalt:'test'}));"
    subprocess.run(['node', '-e', config_script, str(folder / 'config.json'), password, origin], check=True)
    saved_config = (folder / 'config.json').read_bytes()
    server = subprocess.Popen(['node', 'runtime/server.mjs'], cwd=ROOT,
                              env={**os.environ, 'DATA_DIR': str(folder), 'PORT': str(port), 'HOST': '127.0.0.1', 'LOCAL_PREVIEW': '1'},
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                if urlopen(origin + '/api/health', timeout=1).status == 200:
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('Feedback test server did not start')

        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            errors = []

            def mobile_context(no_random_values=False):
                context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                                              has_touch=True, device_scale_factor=1)
                # Loopback is treated as secure by browsers. Reproduce exactly the
                # crypto API availability of a plain-HTTP private-network page.
                context.add_init_script("Object.defineProperty(window.crypto,'randomUUID',{value:undefined,configurable:true});")
                if no_random_values:
                    context.add_init_script("Object.defineProperty(window.crypto,'getRandomValues',{value:undefined,configurable:true});")
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(origin, wait_until='networkidle')
                page.locator('.mobile-tabs').get_by_role('button', name='观展留言', exact=True).click()
                return context, page

            def fill(page, message):
                form = page.locator('.feedback-form')
                form.get_by_role('radio', name='5星', exact=True).click()
                form.get_by_role('button', name='文化寻根', exact=True).click()
                form.get_by_label('留下一点感受，或一个建议。', exact=False).fill(message)
                form.get_by_label('你的称呼', exact=False).fill('浏览器验证')
                form.get_by_role('checkbox').check()
                return form

            def admin_rows(context):
                login = context.request.post(origin + '/api/login', headers={'Origin': origin}, data={'password': password})
                assert login.status == 200, login.text()
                response = context.request.get(origin + '/api/admin')
                assert response.status == 200, response.text()
                return response.json()['rows']

            # The formerly crashing call is absent, and a real submitted message
            # must appear in both the authenticated API and the actual dashboard.
            context, page = mobile_context()
            assert page.evaluate('typeof crypto.randomUUID') == 'undefined'
            assert page.evaluate('typeof crypto.getRandomValues') == 'function'
            message = 'HTTP安全随机数后备：真实提交并在后台核对'
            form = fill(page, message)
            assert context.request.get(origin + '/api/admin').status == 401
            with page.expect_response(lambda response: response.url == origin + '/api/feedback') as posted:
                form.get_by_role('button', name='留下我的回响', exact=False).click()
            assert posted.value.status == 200, posted.value.text()
            expect(page.get_by_text('你的回响，已被珍藏。', exact=True)).to_be_visible()
            rows = admin_rows(context)
            matching = [row for row in rows if row['message'] == message]
            assert len(matching) == 1, rows
            admin = context.new_page()
            admin.on('pageerror', lambda error: errors.append(str(error)))
            admin.goto(origin + '/admin')
            expect(admin.locator('.feedback-table')).to_contain_text(message)
            context.close()
            print('PASS: missing randomUUID → real POST → success → authenticated API and dashboard row')

            # No secure source must produce an actionable alert, preserve input,
            # re-enable the button, and never pretend the message was submitted.
            context, page = mobile_context(no_random_values=True)
            requests = []
            page.on('request', lambda request: requests.append(request.url) if request.url == origin + '/api/feedback' else None)
            message = '缺少安全随机数时仍保留此留言'
            page.locator('.feedback-form').get_by_role('button', name='留下我的回响', exact=False).click()
            expect(page.locator('.feedback-form').get_by_role('alert')).to_contain_text('请完成评分')
            assert not requests, requests
            form = fill(page, message)
            form.get_by_role('button', name='留下我的回响', exact=False).click()
            expect(form.get_by_role('alert')).to_contain_text('缺少安全随机数功能')
            expect(form.locator('textarea')).to_have_value(message)
            expect(form.get_by_role('button', name='留下我的回响', exact=False)).to_be_enabled()
            assert not requests, requests
            assert not page.locator('.success-panel').count()
            context.close()
            print('PASS: missing secure source → Chinese alert, preserved form, no POST or false success')

            # The first request reaches storage but its response is lost. Retry
            # must reuse the same identifier and yield exactly one database row.
            context, page = mobile_context()
            message = '保存成功但响应中断，同标识重试只保留一份'
            form = fill(page, message)
            attempts = []

            def drop_first_ack(route):
                attempts.append(route.request.post_data_json)
                if len(attempts) == 1:
                    response = route.fetch()
                    assert response.status == 200, response.text()
                    route.abort('failed')
                else:
                    route.continue_()

            page.route('**/api/feedback', drop_first_ack)
            page.evaluate("""() => {
                const form=document.querySelector('.feedback-form');
                form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
                form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
            }""")
            expect(form.get_by_role('alert')).to_contain_text('提交结果尚未确认')
            expect(form.locator('textarea')).to_have_value(message)
            expect(form.get_by_role('button', name='留下我的回响', exact=False)).to_be_enabled()
            assert len(attempts) == 1, attempts
            form.get_by_role('button', name='留下我的回响', exact=False).click()
            expect(page.get_by_text('你的回响，已被珍藏。', exact=True)).to_be_visible()
            assert len(attempts) == 2 and attempts[0]['id'] == attempts[1]['id'], attempts
            rows = admin_rows(context)
            assert len([row for row in rows if row['message'] == message]) == 1, rows
            context.close()
            print('PASS: duplicate tap blocked; lost response retry reuses ID; one persisted row')

            # Editing a message after an unknown result is a new submission, not
            # a false success confirmation of the old saved body.
            context, page = mobile_context()
            old_message = '响应未知前保存的原始内容'
            new_message = '未知结果后明确编辑的新内容'
            form = fill(page, old_message)
            attempts = []
            page.route('**/api/feedback', drop_first_ack)
            form.get_by_role('button', name='留下我的回响', exact=False).click()
            expect(form.get_by_role('alert')).to_contain_text('修改内容会作为新反馈提交')
            form.locator('textarea').fill(new_message)
            form.get_by_role('button', name='留下我的回响', exact=False).click()
            expect(page.get_by_text('你的回响，已被珍藏。', exact=True)).to_be_visible()
            assert len(attempts) == 2 and attempts[0]['id'] != attempts[1]['id'], attempts
            rows = admin_rows(context)
            assert len([row for row in rows if row['message'] == old_message]) == 1, rows
            assert len([row for row in rows if row['message'] == new_message]) == 1, rows
            context.close()
            print('PASS: edited retry uses a new ID and the edited body is actually saved')

            # Hold one request long enough to verify edits are disabled while
            # its response is pending, then complete it through the real API.
            context, page = mobile_context()
            form = fill(page, '提交过程中暂时锁定字段，防止旧响应覆盖新输入')
            pending = []
            page.route('**/api/feedback', lambda route: pending.append(route))
            form.get_by_role('button', name='留下我的回响', exact=False).click()
            expect(form.locator('textarea')).to_be_disabled()
            expect(form.get_by_role('radio', name='5星', exact=True)).to_be_disabled()
            expect(form.get_by_role('button', name='文化寻根', exact=True)).to_be_disabled()
            expect(form.get_by_role('checkbox')).to_be_disabled()
            expect(form.get_by_label('你的称呼', exact=False)).to_be_disabled()
            expect(form.get_by_role('button', name='正在提交', exact=False)).to_be_disabled()
            assert len(pending) == 1
            pending[0].continue_()
            expect(page.get_by_text('你的回响，已被珍藏。', exact=True)).to_be_visible()
            context.close()
            print('PASS: pending submission disables edits and completes only after server confirmation')
            assert not errors, errors
            browser.close()
        assert (folder / 'config.json').read_bytes() == saved_config
    finally:
        server.terminate()
        try:
            server.wait(timeout=12)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()

print('Feedback browser checks passed. Chromium touch emulation only; no phone hardware was tested.')
