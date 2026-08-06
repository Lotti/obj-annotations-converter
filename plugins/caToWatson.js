import path from 'node:path';
import {
  clamp,
  fileStem,
  getImageDimensions,
  listFilesByExtension,
  readJsonFile,
  writeTextFile,
} from '../lib/utils.js';

export default async function caToWatson({ source, target }) {
  const entries = await listFilesByExtension(source, '.json');

  for (const entry of entries) {
    const json = await readJsonFile(entry);
    if (!json.annotations) {
      console.error(`Can't find field "annotations" in file ${entry}`);
      continue;
    }

    for (const [filename, annotations] of Object.entries(json.annotations)) {
      const dimensions = await getImageDimensions(path.join(source, filename));
      const imageId = fileStem(filename);
      const watsonPayload = {
        created: new Date().toISOString(),
        dimensions,
        image_id: imageId,
        source: {
          filename,
          type: 'file',
        },
        training_data: {
          objects: annotations.map((annotation) => ({
            location: {
              height: clamp(
                annotation.y2 * dimensions.height - annotation.y * dimensions.height,
                0,
                dimensions.height,
                true,
              ),
              left: clamp(annotation.x * dimensions.width, 0, dimensions.width, true),
              top: clamp(annotation.y * dimensions.height, 0, dimensions.height, true),
              width: clamp(
                annotation.x2 * dimensions.width - annotation.x * dimensions.width,
                0,
                dimensions.width,
                true,
              ),
            },
            object: annotation.label,
          })),
        },
        updated: new Date().toISOString(),
      };

      const destination = path.join(target, `${imageId}.json`);
      await writeTextFile(destination, `${JSON.stringify(watsonPayload, null, 2)}\n`);
      console.log(`${destination} generated`);
    }
  }
}
