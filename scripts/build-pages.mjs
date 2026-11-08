import { copyFile, cp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await copyFile('index.template.html', 'index.html');
const result = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.status !== 0) process.exit(result.status ?? 1);

await copyFile('dist/index.html', 'index.html');
await rm('assets', { recursive: true, force: true });
await cp('dist/assets', 'assets', { recursive: true });
await copyFile('dist/manifest.webmanifest', 'manifest.webmanifest');
await copyFile('dist/sw.js', 'sw.js');
