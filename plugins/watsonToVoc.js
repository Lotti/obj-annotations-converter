import path from 'node:path';
import {
  buildVocDocument,
  buildXml,
  clamp,
  fileStem,
  listFilesByExtension,
  readJsonFile,
  writeTextFile,
} from '../lib/utils.js';

export default async function watsonToVoc({ source, target }) {
  const entries = await listFilesByExtension(source, '.json');

  for (const entry of entries) {
    const json = await readJsonFile(entry);
    const xmlString = buildXml(
      buildVocDocument({
        filename: json.source.filename,
        height: json.dimensions.height,
        imageId: json.image_id,
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
        rootPath: source,
        width: json.dimensions.width,
      }),
    );

    const destination = path.join(target, `${fileStem(entry)}.xml`);
    await writeTextFile(destination, xmlString);
    console.log(`${destination} generated`);
  }
}
