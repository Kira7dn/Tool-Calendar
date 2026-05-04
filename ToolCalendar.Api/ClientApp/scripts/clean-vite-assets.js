import { rmSync } from 'node:fs';
import { resolve } from 'node:path';

rmSync(resolve(import.meta.dirname, '../../wwwroot/vite-assets'), {
  recursive: true,
  force: true
});
