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
  readJsonFile,
  writeJsonFile,
  writeTextFile,
} from '../lib/utils.js';

export default async function watsonToMvi({ datasetName, source, target }) {
  const entries = await listFilesByExtension(source, '.json');
  const files = [];

  for (const entry of entries) {
    const json = await readJsonFile(entry);
    const fileId = randomUUID();
    const xml = buildXml(
      buildMviDocument({
        fileId,
        height: json.dimensions.height,
        objects: json.training_data.objects.map((object) => ({
          name: object.object,
          xmax: clamp(
            object.location.left + object.location.width,
            0,
            json.dimensions.width,
            true,
          ),
          xmin: clamp(object.location.left, 0, json.dimensions.width, true),
          ymax: clamp(
            object.location.top + object.location.height,
            0,
            json.dimensions.height,
            true,
          ),
          ymin: clamp(object.location.top, 0, json.dimensions.height, true),
        })),
        width: json.dimensions.width,
      }),
    );

    files.push({
      ...createMviEntry(json.source.filename),
      _id: fileId,
    });

    const destination = path.join(target, `${fileStem(entry)}.xml`);
    await writeTextFile(destination, xml);
    console.log(`${destination} generated`);
  }

  await writeJsonFile(path.join(target, 'prop.json'), createMviProp(datasetName, files));
}
