import path from 'node:path';
import {
  clamp,
  fileStem,
  listFilesByExtension,
  normalizeVocObjects,
  parseXml,
  readTextFile,
  writeTextFile,
} from '../lib/utils.js';

export default async function vocToWatson({ source, target }) {
  const entries = await listFilesByExtension(source, '.xml');

  for (const entry of entries) {
    const parsedXml = parseXml(await readTextFile(entry));
    const width = Number(parsedXml.annotation.size.width);
    const height = Number(parsedXml.annotation.size.height);

    const json = {
      created: new Date().toISOString(),
      dimensions: {
        height,
        width,
      },
      image_id: parsedXml.annotation.source?.database ?? fileStem(entry),
      source: {
        filename: parsedXml.annotation.filename,
        type: 'file',
      },
      training_data: {
        objects: normalizeVocObjects(parsedXml).map((object) => ({
          location: {
            height: clamp(object.ymax - object.ymin, 0, height, true),
            left: clamp(object.xmin, 0, width, true),
            top: clamp(object.ymin, 0, height, true),
            width: clamp(object.xmax - object.xmin, 0, width, true),
          },
          object: object.name,
        })),
      },
      updated: new Date().toISOString(),
    };

    const destination = path.join(target, `${fileStem(entry)}.json`);
    await writeTextFile(destination, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`${destination} generated`);
  }
}
