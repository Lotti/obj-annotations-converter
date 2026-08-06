import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  buildMviDocument,
  buildXml,
  clamp,
  createMviEntry,
  createMviProp,
  fileStem,
  listFilesByExtension,
  normalizeVocObjects,
  parseXml,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} from '../lib/utils.js';

export default async function vocToMvi({ datasetName, source, target }) {
  const entries = await listFilesByExtension(source, '.xml');
  const files = [];

  for (const entry of entries) {
    const parsedXml = parseXml(await readTextFile(entry));
    const width = Number(parsedXml.annotation.size.width);
    const height = Number(parsedXml.annotation.size.height);
    const fileId = randomUUID();

    const xml = buildXml(
      buildMviDocument({
        fileId,
        height,
        objects: normalizeVocObjects(parsedXml).map((object) => ({
          name: object.name,
          xmax: clamp(object.xmax, 0, width, true),
          xmin: clamp(object.xmin, 0, width, true),
          ymax: clamp(object.ymax, 0, height, true),
          ymin: clamp(object.ymin, 0, height, true),
        })),
        width,
      }),
    );

    files.push({
      ...createMviEntry(parsedXml.annotation.filename),
      _id: fileId,
    });

    const destination = path.join(target, `${fileStem(entry)}.xml`);
    await writeTextFile(destination, xml);
    console.log(`${destination} generated`);
  }

  await writeJsonFile(path.join(target, 'prop.json'), createMviProp(datasetName, files));
}
