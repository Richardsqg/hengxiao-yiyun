"""Targeted browser check for magnified 360 interaction; requires Python Playwright."""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
from urllib.request import urlopen
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent


def angle(page):
    return page.locator('.zoom-viewer').first.locator('input[aria-label="旋转角度"]').input_value()


def magnification(viewer):
    return viewer.locator('.compact-tools > div > span').inner_text()


def drag_mouse(page, stage, dx=100, dy=0):
    box = stage.bounding_box()
    x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
    page.mouse.move(x, y)
    page.mouse.down()
    page.mouse.move(x + dx, y + dy, steps=8)
    page.mouse.up()


with tempfile.TemporaryDirectory(prefix='zoom-spin-', dir=ROOT / 'work') as temp:
    data = Path(temp)
    (data / 'config.json').write_text(json.dumps({'origin': 'https://saved.example', 'password': {'salt': 'test', 'hash': 'test'}, 'feedbackSalt': 'test'}))
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    child = subprocess.Popen(['node', 'scripts/start-media-supplement.mjs', '--local', '--no-open'], cwd=ROOT,
                             env={**os.environ, 'DATA_DIR': str(data), 'PORT': str(port)}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                if urlopen(origin + '/api/health', timeout=1).status == 200:
                    break
            except OSError:
                time.sleep(.1)
        else:
            raise RuntimeError('Browser test server did not start')
        errors = []
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            desktop = browser.new_context(viewport={'width': 1280, 'height': 1000})
            page = desktop.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin, wait_until='networkidle')
            viewer = page.locator('.zoom-viewer').first
            stage = viewer.locator('.zoom-stage')
            expect(viewer.locator('input[aria-label="旋转角度"]')).to_have_attribute('max', '90')
            for _ in range(4):
                viewer.get_by_role('button', name='放大', exact=True).click()
            assert magnification(viewer) == '200%'
            before = angle(page)
            drag_mouse(page, stage)
            assert angle(page) != before and magnification(viewer) == '200%'
            viewer.get_by_role('button', name='下一角度', exact=True).click()
            assert magnification(viewer) == '200%'
            slider = viewer.locator('input[aria-label="旋转角度"]')
            slider.focus()
            slider.press('End')
            expect(slider).to_have_value('90')
            assert magnification(viewer) == '200%'
            viewer.get_by_role('button', name='下一角度', exact=True).click()
            expect(slider).to_have_value('0')
            viewer.get_by_role('button', name='拖动平移', exact=True).click()
            before, transform = angle(page), stage.locator('img').get_attribute('style')
            drag_mouse(page, stage, 70, 40)
            assert angle(page) == before and stage.locator('img').get_attribute('style') != transform
            transform = stage.locator('img').get_attribute('style')
            viewer.get_by_role('button', name='拖动旋转', exact=True).click()
            drag_mouse(page, stage, -80)
            assert angle(page) != before and stage.locator('img').get_attribute('style') == transform
            auto = viewer.get_by_role('button', name='自动旋转', exact=True)
            expect(auto).to_be_enabled(timeout=20000)
            before = angle(page)
            auto.click()
            page.wait_for_timeout(350)
            assert angle(page) != before and magnification(viewer) == '200%'
            viewer.get_by_role('button', name='暂停旋转', exact=True).click()
            viewer.get_by_role('button', name='全屏查看', exact=True).click()
            full = page.get_by_role('dialog').locator('.zoom-viewer')
            full.get_by_role('button', name='放大', exact=True).click()
            full.get_by_role('button', name='下一角度', exact=True).click()
            assert magnification(full) == '125%'
            drag_mouse(page, full.locator('.zoom-stage'))
            assert magnification(full) == '125%'
            page.get_by_role('dialog').get_by_role('button', name='关闭', exact=True).click()
            viewer.get_by_role('button', name='重置视角', exact=True).click()
            assert magnification(viewer) == '100%'
            expect(viewer.get_by_role('button', name='拖动平移', exact=True)).to_be_disabled()
            desktop.close()

            mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
            page = mobile.new_page()
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(origin, wait_until='networkidle')
            viewer = page.locator('.zoom-viewer').first
            stage = viewer.locator('.zoom-stage')
            box = stage.bounding_box()
            x, y = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
            cdp = mobile.new_cdp_session(page)

            def touch(kind, points):
                cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [{'id': i, 'x': px, 'y': py} for i, px, py in points]})
                page.wait_for_timeout(40)

            touch('touchStart', [(0, x - 35, y), (1, x + 35, y)])
            touch('touchMove', [(0, x - 70, y), (1, x + 70, y)])
            assert magnification(viewer) == '200%'
            before = angle(page)
            # One finger remaining after a pinch must not cause a jump or rotation.
            touch('touchEnd', [(0, x - 70, y)])
            touch('touchMove', [(0, x - 30, y)])
            assert angle(page) == before
            touch('touchEnd', [])
            touch('touchStart', [(0, x - 60, y)])
            touch('touchMove', [(0, x + 40, y)])
            touch('touchEnd', [])
            assert angle(page) != before and magnification(viewer) == '200%'
            viewer.get_by_role('button', name='拖动平移', exact=True).tap()
            before, transform = angle(page), stage.locator('img').get_attribute('style')
            touch('touchStart', [(0, x, y)])
            touch('touchMove', [(0, x + 50, y + 20)])
            touch('touchEnd', [])
            assert angle(page) == before and stage.locator('img').get_attribute('style') != transform, (before, angle(page), transform, stage.locator('img').get_attribute('style'), stage.bounding_box(), viewer.get_by_role('button', name='拖动平移', exact=True).get_attribute('aria-pressed'))
            viewer.get_by_role('button', name='下一角度', exact=True).tap()
            assert magnification(viewer) == '200%'
            viewer.get_by_role('button', name='拖动旋转', exact=True).tap()
            before = angle(page)
            touch('touchStart', [(0, x + 40, y)])
            touch('touchMove', [(0, x - 60, y)])
            touch('touchEnd', [])
            assert angle(page) != before and magnification(viewer) == '200%'
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            assert not errors, errors
            browser.close()
        print('PASS: desktop drag/arrows/slider/autoplay/fullscreen retain zoom; mobile pinch + enlarged rotation + pan + pinch-release protection; 91 frames and no browser errors.')
    finally:
        child.terminate()
        try:
            child.wait(timeout=12)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()
