import { readFileSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const expected = JSON.parse(readFileSync(path.join(root, '.codex/project.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const fail = message => { throw new Error('项目边界检查失败：' + message); };
if (realpathSync(process.cwd()) !== root) fail('请先进入当前仓库根目录。');
if (pkg.name !== expected.packageName) fail('package.json 与项目标记不匹配。');
let gitRoot, remote;
try {
  gitRoot = realpathSync(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim());
  remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
} catch { fail('需要独立 Git 仓库和 origin。请从对应 GitHub 仓库检出，不要放进其他项目。'); }
if (gitRoot !== root) fail('当前目录不是独立仓库根目录。');
let remotePath;
try { remotePath = new URL(remote).pathname; }
catch { remotePath = remote.replace(/^[^@]+@[^:]+:/, '/'); }
const normalized = remotePath.replace(/\.git\/?$/, '').replace(/\/$/, '').toLowerCase();
if (!normalized.endsWith('/' + expected.repository.toLowerCase())) fail('origin 不属于 ' + expected.repository + '。未输出可能含凭据的完整地址。');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major !== expected.nodeMajor || minor < expected.nodeMinimumMinor) fail('请使用 Node.js 24.15 或更高的 24.x。');
console.log('项目边界检查通过：' + expected.repository + ' / ' + pkg.name + ' / Node ' + process.versions.node);
