import { randomUUID } from 'node:crypto';
import { access, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';
import { imageSizeFromFile } from 'image-size/fromFile';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

const xmlBuilder = new XMLBuilder({
  format: true,
  ignoreAttributes: false,
  suppressBooleanAttributes: false,
});

export function clamp(value, min, max, round = false) {
  let result = value;

  if (Number.isFinite(min) && result < min) {
    result = min;
  }

  if (Number.isFinite(max) && result > max) {
    result = max;
  }

  return round ? Math.round(result) : result;
}

export async function ensureDirectory(directoryPath) {
  await mkdir(directoryPath, { recursive: true });
}

export async function ensureReadableDirectory(directoryPath) {
  await access(directoryPath);
  return directoryPath;
}

export async function listFilesByExtension(directoryPath, extension) {
  const entries = await readdir(directoryPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension.toLowerCase()))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort();
}

export async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function readTextFile(filePath) {
  return readFile(filePath, 'utf8');
}

export async function writeJsonFile(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export async function writeTextFile(filePath, data) {
  await writeFile(filePath, data, 'utf8');
}

export async function getImageDimensions(filePath) {
  const dimensions = await imageSizeFromFile(filePath);

  if (!dimensions.width || !dimensions.height) {
    throw new Error(`Unable to read image dimensions for ${filePath}`);
  }

  return {
    height: dimensions.height,
    width: dimensions.width,
  };
}

export function sanitizeLabel(label) {
  return String(label).replace(/[-"/\\|[\]{}();:,]/gu, '_');
}

export function buildXml(document) {
  return xmlBuilder.build(document);
}

export function parseXml(xmlText) {
  const validation = XMLValidator.validate(xmlText);
  if (validation !== true) {
    throw new Error(`Invalid XML: ${validation.err.msg}`);
  }

  return xmlParser.parse(xmlText);
}

export function asArray(value) {
  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function fileStem(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

export function createMviEntry(fileName) {
  const now = Date.now();

  return {
    _id: randomUUID(),
    category_id: null,
    category_name: null,
    created_at: now,
    file_type: 'image',
    generate_type: null,
    label_type: 'manual',
    original_file_name: fileName,
    parent_id: null,
    upload_type: 'file_upload',
    uploaded_at: now,
  };
}

export function createMviProp(datasetName, files) {
  return {
    action_prop_info: '[]',
    category_prop_info: '[]',
    file_prop_info: JSON.stringify(files),
    name: datasetName,
    pre_process: '',
    prop_version: 'PROP_VESION_1',
    scenario: '',
    type: 0,
    usage: 'generic',
  };
}

export function buildVocDocument({
  filename,
  imageId = 'Unspecified',
  objects,
  rootPath = '',
  width,
  height,
}) {
  return {
    annotation: {
      filename,
      folder: 'Unspecified',
      object: objects.map((object) => ({
        bndbox: {
          xmax: object.xmax,
          xmin: object.xmin,
          ymax: object.ymax,
          ymin: object.ymin,
        },
        difficult: 0,
        name: object.name,
        pose: 'Unspecified',
        truncated: 0,
      })),
      path: path.join(rootPath, filename),
      segmented: 0,
      size: {
        dept: 3,
        height,
        width,
      },
      source: {
        database: imageId,
      },
    },
  };
}

export function buildMviDocument({ fileId, objects, width, height }) {
  return {
    annotation: {
      object: objects.map((object) => {
        const xmlObject = {
          _id: randomUUID(),
          bndbox: {
            xmax: object.xmax,
            xmin: object.xmin,
            ymax: object.ymax,
            ymin: object.ymin,
          },
          file_id: fileId,
          generate_type: 'manual',
          name: sanitizeLabel(object.name),
        };

        if (object.polygonPoints?.length) {
          xmlObject.segment_polygons = {
            polygon: {
              point: object.polygonPoints.map((point) => ({
                value: [point.x, point.y],
              })),
            },
          };
        }

        return xmlObject;
      }),
      segmented: 0,
      size: {
        dept: 3,
        height,
        width,
      },
    },
  };
}

export function normalizeVocObjects(parsedXml) {
  return asArray(parsedXml.annotation?.object).map((object) => ({
    name: object.name,
    xmax: Number(object.bndbox.xmax),
    xmin: Number(object.bndbox.xmin),
    ymax: Number(object.bndbox.ymax),
    ymin: Number(object.bndbox.ymin),
  }));
}
