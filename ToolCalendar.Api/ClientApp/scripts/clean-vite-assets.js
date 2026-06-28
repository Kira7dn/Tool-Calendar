import { rmSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

rmSync(resolve(__dirname, '../../wwwroot/vite-assets'), {
  recursive: true,
  force: true,
})
