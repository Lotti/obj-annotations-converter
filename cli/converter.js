#!/usr/bin/env node

require(`dotenv`).config();
const path = require(`path`);
const program = require(`commander`);
const chalk = require(`chalk`);
const fg = require(`fast-glob`);
const fs = require(`fs-extra`);
const xmlbuilder = require(`xmlbuilder`);
const xmlParser = require(`fast-xml-parser`);
const imageSize = require('image-size');
const uuidv4 = require('uuid/v4');
const {between} = require('../helpers/helpers');

program
    .version(`0.2`)
    .usage(` --from watson --to voc --source . --target ./annotations`)
    .option(`--from <type>`, `Set annotation origin format [watson, voc, ca]`, /^(watson|voc|ca)$/i, `watson`)
    .option(`--to <type>`, `Set annotation destination format [watson, voc, ca]`, /^(watson|voc|ca)$/i, `voc`)
    .option(`--source <src>`, `origin directory`)
    .option(`--target <dst>`, `target directory`)
    .parse(process.argv);

if (program.from === program.to) {
    console.error(chalk.bold.red(`Can't proceed with same format as origin and destination`));
    process.exit(1);
}

let source = process.cwd();
if (program.source) {
    source = path.resolve(program.source);
}

let target = process.cwd();
if (!program.target && program.source) {
    target = path.resolve(program.source);
} else if (program.target) {
    target = path.resolve(program.target);
}

try {
    if (!fs.lstatSync(source).isDirectory()) {
        console.error(chalk.bold.red(`Path source ${source} must be a directory`));
        process.exit(1);
    }
} catch (error) {
    console.error(chalk.bold.red(`Path source ${source} doesn't exists!`));
    process.exit(1);
}

try {
    if (!fs.lstatSync(target).isDirectory()) {
        console.error(chalk.bold.red(`Path target ${target} must be a directory`));
        process.exit(1);
    }
} catch (error) {
    console.warn(chalk.yellowBright(`Path target ${target} doesn't exists, creating it...`));
    fs.ensureDirSync(target);
}

const options = {onlyFiles: true, deep: 0, absolute: true};

