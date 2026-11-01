import { copyFile } from 'node:fs/promises';

await copyFile('index.template.html', 'index.html');
