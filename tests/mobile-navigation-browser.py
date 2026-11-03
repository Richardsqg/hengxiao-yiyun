"""Check mobile navigation with simulated Android browser controls, not real WeChat UI."""
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
TABS = [('凤冠鉴赏', 'crown'), ('文化寻根', 'culture'), ('影像展厅', 'films'), ('观展留言', 'voices')]
OVERLAY = """() => {
  const overlay = document.createElement('div');
  overlay.id = 'simulated-browser-zoom-controls';
  overlay.textContent = '−     +';
  overlay.setAttribute('aria-label', '模拟浏览器原生缩放浮层');
  Object.assign(overlay.style, {position:'fixed',right:'8px',bottom:'8px',width:'160px',height:'56px',
    zIndex:'2147483647',background:'#ddd',color:'#333',borderRadius:'28px',fontSize:'30px',
    textAlign:'center',lineHeight:'56px',pointerEvents:'auto'});
  document.body.appendChild(overlay);
}"""


def assert_clear_navigation(page, nav):
    controls = page.locator('#simulated-browser-zoom-controls')
    overlay = controls.bounding_box() if controls.count() else None
    for label, section in TABS:
        button = nav.get_by_role('button', name=label, exact=True)
        box = button.bounding_box()
        assert box and box['height'] >= 44, (label, box)
        assert 0 <= box['x'] and box['x'] + box['width'] <= page.viewport_size['width'] + 1, (label, box)
        if overlay:
            overlap_x = box['x'] < overlay['x'] + overlay['width'] and box['x'] + box['width'] > overlay['x']
            overlap_y = box['y'] < overlay['y'] + overlay['height'] and box['y'] + box['height'] > overlay['y']
            assert not (overlap_x and overlap_y), (label, box, overlay)
        button.tap()
        expect(button).to_have_attribute('aria-current', 'page')
        expect(page.locator('.exhibition-page')).to_have_class('exhibition-page section-' + section)


def main():
    (ROOT / 'work').mkdir(exist_ok=True)
    checks, errors = [], []
    with tempfile.TemporaryDirectory(prefix='mobile-navigation-', dir=ROOT / 'work') as temporary:
        data = Path(temporary)
        (data / 'config.json').write_text(json.dumps({
            'origin': 'https://saved.example',
            'password': {'salt': 'test', 'hash': 'test'}, 'feedbackSalt': 'test',
        }))
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        origin = f'http://127.0.0.1:{port}'
        log = (data / 'server.log').open('w+')
        child = subprocess.Popen(['node', 'runtime/server.mjs'], cwd=ROOT,
                                 env={**os.environ, 'DATA_DIR': str(data), 'PORT': str(port), 'LOCAL_PREVIEW': '1'},
                                 stdout=log, stderr=log)
        try:
            for _ in range(150):
                try:
                    if urlopen(origin + '/api/health', timeout=1).status == 200:
                        break
                except OSError:
                    if child.poll() is not None:
                        log.seek(0)
                        raise RuntimeError(log.read())
                    time.sleep(.1)
            else:
                raise RuntimeError('Navigation test server did not start')
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
                cases = [('320', 320, 740, False), ('360', 360, 780, False),
                         ('390', 390, 844, False), ('430', 430, 932, False),
                         ('landscape', 740, 360, False), ('large-text', 320, 740, True)]
                for name, width, height, large_text in cases:
                    context = browser.new_context(viewport={'width': width, 'height': height},
                                                  is_mobile=True, has_touch=True, device_scale_factor=1)
                    page = context.new_page()
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    page.goto(origin, wait_until='networkidle')
                    if os.environ.get('NAVIGATION_TEST_CSS_PREVIEW') == '1':
                        page.add_style_tag(content=(ROOT / 'web/revision.css').read_text())
                    nav = page.get_by_role('navigation', name='手机展馆导航')
                    expect(nav).to_be_visible()
                    viewport = page.locator('meta[name="viewport"]').get_attribute('content')
                    assert 'user-scalable=no' not in viewport and 'maximum-scale=1' not in viewport
                    page.evaluate(OVERLAY)
                    if large_text:
                        page.add_style_tag(content='.mobile-tabs button{font-size:20px}')
                    assert_clear_navigation(page, nav)
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                    submit = page.get_by_role('button', name='留下我的回响')
                    submit.scroll_into_view_if_needed()
                    page.evaluate('window.scrollTo(0,document.scrollingElement.scrollHeight)')
                    page.wait_for_timeout(100)
                    box, nav_box = submit.bounding_box(), nav.bounding_box()
                    assert box and nav_box and box['y'] + box['height'] <= nav_box['y'] + 1, (name, box, nav_box)
                    checks.append({'viewport': name, 'width': width, 'height': height,
                                   'four_navigation_targets_clear': True, 'submit_above_navigation': True})
                    context.close()
                # WebKit's iOS safe-area feature is not emulated by Chromium. Verify
                # the 34px inset layout separately without claiming an iPhone test.
                context = browser.new_context(viewport={'width': 390, 'height': 844},
                                              is_mobile=True, has_touch=True)
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(origin, wait_until='networkidle')
                if os.environ.get('NAVIGATION_TEST_CSS_PREVIEW') == '1':
                    page.add_style_tag(content=(ROOT / 'web/revision.css').read_text())
                page.add_style_tag(content='.exhibition-page{--browser-controls-clearance:0px;--mobile-navigation-inset:34px}')
                nav = page.get_by_role('navigation', name='手机展馆导航')
                assert_clear_navigation(page, nav)
                checks.append({'viewport': '34px-safe-area-layout-simulation', 'four_navigation_targets_clear': True})
                context.close()
                desktop = browser.new_context(viewport={'width': 1280, 'height': 900})
                page = desktop.new_page()
                page.goto(origin, wait_until='networkidle')
                if os.environ.get('NAVIGATION_TEST_CSS_PREVIEW') == '1':
                    page.add_style_tag(content=(ROOT / 'web/revision.css').read_text())
                expect(page.get_by_role('navigation', name='手机展馆导航')).not_to_be_visible()
                expect(page.get_by_role('navigation', name='展馆导航', exact=True)).to_be_visible()
                checks.append({'viewport': 'desktop', 'desktop_navigation_preserved': True})
                desktop.close()
                browser.close()
            assert not errors, errors
            result = {'checks': checks, 'page_errors': errors,
                      'scope': 'Linux Chromium layouts and a DOM overlay simulating browser controls; not Samsung/WeChat/iPhone hardware'}
            (ROOT / 'work/mobile-navigation-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
            print(json.dumps(result, ensure_ascii=False))
        finally:
            child.terminate()
            try:
                child.wait(timeout=12)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
            log.close()


if __name__ == '__main__':
    main()
