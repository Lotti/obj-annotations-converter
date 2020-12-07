const path = require(`path`);
const fg = require(`fast-glob`);
const fs = require(`fs-extra`);
const chalk = require(`chalk`);
const {between} = require('../helpers/helpers');

/**
 *
 * @param json
 * @returns {Promise<[]>}
 */
const jsonToAnnotation = async (json) => {
  const annotations = [];
  for (const o of json.training_data.objects) {
    annotations.push({
      x: between(o.location.left / json.dimensions.width, 0, 1, false),
      y: between(o.location.top / json.dimensions.height, 0, 1, false),
      x2: between((o.location.left + o.location.width) / json.dimensions.width, 0, 1, false),
      y2: between((o.location.top + o.location.height) / json.dimensions.height, 0, 1, false),
      id: uuidv4(),
      label: o.object,
    });
  }
  return annotations;
};

/**
 *
 * @param source
 * @param target
 * @param options
 */
module.exports = (source, target, options) => {
  const entries = fg.sync(path.join(source, `*.json`), options);
  console.log(chalk.green(`Found ${entries.length} entries.`));
  let i = 0;
  const ps = [];
  for (const entry of entries) {
    ps.push(fs.readFile(entry, {encoding: `utf8`}).then((data) => {
      try {
        return JSON.parse(data);
      } catch (error) {
        console.error(error);
        console.error(chalk.red(`Can't convert file ${entry}. Skipping it.`));
        return undefined;
      }
    }).then((json) => {
      console.log(`Parsed file: ${entry}`);
      return json;
    }).catch((error) => {
      console.error(error);
      console.error(chalk.red(`Can't access file ${entry}. Skipping it.`));
    }));
  }

  Promise.all(ps).then((jsons) => {
    const labels = [];
    const annotations = {};
    for (const json of jsons) {
      if (json) {
        const filename = json.source.filename;
        for (const o of json.training_data.objects) {
          if (!labels.includes(o.object)) {
            labels.push(o.object);
          }
          annotations[filename] = jsonToAnnotation(json);
        }
      }
    }

    return {
      version: '1.0',
      type: 'localization',
      labels,
      annotations,
    };
  }).then((json) => {
    const fileDst = path.join(target, `_annotations.json`);
    return fs.writeFile(fileDst, JSON.stringify(json), 'utf8').then(() => {
      console.log(`Cloud Annotations file generated at ${fileDst}`);
    });
  }).catch((error) => {
    console.error(error);
    console.error(chalk.red(`Can't create _annotations.json file.`));
  });
};