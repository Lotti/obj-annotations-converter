import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const projectDir = process.cwd();
const tmpRoot = await mkdtemp(path.join(tmpdir(), 'obj-annotations-converter-'));

async function runConversion(args, expectedOutput) {
  await execFileAsync(process.execPath, [path.join(projectDir, 'cli', 'converter.js'), ...args], {
    cwd: projectDir,
  });
  await access(expectedOutput);
}

try {
  await runConversion(
    [
      '--from',
      'voc',
      '--to',
      'watson',
      '--source',
      path.join(projectDir, 'samples'),
      '--target',
      tmpRoot,
    ],
    path.join(tmpRoot, 'pascal_voc.json'),
  );

  await runConversion(
    [
      '--from',
      'watson',
      '--to',
      'voc',
      '--source',
      path.join(projectDir, 'samples'),
      '--target',
      tmpRoot,
    ],
    path.join(tmpRoot, 'watson.xml'),
  );

  console.log(`Smoke test passed using ${tmpRoot}`);
} finally {
  await rm(tmpRoot, { force: true, recursive: true });
}
