import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  clamp,
  listFilesByExtension,
  readJsonFile,
  writeJsonFile,
} from '../lib/utils.js';

function toCloudAnnotationObject(json) {
  const filename = json.source.filename;

  return {
    [filename]: json.training_data.objects.map((object) => ({
      id: randomUUID(),
      label: object.object,
      x: clamp(object.location.left / json.dimensions.width, 0, 1),
      x2: clamp(
        (object.location.left + object.location.width) / json.dimensions.width,
        0,
        1,
      ),
      y: clamp(object.location.top / json.dimensions.height, 0, 1),
      y2: clamp(
        (object.location.top + object.location.height) / json.dimensions.height,
        0,
        1,
      ),
    })),
  };
}

export default async function watsonToCa({ source, target }) {
  const entries = await listFilesByExtension(source, '.json');
  const labels = new Set();
  const annotations = {};

  for (const entry of entries) {
    const json = await readJsonFile(entry);
    for (const object of json.training_data.objects) {
      labels.add(object.object);
    }

    Object.assign(annotations, toCloudAnnotationObject(json));
  }

  await writeJsonFile(path.join(target, '_annotations.json'), {
    annotations,
    labels: [...labels].sort(),
    type: 'localization',
    version: '1.0',
  });

  console.log(`Cloud Annotations file generated at ${path.join(target, '_annotations.json')}`);
}
