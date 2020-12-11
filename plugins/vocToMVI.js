const path = require(`path`);
const fg = require(`fast-glob`);
const fs = require(`fs-extra`);
const chalk = require(`chalk`);
const xmlParser = require(`fast-xml-parser`);
const xmlbuilder = require(`xmlbuilder`);
const {v4: uuidv4} = require(`uuid`);

const XMLtoXML = (source, xmlData, id) => {
  // parsing xml file
  const options = {
    attributeNamePrefix: `@_`,
    attrNodeName: `attr`, //default is 'false'
    textNodeName: `#text`,
    ignoreAttributes: true,
    ignoreNameSpace: false,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: false,
    trimValues: true,
    cdataTagName: `__cdata`, //default is 'false'
    cdataPositionChar: `\\c`,
    localeRange: ``, //To support non english character in tag/attribute values.
    parseTrueNumberOnly: false,
  };

  if (xmlParser.validate(xmlData) !== true) {
    throw new Error(`Can't parse xml`);
  }

  const jsonObj = xmlParser.convertToJson(xmlParser.getTraversalObj(xmlData, options), options);
  if (jsonObj.annotation.object) {
    jsonObj.annotation.object = Array.isArray(jsonObj.annotation.object) ? jsonObj.annotation.object : [jsonObj.annotation.object];
  }

  // creating xml file from json data
  const xml = xmlbuilder.create(`annotation`);
  const size = xml.ele(`size`);
  size.ele(`width`, {}, jsonObj.annotation.size.width);
  size.ele(`height`, {}, jsonObj.annotation.size.height);
  size.ele(`dept`, {}, 3);
  xml.ele(`segmented`, {}, 0);

  if (jsonObj.annotation.object) {
    for (const o of jsonObj.annotation.object) {
      const name = o.name.replace(/[-"/\\|[\]{}();:,]/g,`_`);
      const obj = xml.ele(`object`);
      obj.ele(`_id`, {}, uuidv4());
      obj.ele(`file_id`, {}, id);
      obj.ele(`name`, {}, name);
      obj.ele(`generate_type`, {}, `manual`);
      const bndbox = obj.ele(`bndbox`);
      bndbox.ele(`xmin`, {}, o.bndbox.xmin);
      bndbox.ele(`ymin`, {}, o.bndbox.ymin);
      bndbox.ele(`xmax`, {}, o.bndbox.xmax);
      bndbox.ele(`ymax`, {}, o.bndbox.ymax);
    }
  }

  return {xmlString: xml.end({pretty: true}), filename: jsonObj.annotation.filename};
};

/**
 *
 * @param uuid
 * @param fileName
 * @returns {{generate_type: null, upload_type: string, category_name: null, category_id: null, uploaded_at: number, file_type: string, parent_id: null, created_at: number, label_type: string, original_file_name, _id}}
 */
const mviEntry = (uuid, fileName) => {
  const now = Date.now();
  return {
    _id: uuid,
    file_type: `image`,
    parent_id: null,
    generate_type: null,
    category_id: null,
    category_name: null,
    created_at: now,
    label_type: `manual`,
    original_file_name: fileName,
    upload_type: `file_upload`,
    uploaded_at: now,
  };
};

/**
 *
 * @param source
 * @param target
 * @param globOptions
 * @param datasetName
 * @returns {Promise<void>}
 */
module.exports = async (source, target, globOptions, datasetName) => {
  const files = [];
  const stream = fg.stream(path.join(source, `*.xml`), globOptions);
  for await (const entry of stream) {
    const fileName = path.basename(entry.toString());
    const fileDst = path.join(target, fileName);
    try {
      const data = await fs.readFile(entry, {encoding: `utf8`});
      try {
        const id = uuidv4();
        const {xmlString, filename} = XMLtoXML(source, data, id);
        files.push(mviEntry(id, filename));
        try {
          await fs.writeFile(fileDst, xmlString, {encoding: `utf8`});
          console.log(`${fileDst} generated`);
        } catch (error) {
          console.error(chalk.red(`Can't write file ${fileDst}. Skipping it.`));
        }
      } catch (error) {
        console.error(error);
        console.error(chalk.red(`Can't convert file ${entry} to XML. Skipping it.`));
      }
    } catch (error) {
      console.error(chalk.red(`Can't access file ${entry}. Skipping it.`));
    }
  }

  const propJson = {
    usage: `generic`,
    name: datasetName,
    type: 0,
    scenario: ``,
    prop_version: `PROP_VESION_1`,
    pre_process: ``,
    category_prop_info: `[]`,
    action_prop_info: `[]`,
    file_prop_info: JSON.stringify(files),
  };
  const propName = `prop.json`;
  const propDst = path.join(target, propName);
  await fs.writeFile(propDst, JSON.stringify(propJson), {encoding: `utf-8`});
};