if (program.from === `watson` && program.to === `voc`) {
    const entries = fg.sync(path.join(source, `*.json`), options);
    console.log(chalk.green(`Found ${entries.length} entries.`));
    let i = 0;
    for (const entry of entries) {
        fs.readFile(entry, {encoding: `utf8`}, (err, data) => {
            if (err) {
                console.error(chalk.red(`Can't access file ${entry}. Skipping it.`));
            } else {
                try {
                    const json = JSON.parse(data);

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

                    // writing xml file
                    const fileName = `${path.basename(entry, `.json`)}.xml`;
                    const fileDst = path.join(target, fileName);
                    const xmlString = xml.end({pretty: true});
                    fs.writeFile(fileDst, xmlString, {encoding: `utf8`}, (err) => {
                        if (err) {
                            console.error(chalk.red(`Can't write file ${fileDst}. Skipping it.`));
                        } else {
                            i++;
                            console.log(`${fileDst} generated`);
                        }
                    });
                } catch (error) {
                    console.error(chalk.red(`Can't parse file ${entry}. Skipping it.`));
                }
            }
        });
    }
} else if (program.from === `voc` && program.to === `watson`) {
    const entries = fg.sync(path.join(source, `*.xml`), options);
    console.log(chalk.green(`Found ${entries.length} entries.`));
    let i = 0;
    for (const entry of entries) {
        fs.readFile(entry, {encoding: `utf8`}, (err, xmlData) => {
            if (err) {
                console.error(chalk.red(`Can't access file ${entry}. Skipping it.`));
            } else {
                try {
                    // parsing xml file
                    var options = {
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
                        console.error(chalk.red(`Can't parse file ${entry}. Skipping it.`));
                        return;
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

                    // writing json
                    const fileName = `${path.basename(entry, `.xml`)}.json`;
                    const fileDst = path.join(target, fileName);
                    const jsonString = JSON.stringify(json, null, 4);
                    fs.writeFile(fileDst, jsonString, {encoding: `utf8`}, (err) => {
                        if (err) {
                            console.error(chalk.red(`Can't write file ${fileDst}. Skipping it.`));
                        } else {
                            i++;
                            console.log(`${fileDst} generated`);
                        }
                    });
                } catch (error) {
                    console.error(error);
                    console.error(chalk.red(`Can't convert file ${entry}. Skipping it.`));
                }
            }
        });
    }
} else if (program.from === `ca` && program.to === `watson`) {
    const entries = fg.sync(path.join(source, `*.json`), options);
    console.log(chalk.green(`Found ${entries.length} entries.`));
    let i = 0;
    for (const entry of entries) {
        fs.readFile(entry, {encoding: `utf8`}, async (err, data) => {
            if (err) {
                console.error(chalk.red(`Can't access file ${entry}. Skipping it.`));
            } else {
                try {
                    const jsonObj = JSON.parse(data);

                    if (!jsonObj.annotations) {
                        console.error(`Can't find field "annotations" in file ${entry}`);
                    } else {

                        const keys = Object.keys(jsonObj.annotations);

                        for (const k of keys) {
                            const file = k;
                            const annotations = jsonObj.annotations[k];
                            const fileName = path.basename(file, path.extname(file));
                            const filePath = path.join(path.dirname(entry), file);

                            let size;
                            try {
                                size = await imageSize(filePath);
                            } catch (error) {
                                console.error(chalk.red(`Can't open file ${filePath}. Skipping it.`));
                                continue;
                            }

                            try {
                                const json = {
                                    updated: new Date().toISOString(),
                                    dimensions: {
                                        width: size.width,
                                        height: size.height,
                                    },
                                    source: {
                                        type: `file`,
                                        filename: file,
                                    },
                                    created: new Date().toISOString(),
                                    image_id: fileName,
                                    training_data: {
                                        objects: annotations.map((o) => {
                                            return {
                                                object: o.label,
                                                location: {
                                                    left: between(o.x * size.width, 0, size.width, true),
                                                    top: between(o.y * size.height, 0, size.height, true),
                                                    width: between(o.x2 * size.width - o.x * size.width, 0, size.width, true),
                                                    height: between(o.y2 * size.height - o.y * size.height, 0, size.height, true),
                                                }
                                            };
                                        })
                                    }
                                };

                                // writing json
                                const fileDst = path.join(target, `${fileName}.json`);
                                const jsonString = JSON.stringify(json, null, 4);
                                fs.writeFile(fileDst, jsonString, {encoding: `utf8`}, (err) => {
                                    if (err) {
                                        console.error(chalk.red(`Can't write file ${fileDst}. Skipping it.`));
                                    } else {
                                        i++;
                                        console.log(`${fileDst} generated`);
                                    }
                                });
                            } catch (error) {
                                console.error(error);
                                console.error(chalk.red(`Can't write converted annotation for ${filePath}. Skipping it.`));
                            }
                        }
                    }
                } catch (error) {
                    console.error(error);
                    console.error(chalk.red(`Can't convert file ${entry}. Skipping it.`));
                }
            }
        });
    }
} else if (program.from === `watson` && program.to === `ca`) {
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
                    labels.push(o.object);

                    if (!annotations[filename]) {
                        annotations[filename] = [];
                    }
                    annotations[filename].push({
                        x: between(o.location.left / json.dimensions.width, 0, 1, false),
                        y: between(o.location.top / json.dimensions.height, 0, 1, false),
                        x2: between((o.location.left + o.location.width) / json.dimensions.width, 0, 1, false),
                        y2: between((o.location.top + o.location.height) / json.dimensions.height, 0, 1, false),
                        id: uuidv4(),
                        label: o.object,
                    });
                }
            }
        }

        return {
            version: '1.0',
            type: 'localization',
            labels: labels.filter((value, index, self) => self.indexOf(value) === index),
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
} else {
    console.error(chalk.bold.red(`Can't convert from ${program.from} to ${program.to}: case not supported!`));
    process.exit(1);
}
