const path = require(`path`);
const normalize = require('normalize-path');
const fg = require(`fast-glob`);
const fs = require(`fs-extra`);
const chalk = require(`chalk`);
const imageSize = require(`image-size`);
const xmlbuilder = require(`xmlbuilder`);
const {v4: uuidv4} = require(`uuid`);
const {between} = require(`../helpers/helpers`);

/**
 *
 * @param source
 * @param json
 * @param id
 * @returns {string}
 */
const jsonToXML = async (source, json, id) => {
    const filePath = path.join(source, json.filename);
    const exists = await fs.exists(filePath);
    if (!exists) {
        console.log(source, filePath);
        throw new Error(`Cannot find file ${json.filename}. Please provide also the image inside source directory!`);
    }

    const dimensions = await imageSize(filePath);

    // creating xml file from json data
    const xml = xmlbuilder.create(`annotation`);
    const size = xml.ele(`size`);
    size.ele(`width`, {}, dimensions.width);
    size.ele(`height`, {}, dimensions.height);
    size.ele(`dept`, {}, 3);
    xml.ele(`segmented`, {}, 0);

    for (const r of json.regions) {
        const name = r.region_attributes.annotazioni.replace(/[-"/\\|[\]{}();:,]/g,`_`);
        const obj = xml.ele(`object`);
        obj.ele(`_id`, {}, uuidv4());
        obj.ele(`file_id`, {}, id);
        obj.ele(`name`, {}, name);
        obj.ele(`generate_type`, {}, `manual`);

        const xmin = Math.min(...r.shape_attributes.all_points_x);
        const xmax = Math.max(...r.shape_attributes.all_points_x);
        const ymin = Math.min(...r.shape_attributes.all_points_y);
        const ymax = Math.max(...r.shape_attributes.all_points_y);

        const bndbox = obj.ele(`bndbox`);
        bndbox.ele(`xmin`, {}, between(xmin, 0, dimensions.width, true));
        bndbox.ele(`ymin`, {}, between(ymin, 0, dimensions.height, true));
        bndbox.ele(`xmax`, {}, between(xmax, 0, dimensions.width, true));
        bndbox.ele(`ymax`, {}, between(ymax, 0, dimensions.height, true));

        const polygons = obj.ele(`segment_polygons`);
        const polygon = polygons.ele(`polygon`);
        for (let i = 0; i < r.shape_attributes.all_points_x.length; i++) {
            const x = r.shape_attributes.all_points_x[i];
            const y = r.shape_attributes.all_points_y[i];

            const point = polygon.ele(`point`);
            point.ele(`value`, {}, between(x, 0, dimensions.width, true));
            point.ele(`value`, {}, between(y, 0, dimensions.height, true));
        }
    }

    const fileName = path.basename(json.filename, path.extname(json.filename));
    return {xmlString: xml.end({pretty: true}), fileName: `${fileName}.xml`};
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
        try {
            const data = await fs.readJson(entry);
            const items = Object.values(data);
            for (const json of items) {
                try {
                    const id = uuidv4();
                    const {xmlString, fileName} = await jsonToXML(source, json, id);
                    files.push(mviEntry(id, json.filename));
                    const fileDst = path.join(target, fileName);
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
