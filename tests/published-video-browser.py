"""Verify existing public tabs read a newly published movie, and source-file independence."""
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='published-video-', dir=ROOT / 'work') as temporary:
    folder = Path(temporary)
    password = 'Published-video-test-20261021'
    config = "const{writeFileSync}=require('fs');const{scryptSync}=require('crypto');writeFileSync(process.argv[1],JSON.stringify({origin:'https://saved.example',password:{salt:'test',hash:scryptSync(process.argv[2],'test',32).toString('hex')},feedbackSalt:'test'}));"
    subprocess.run(['node', '-e', config, str(folder / 'config.json'), password], check=True)
    saved = (folder / 'config.json').read_bytes()
    source = folder / '桌面原视频.mp4'
    shutil.copy(ROOT / 'tests/fixtures/h264-aac.mp4', source)
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'

    def start():
        server = subprocess.Popen(['node', 'scripts/start-media-supplement.mjs', '--local', '--no-open'], cwd=ROOT,
                                  env={**os.environ, 'DATA_DIR': str(folder), 'PORT': str(port)}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(100):
            try:
                if urlopen(origin + '/api/health', timeout=1).status == 200:
                    return server
            except OSError:
                time.sleep(.1)
        server.terminate()
        server.wait(timeout=12)
        raise RuntimeError('Browser test server did not start')

    def stop(server):
        server.terminate()
        try:
            server.wait(timeout=12)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait()

    server = start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            context = browser.new_context(viewport={'width': 1280, 'height': 1000})
            public = context.new_page()
            errors = []
            public.on('pageerror', lambda error: errors.append(str(error)))
            public.goto(origin, wait_until='networkidle')
            public.locator('.desktop-tabs').get_by_role('button', name='影像展厅').click()
            expect(public.locator('.film-stage video')).to_have_attribute('src', '/assets/film-01-qiasi-20261019-v2.mp4')
            admin = context.new_page()
            admin.on('pageerror', lambda error: errors.append(str(error)))
            admin.goto(origin + '/admin')
            admin.bring_to_front()
            admin.get_by_label('管理员密码').fill(password)
            admin.get_by_role('button', name='登录管理后台').click()
            admin.get_by_role('button', name='影片与360°', exact=True).click()
            card = admin.locator('.upload-card').filter(has=admin.get_by_text('FILM 01', exact=True))
            card.locator('input[type=file]').set_input_files(str(source))
            preview = card.locator('video')
            preview.wait_for()
            preview.scroll_into_view_if_needed()
            preview.evaluate('(video)=>{video.muted=true;return video.play()}')
            confirmation = card.get_by_role('checkbox')
            expect(confirmation).to_be_enabled(timeout=15000)
            confirmation.check()
            with admin.expect_response(lambda response: 'action=video-complete' in response.url) as completed:
                card.get_by_role('button', name='确认画面正常，上传并替换').click()
            assert completed.value.status == 200, completed.value.text()
            admin.locator('.admin-message').filter(has_text='视频已保存并发布').wait_for()
            expect(public.locator('.film-stage video')).to_have_attribute('src', re.compile('/api/media/videos/'))
            first_url = public.locator('.film-stage video').get_attribute('src')
            source.unlink()
            # Publish again while the old public page remains open, without a browser notification.
            def post(action, payload):
                response = context.request.post(origin + '/api/admin?action=' + action, headers={'Origin': origin, 'Content-Type': 'application/json'}, data=payload)
                assert response.ok, response.text()
                return response.json()
            sample = (ROOT / 'tests/fixtures/h264-aac.mp4').read_bytes()
            job = post('video-begin', {'size': len(sample)})
            params = f'action=video-part&key={job["key"]}&id={job["uploadId"]}&part=1'
            part = context.request.post(origin + '/api/admin?' + params, headers={'Origin': origin, 'Content-Type': 'application/octet-stream'}, data=sample)
            assert part.ok, part.text()
            post('video-complete', {**job, 'slot': 1, 'title': '第二次发布', 'description': '临时验证素材', 'parts': [part.json()]})
            expected = '/api/media/' + job['key']
            assert first_url != expected
            public.bring_to_front()
            # Headless tab activation does not consistently emit an OS focus event.
            public.evaluate("window.dispatchEvent(new Event('focus'))")
            expect(public.locator('.film-stage video')).to_have_attribute('src', expected)
            stop(server)
            server = start()
            public.reload(wait_until='networkidle')
            public.locator('.desktop-tabs').get_by_role('button', name='影像展厅').click()
            player = public.locator('.film-stage video')
            expect(player).to_have_attribute('src', expected)
            player.evaluate('(video)=>{video.muted=true;return video.play()}')
            public.wait_for_timeout(300)
            assert player.evaluate('(video)=>video.videoWidth') == 160
            assert (folder / 'media' / job['key']).is_file()
            connect = context.new_page()
            connect.goto(origin + '/connect')
            expect(connect.get_by_role('link', name='打开展馆主网页')).to_have_attribute('href', origin + '/')
            expect(connect.get_by_role('link', name='打开管理员后台')).to_have_attribute('href', origin + '/admin')
            assert not errors, errors
            browser.close()
        assert (folder / 'config.json').read_bytes() == saved
        print('PASS: old public tab updates after admin upload; focus reads later publication; restart and deleting source file preserve playable upload; HTTP QR/home/admin landing works; config unchanged.')
    finally:
        stop(server)
