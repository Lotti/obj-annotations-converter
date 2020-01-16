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

program
    .version(`0.1`)
    .usage(` --from watson --to voc --source . --target ./annotations`)
    .option(`--from <type>`, `Set annotation origin format [watson, voc]`, /^(watson|voc|ca)$/i, `watson`)
    .option(`--to <type>`, `Set annotation destination format [watson, voc]`, /^(watson|voc|ca)$/i, `voc`)
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
                        bndbox.ele(`xmin`, {}, o.location.left);
                        bndbox.ele(`ymin`, {}, o.location.top);
                        bndbox.ele(`xmax`, {}, o.location.left + o.location.width);
                        bndbox.ele(`ymax`, {}, o.location.top + o.location.height);
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
    const entries = fg.sync(path.join(program.source, `*.xml`), options);
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
                            objects: jsonObj.annotation.object && jsonObj.annotation.object.map((o) => {
                                return {
                                    object: o.name,
                                    location: {
                                        width: o.bndbox.xmax - o.bndbox.xmin,
                                        top: o.bndbox.ymin,
                                        height: o.bndbox.ymax - o.bndbox.ymin,
                                        left: o.bndbox.xmin
                                    }
                                };
                            })
                        }
                    };

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
    const entries = fg.sync(path.join(program.source, `*.json`), options);
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

                            try {
                                const size = await imageSize(filePath);
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
                                                    width: Math.round(o.x2 * size.width - o.x * size.width),
                                                    top: Math.round(o.y * size.height),
                                                    height: Math.round(o.y2 * size.height - o.y * size.height),
                                                    left: Math.round(o.x * size.width),
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
                                console.error(chalk.red(`Can't open file ${filePath}. Skipping it.`));
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
} else {
    console.error(chalk.bold.red(`Can't convert from ${program.from} to ${program.to}: case not supported!`));
    process.exit(1);
}
