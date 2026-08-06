import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  buildMviDocument,
  buildXml,
  clamp,
  createMviEntry,
  createMviProp,
  fileStem,
  getImageDimensions,
  listFilesByExtension,
  readJsonFile,
  sanitizeLabel,
  writeJsonFile,
  writeTextFile,
} from '../lib/utils.js';

export default async function viaToMvi({ datasetName, source, target }) {
  const entries = await listFilesByExtension(source, '.json');
  const files = [];

  for (const entry of entries) {
    const data = await readJsonFile(entry);

    for (const annotation of Object.values(data)) {
      const imagePath = path.join(source, annotation.filename);
      const dimensions = await getImageDimensions(imagePath);
      const fileId = randomUUID();

      const xml = buildXml(
        buildMviDocument({
          fileId,
          height: dimensions.height,
          objects: annotation.regions.map((region) => {
            const xs = region.shape_attributes.all_points_x;
            const ys = region.shape_attributes.all_points_y;

            return {
              name: sanitizeLabel(region.region_attributes.annotazioni),
              polygonPoints: xs.map((x, index) => ({
                x: clamp(x, 0, dimensions.width, true),
                y: clamp(ys[index], 0, dimensions.height, true),
              })),
              xmax: clamp(Math.max(...xs), 0, dimensions.width, true),
              xmin: clamp(Math.min(...xs), 0, dimensions.width, true),
              ymax: clamp(Math.max(...ys), 0, dimensions.height, true),
              ymin: clamp(Math.min(...ys), 0, dimensions.height, true),
            };
          }),
          width: dimensions.width,
        }),
      );

      files.push({
        ...createMviEntry(annotation.filename),
        _id: fileId,
      });

      const destination = path.join(target, `${fileStem(annotation.filename)}.xml`);
      await writeTextFile(destination, xml);
      console.log(`${destination} generated`);
    }
  }

  await writeJsonFile(path.join(target, 'prop.json'), createMviProp(datasetName, files));
}
