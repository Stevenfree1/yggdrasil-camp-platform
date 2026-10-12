import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildIdPath = join(webDir, '.next', 'BUILD_ID');

if (existsSync(buildIdPath)) {
  process.exit(0);
}

console.warn('Missing .next/BUILD_ID; running Next.js production build before start.');

const result = spawnSync('npm', ['run', 'build'], {
  cwd: webDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

if (!existsSync(buildIdPath)) {
  console.error('Next.js build finished, but .next/BUILD_ID was still not created.');
  process.exit(1);
}
