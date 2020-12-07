const path = require(`path`);
const fg = require(`fast-glob`);
const fs = require(`fs-extra`);
const chalk = require(`chalk`);
const xmlbuilder = require(`xmlbuilder`);
const {between} = require(`../helpers/helpers`);

/**
 *
 * @param source
 * @param json
 * @returns {string}
 */
const jsonToXML = (source, json) => {
// creating xml file from json data
    const xml = xmlbuilder.create(`annotation`);
    xml.ele(`folder`, {}, `Unspecified`);
    xml.ele(`filename`, {}, json.source.filename);
    xml.ele(`path`, {}, path.join(source, json.source.filename));
    xml.ele(`source`).ele(`database`, {}, json.image_id);
    const size = xml.ele(`size`);
    size.ele(`width`, {}, json.dimensions.width);
    size.ele(`height`, {}, json.dimensions.height);
    size.ele(`dept`, {}, 3);
    xml.ele(`segmented`, {}, 0);

    for (const o of json.training_data.objects) {
        const obj = xml.ele(`object`);
        obj.ele(`name`, {}, o.object);
        obj.ele(`pose`, {}, `Unspecified`);
        obj.ele(`truncated`, {}, 0);
        obj.ele(`difficult`, {}, 0);
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
 * @param source
 * @param target
 * @param globOptions
 * @returns {Promise<void>}
 */
module.exports = async (source, target, globOptions) => {
    const stream = fg.stream(path.join(source, `*.json`), globOptions);
    for await (const entry of stream) {
        const fileName = `${path.basename(entry.toString(), `.json`)}.xml`;
        const fileDst = path.join(target, fileName);
        try {
            const data = await fs.readFile(entry, {encoding: `utf8`});
            try {
                const json = JSON.parse(data);
                try {
                    const xmlString = jsonToXML(source, json);
                    try {
                        await fs.writeFile(fileDst, xmlString, {encoding: `utf8`});
                        console.log(`${fileDst} generated`);
                    } catch (error) {
                        console.error(chalk.red(`Can't write file ${fileDst}. Skipping it.`));
                    }
                } catch (error) {
                    console.error(chalk.red(`Can't convert file ${entry} to XML. Skipping it.`));
                }
            } catch (error) {
                console.error(chalk.red(`Can't parse file ${entry}. Skipping it.`));
            }
        } catch (error) {
            console.error(chalk.red(`Can't access file ${entry}. Skipping it.`));
        }
    }
};
