import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectDir = process.cwd();

for (const relativePath of [
  'cli/converter.js',
  'lib/utils.js',
  'plugins/watsonToVoc.js',
  'plugins/vocToWatson.js',
  'scripts/smoke-test.mjs',
]) {
  await access(resolve(projectDir, relativePath));
}

console.log(`Validated project structure in ${projectDir}`);
