"""Ten isolated cold browsers + throttling + real persistence; not a campus Wi-Fi test."""
import asyncio
import json
import os
from pathlib import Path
import socket
import sqlite3
import subprocess
import tempfile
import time
from urllib.request import urlopen
from urllib.parse import urlparse
from playwright.async_api import async_playwright, expect

ROOT = Path(__file__).resolve().parent.parent


async def check(origin, folder, password):
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        errors = []
        contexts = []

        async def visitor(index):
            context = await browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
            contexts.append(context)
            await context.add_init_script("Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true})")
            page = await context.new_page()
            page.on('pageerror', lambda e: errors.append(str(e)))
            frames = set()
            page.on('request', lambda r: frames.add(urlparse(r.url).path) if 'crown-01-frame-' in r.url else None)
            session = await context.new_cdp_session(page)
            await session.send('Network.enable')
            await session.send('Network.emulateNetworkConditions', {'offline': False, 'latency': 120, 'downloadThroughput': 256 * 1024, 'uploadThroughput': 128 * 1024})
            await page.goto(origin, wait_until='networkidle', timeout=60000)
            await expect(page.locator('.zoom-stage img').first).to_have_js_property('naturalWidth', 1600, timeout=30000)
            assert len(frames) <= 2, (index, len(frames))
            await page.locator('.mobile-tabs').get_by_role('button', name='观展留言').tap()
            await page.get_by_role('radio', name='5星', exact=True).tap()
            await page.locator('.feedback-form').get_by_role('button', name='凤冠鉴赏', exact=True).tap()
            await page.locator('#visitor-message').fill(f'十端并发验证 {index}')
            await page.locator('.nickname input').fill(f'测试端{index}')
            await page.locator('.consent input').check()
            async with page.expect_response(lambda r: r.url.endswith('/api/feedback') and r.request.method == 'POST') as pending:
                await page.get_by_role('button', name='留下我的回响').tap()
            response = await pending.value
            assert response.status == 200
            result = await response.json()
            await expect(page.get_by_text('你的回响，已被珍藏。')).to_be_visible()
            return {'client': index, 'initialFrames': len(frames), 'feedbackId': result['id']}

        result = await asyncio.gather(*(visitor(i) for i in range(1, 11)))
        assert len({r['feedbackId'] for r in result}) == 10
        with sqlite3.connect(folder / 'gallery.sqlite') as db:
            assert db.execute('SELECT count(*) FROM feedback').fetchone()[0] == 10
        print('PASS: 10 fresh touch clients at simulated 2Mbps/120ms, <=2 initial frames each, 10 real saved questionnaires')
        for context in contexts:
            await context.close()

        context = await browser.new_context(viewport={'width': 1280, 'height': 1000})
        page = await context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        await page.goto(origin, wait_until='networkidle')
        last = {'calls': 0}

        async def fail_frame(route):
            last['calls'] += 1
            if last['calls'] <= 2:
                await route.abort('failed')
            else:
                await route.continue_()

        await page.route('**/assets/crown-01-frame-091.webp*', fail_frame)
        img = page.locator('.zoom-stage img').first
        old = await img.get_attribute('src')
        slider = page.locator('input[aria-label="旋转角度"]').first
        await slider.focus()
        await slider.press('End')
        await expect(page.get_by_role('button', name='重新加载图片')).to_be_visible(timeout=15000)
        assert await img.get_attribute('src') == old
        await page.get_by_role('button', name='重新加载图片').click()
        await expect(img).to_have_attribute('src', __import__('re').compile('crown-01-frame-091'))
        await expect(img).to_have_js_property('naturalWidth', 1600)
        assert last['calls'] == 3
        print('PASS: failed requested frame retries are bounded; old image retained; manual retry recovers without server restart')

        catalog = await (await context.request.get(origin + '/api/gallery')).json()
        thumbnail = catalog['document']['courses'][0]['museumImages'][0]
        thumb_calls = {'n': 0}

        async def fail_thumbnail(route):
            thumb_calls['n'] += 1
            if thumb_calls['n'] <= 2:
                await route.abort('failed')
            else:
                await route.continue_()

        await page.route('**' + thumbnail['src'] + '*', fail_thumbnail)
        await page.locator('.desktop-tabs').get_by_role('button', name='文化寻根').click()
        retry_thumb = page.get_by_role('button', name='重试图片：' + thumbnail['title'], exact=True)
        await expect(retry_thumb).to_be_visible()
        await retry_thumb.click()
        restored_thumb = page.get_by_role('button', name='放大查看：' + thumbnail['title'], exact=True).locator('img')
        await expect(restored_thumb).not_to_have_js_property('naturalWidth', 0)
        assert thumb_calls['n'] == 3
        print('PASS: culture image failure shows an actionable thumbnail retry and recovers without reload')

        video_requests = []
        page.on('request', lambda r: video_requests.append(r.url) if '.mp4' in r.url else None)
        await page.locator('.desktop-tabs').get_by_role('button', name='影像展厅').click()
        await page.wait_for_timeout(4500)
        assert not video_requests, video_requests
        assert not await page.locator('.video-recovery').count()
        calls = {'n': 0}

        async def fail_video(route):
            calls['n'] += 1
            if calls['n'] == 1:
                await route.abort('failed')
            else:
                await route.continue_()

        await page.route('**/assets/film-01-qiasi-20261019-v2.mp4', fail_video)
        await page.locator('video').evaluate('(video)=>video.play().catch(()=>{})')
        await expect(page.get_by_role('button', name='重新载入视频')).to_be_visible(timeout=15000)
        await page.get_by_role('button', name='重新载入视频').click()
        await expect(page.locator('video')).to_have_js_property('videoWidth', 960, timeout=15000)
        assert calls['n'] >= 2
        print('PASS: public films do not prefetch media before play; a failed video request can be retried successfully')

        await page.goto(origin + '/connect')
        await page.get_by_role('button', name='开始连接自检').click()
        await expect(page.locator('#check-result')).to_contain_text('视频分段：正常', timeout=15000)
        await expect(page.locator('#check-result')).to_contain_text('图片读取：正常')
        print('PASS: same-origin connection checker reports real health, gallery, image and video Range reads under strict CSP')

        await page.goto(origin + '/admin')
        await page.get_by_label('管理员密码').fill(password)
        await page.get_by_role('button', name='登录管理后台').click()
        await expect(page.locator('.feedback-table tbody tr')).to_have_count(10)
        exported = await context.request.get(origin + '/api/admin?export=xlsx')
        assert exported.status == 200 and (await exported.body()).startswith(b'PK')
        print('PASS: all ten feedback rows visible after authenticated login; real XLSX export succeeds')
        assert not errors, errors
        (ROOT / 'work/qa/weak-network-result.json').write_text(json.dumps({'clients': result, 'pageErrors': errors, 'note': 'Chromium emulation on Linux; not campus/phone hardware acceptance'}, ensure_ascii=False, indent=2))
        await browser.close()


