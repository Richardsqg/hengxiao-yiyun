#!/usr/bin/env python3
"""Build two self-contained desktop ZIPs using verified official Node runtimes."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import stat
import subprocess
import tarfile
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parent.parent
NODE_VERSION = '24.22.0'
NODE_BASE = f'https://nodejs.org/dist/v{NODE_VERSION}/'
ARCHIVES = {
    'darwin-arm64': ('tar.gz', '6a9724d9b50a5f22b4816cded441b5a8d9ddae546191a5e5b7efa5a5e2ee26d5'),
    'darwin-x64': ('tar.gz', '495e3f273c645f3c4677d438304cdfc701729ea5dec5728f5c8e76a2dece4b91'),
    'win-arm64': ('zip', '3a5c209a5bc59e65b3bc0fa13ed5e166a26bd3d55332847f498b76b037408d61'),
    'win-x64': ('zip', 'f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3'),
}


def sha256(file):
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def runtime(platform, cache):
    extension, expected = ARCHIVES[platform]
    stem = f'node-v{NODE_VERSION}-{platform}'
    archive = cache / (stem + '.' + extension)
    if not archive.exists():
        print(f'Downloading official {archive.name}', flush=True)
        partial = archive.with_suffix(archive.suffix + '.partial')
        with urllib.request.urlopen(NODE_BASE + archive.name, timeout=60) as response, partial.open('wb') as target:
            shutil.copyfileobj(response, target)
        partial.rename(archive)
    if sha256(archive) != expected:
        raise RuntimeError(f'Official Node SHA-256 mismatch: {archive.name}')
    destination = cache / platform
    destination.mkdir(exist_ok=True)
    paths = [('node.exe', 'node.exe')] if platform.startswith('win-') else [('bin/node', 'bin/node')]
    paths += [('LICENSE', 'LICENSE'), ('README.md', 'README.md')]
    files = []
    source = zipfile.ZipFile(archive) if extension == 'zip' else tarfile.open(archive, 'r:gz')
    with source:
        for member, relative in paths:
            output = destination / relative
            output.parent.mkdir(parents=True, exist_ok=True)
            content = source.open(stem + '/' + member) if extension == 'zip' else source.extractfile(stem + '/' + member)
            with content, output.open('wb') as target:
                shutil.copyfileobj(content, target)
            output.chmod(0o755 if relative in ('node.exe', 'bin/node') else 0o644)
            files.append((output, '.runtime/' + platform + '/' + relative))
    return files, {'platform': platform, 'version': NODE_VERSION, 'source': NODE_BASE + archive.name,
                   'archiveSha256': expected, 'binarySha256': sha256(destination / paths[0][1])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', type=Path, default=ROOT / 'work/desktop-packages')
    args = parser.parse_args()
    out = args.out.resolve()
    out.mkdir(parents=True, exist_ok=True)
    cache = ROOT / 'work/desktop-node-cache'
    cache.mkdir(parents=True, exist_ok=True)
    version = json.loads((ROOT / 'package.json').read_text())['version']
    source_commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip()
    sources = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT).decode().split('\0')
    omit_prefixes = ('.git/',)
    omit_files = {'CODEX_FIRST_MESSAGE.txt', 'macOS_同WiFi扫码启动_本次补充.command', 'macOS_本机启动_本次补充.command',
                  'macOS_导入凤冠91帧_本次补充.command', 'macOS_导入第一部视频_本次补充.command',
                  'Windows_导入凤冠91帧_本次补充.bat', '开始使用.html'}
    # Large default movies are included once as the original repository parts.
    # The existing startup restores them locally, without any download.
    sources = sorted(set(name for name in sources if name and not name.startswith(omit_prefixes)
                         and name not in omit_files and (ROOT / name).is_file()))
    for name in sources:
        if name.startswith(('data/', 'backups/', 'work/', 'node_modules/')) or name.endswith(('.zip', '.log')):
            raise RuntimeError('Unexpected deployment input: ' + name)
    results = []
    for platform, runtimes in [('Windows', ['win-x64', 'win-arm64']), ('Mac', ['darwin-arm64', 'darwin-x64'])]:
        extra_files, runtime_manifest = [], []
        for item in runtimes:
            files, info = runtime(item, cache)
            extra_files.extend(files)
            runtime_manifest.append(info)
        archive = out / f'hengxiao-yiyun-{version}-desktop-{platform}.zip'
        prefix = f'hengxiao-yiyun-{version}-desktop/'
        checksums = []
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
            for name in sources:
                if platform == 'Mac' and name.startswith('Windows_'):
                    continue
                if platform == 'Windows' and name.startswith('macOS_'):
                    continue
                file = ROOT / name
                info = zipfile.ZipInfo(prefix + name)
                info.create_system = 3
                mode = 0o755 if name.endswith(('.command', '.sh')) else 0o644
                info.external_attr = (stat.S_IFREG | mode) << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                data = file.read_bytes()
                if name.endswith('.bat'):
                    data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
                z.writestr(info, data)
                checksums.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
            for file, name in extra_files:
                z.write(file, prefix + name)
                checksums.append({'path': name, 'bytes': file.stat().st_size, 'sha256': sha256(file)})
            z.writestr(prefix + '.runtime/runtime-manifest.json', json.dumps(runtime_manifest, ensure_ascii=False, indent=2) + '\n')
            guide = ROOT / 'docs' / ('DESKTOP_' + version.replace('.', '_') + '.html')
            z.writestr(prefix + '开始使用.html', guide.read_bytes())
            z.writestr(prefix + 'desktop-manifest.json', json.dumps({'version': version, 'platform': platform, 'sourceCommit': source_commit, 'files': checksums}, ensure_ascii=False, indent=2) + '\n')
        with zipfile.ZipFile(archive) as z:
            bad = z.testzip()
            if bad:
                raise RuntimeError('Bad ZIP member: ' + bad)
        result = {'platform': platform, 'file': str(archive), 'bytes': archive.stat().st_size, 'sha256': sha256(archive)}
        results.append(result)
        print(json.dumps(result, ensure_ascii=False), flush=True)
    (out / 'desktop-packages.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
