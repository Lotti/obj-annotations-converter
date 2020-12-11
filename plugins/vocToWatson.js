const path = require(`path`);
const fg = require(`fast-glob`);
const fs = require(`fs-extra`);
const xmlParser = require(`fast-xml-parser`);
const chalk = require(`chalk`);
const {between} = require(`../helpers/helpers`);

/**
 *
 * @param source
 * @param xmlData
 * @returns {string}
 */
const xmlToJson = (source, xmlData) => {
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

    // creating json from xml data
    if (jsonObj.annotation.object) {
        jsonObj.annotation.object = Array.isArray(jsonObj.annotation.object) ? jsonObj.annotation.object : [jsonObj.annotation.object];
    }

    const json = {
        updated: new Date().toISOString(),
        dimensions: {
            width: jsonObj.annotation.size.width,
            height: jsonObj.annotation.size.height
        },
        source: {
            type: `file`,
            filename: jsonObj.annotation.filename
        },
        created: new Date().toISOString(),
        image_id: jsonObj.annotation.source.database,
        training_data: {
            objects: [],
        }
    };

    if (jsonObj.annotation.object) {
        json.training_data.objects = jsonObj.annotation.object.map((o) => {
            return {
                object: o.name,
                location: {
                    left: between(o.bndbox.xmin, 0, jsonObj.annotation.size.width, true),
                    top: between(o.bndbox.ymin, 0, jsonObj.annotation.size.height, true),
                    width: between(o.bndbox.xmax - o.bndbox.xmin, 0, jsonObj.annotation.size.width, true),
                    height: between(o.bndbox.ymax - o.bndbox.ymin, 0, jsonObj.annotation.size.height, true),
                }
            };
        });
    }

    return JSON.stringify(json, null, 4);
};

/**
 *
 * @param source
 * @param target
 * @param globOptions
 * @returns {Promise<void>}
 */
module.exports = async (source, target, globOptions) => {
    const stream = fg.stream(path.join(source, `*.xml`), globOptions);
    for await (const entry of stream) {
        const fileName = `${path.basename(entry, `.xml`)}.json`;
        const fileDst = path.join(target, fileName);
        try {
            const data = await fs.readFile(entry, {encoding: `utf8`});
            try {
                const jsonString = xmlToJson(source, data);
                try {
                    await fs.writeFile(fileDst, jsonString, {encoding: `utf8`});
                    console.log(`${fileDst} generated`);
                } catch (error) {
                    console.error(chalk.red(`Can't write file ${fileDst}. Skipping it.`));
                }
            } catch (error) {
                console.error(error);
                console.error(chalk.red(`Can't convert file ${entry}. Skipping it.`));
            }
        } catch (error) {
            console.error(chalk.red(`Can't access file ${entry}. Skipping it.`));
        }
    }
};