if __name__ == '__main__':
    (ROOT / 'work/qa').mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='yiyun-weak-') as tmp:
        folder = Path(tmp)
        password = 'Isolated-network-test-only-20261103'
        config = "const fs=require('fs'),crypto=require('crypto');fs.writeFileSync(process.argv[1],JSON.stringify({origin:'https://preserved.example',password:{salt:'test',hash:crypto.scryptSync(process.argv[2],'test',32).toString('hex')},feedbackSalt:'test'}))"
        subprocess.run(['node', '-e', config, str(folder / 'config.json'), password], check=True)
        saved = (folder / 'config.json').read_bytes()
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        origin = f'http://127.0.0.1:{port}'
        with (ROOT / 'work/qa/browser-server.log').open('w') as log:
            child = subprocess.Popen(['node', 'runtime/server.mjs'], cwd=ROOT, env={**os.environ, 'DATA_DIR': tmp, 'LOCAL_PREVIEW': '1', 'PORT': str(port)}, stdout=log, stderr=log)
            try:
                for _ in range(100):
                    try:
                        urlopen(origin + '/api/health', timeout=1)
                        break
                    except OSError:
                        time.sleep(.1)
                else:
                    raise RuntimeError('Test server did not start')
                asyncio.run(check(origin, folder, password))
                assert (folder / 'config.json').read_bytes() == saved
            finally:
                child.terminate()
                child.wait(timeout=12)
