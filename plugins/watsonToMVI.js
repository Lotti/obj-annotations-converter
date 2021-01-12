const path = require(`path`);
const normalize = require(`normalize-path`);
const fg = require(`fast-glob`);
const fs = require(`fs-extra`);
const chalk = require(`chalk`);
const xmlbuilder = require(`xmlbuilder`);
const { v4: uuidv4 } = require(`uuid`);
const {between} = require(`../helpers/helpers`);

/**
 *
 * @param source
 * @param json
 * @param id
 * @returns {string}
 */
const jsonToXML = (source, json, id) => {
    // creating xml file from json data
    const xml = xmlbuilder.create(`annotation`);
    const size = xml.ele(`size`);
    size.ele(`width`, {}, json.dimensions.width);
    size.ele(`height`, {}, json.dimensions.height);
    size.ele(`dept`, {}, 3);
    xml.ele(`segmented`, {}, 0);

    for (const o of json.training_data.objects) {
        const name = o.object.replace(/[-"/\\|[\]{}();:,]/g,`_`);
        const obj = xml.ele(`object`);
        obj.ele(`_id`, {}, uuidv4());
        obj.ele(`file_id`, {}, id);
        obj.ele(`name`, {}, name);
        obj.ele(`generate_type`, {}, `manual`);
        const bndbox = obj.ele(`bndbox`);
        bndbox.ele(`xmin`, {}, between(o.location.left, 0, json.dimensions.width, true));
        bndbox.ele(`ymin`, {}, between(o.location.top, 0, json.dimensions.height, true));
        bndbox.ele(`xmax`, {}, between(o.location.left + o.location.width, 0, json.dimensions.width, true));
        bndbox.ele(`ymax`, {}, between(o.location.top + o.location.height, 0, json.dimensions.height, true));
    }

    return xml.end({pretty: true});
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
    const stream = fg.stream(normalize(path.join(source, `*.json`)), globOptions);
    for await (const entry of stream) {
        const fileName = `${path.basename(entry.toString(), `.json`)}.xml`;
        const fileDst = path.join(target, fileName);
        try {
            const data = await fs.readFile(entry, {encoding: `utf8`});
            try {
                const json = JSON.parse(data);
                try {
                    const id = uuidv4();
                    const xmlString = jsonToXML(source, json, id);
                    files.push(mviEntry(id, json.source.filename));
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
                console.error(chalk.red(`Can't parse file ${entry}. Skipping it.`));
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
