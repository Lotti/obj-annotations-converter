#!/usr/bin/env node

import { parseArgs } from 'node:util';
import path from 'node:path';
import process from 'node:process';
import caToWatson from '../plugins/caToWatson.js';
import viaToMvi from '../plugins/viaToMVI.js';
import vocToMvi from '../plugins/vocToMVI.js';
import vocToWatson from '../plugins/vocToWatson.js';
import watsonToCa from '../plugins/watsonToCa.js';
import watsonToMvi from '../plugins/watsonToMVI.js';
import watsonToVoc from '../plugins/watsonToVoc.js';
import { ensureDirectory, ensureReadableDirectory } from '../lib/utils.js';

const SUPPORTED_FROM = new Set(['watson', 'voc', 'ca', 'via']);
const SUPPORTED_TO = new Set(['watson', 'voc', 'ca', 'mvi']);

const usage = `Usage: obj-annotations-converter --from watson --to voc --source . --target ./annotations

Options:
  --from <type>     Set annotation origin format [watson, voc, ca, via]
  --to <type>       Set annotation destination format [watson, voc, ca, mvi]
  --source <src>    origin directory
  --target <dst>    target directory
  --dataset <name>  dataset name (required only when converting to mvi)
  -h, --help        display help for command
  -V, --version     output the version number`;

const { values } = parseArgs({
  allowPositionals: false,
  options: {
    dataset: { type: 'string' },
    from: { default: 'watson', type: 'string' },
    help: { short: 'h', type: 'boolean' },
    source: { type: 'string' },
    target: { type: 'string' },
    to: { default: 'voc', type: 'string' },
    version: { short: 'V', type: 'boolean' },
  },
});

if (values.help) {
  console.log(usage);
  process.exit(0);
}

if (values.version) {
  console.log('1.0.0');
  process.exit(0);
}

if (!SUPPORTED_FROM.has(values.from)) {
  console.error(`Unsupported origin format "${values.from}".`);
  console.error(usage);
  process.exit(1);
}

if (!SUPPORTED_TO.has(values.to)) {
  console.error(`Unsupported destination format "${values.to}".`);
  console.error(usage);
  process.exit(1);
}

if (values.from === values.to) {
  console.error(`Can't proceed with same format as origin and destination.`);
  process.exit(1);
}

if (values.to === 'mvi' && !values.dataset?.trim()) {
  console.error(`You must provide a dataset name using --dataset when converting to mvi.`);
  process.exit(1);
}

const source = path.resolve(values.source ?? process.cwd());
const target = path.resolve(values.target ?? values.source ?? process.cwd());

try {
  await ensureReadableDirectory(source);
} catch {
  console.error(`Path source ${source} must be an existing directory.`);
  process.exit(1);
}

await ensureDirectory(target);

const converters = new Map([
  ['ca->watson', caToWatson],
  ['via->mvi', viaToMvi],
  ['voc->mvi', vocToMvi],
  ['voc->watson', vocToWatson],
  ['watson->ca', watsonToCa],
  ['watson->mvi', watsonToMvi],
  ['watson->voc', watsonToVoc],
]);

const converter = converters.get(`${values.from}->${values.to}`);
if (!converter) {
  console.error(`Can't convert from ${values.from} to ${values.to}: case not supported.`);
  process.exit(1);
}

try {
  await converter({
    datasetName: values.dataset?.trim(),
    source,
    target,
  });
  console.log('Done!');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
