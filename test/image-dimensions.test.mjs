import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { getImageDimensions } from '../lib/utils.js';

const ONE_BY_ONE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';

test('getImageDimensions reads png width and height', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'obj-annotations-converter-'));
  const imagePath = path.join(directory, 'sample.png');

  try {
    await writeFile(imagePath, Buffer.from(ONE_BY_ONE_PNG_BASE64, 'base64'));

    const dimensions = await getImageDimensions(imagePath);

    assert.deepEqual(dimensions, {
      height: 1,
      width: 1,
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
