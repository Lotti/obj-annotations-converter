const path = require(`path`);
const fg = require(`fast-glob`);
const fs = require(`fs-extra`);
const chalk = require(`chalk`);
const imageSize = require(`image-size`);
const {between} = require(`../helpers/helpers`);

/**
 *
 * @param file
 * @param fileName
 * @param annotations
 * @param entry
 * @returns {Promise<string>}
 */
const annotationToJson = async (file, fileName, annotations, entry) => {
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
                            left: between(o.x * size.width, 0, size.width, true),
                            top: between(o.y * size.height, 0, size.height, true),
                            width: between(o.x2 * size.width - o.x * size.width, 0, size.width, true),
                            height: between(o.y2 * size.height - o.y * size.height, 0, size.height, true),
                        }
                    };
                })
            }
        };
        return JSON.stringify(json, null, 4);
    } catch (error) {
        throw new Error(`Can't open file ${filePath}.`);
    }
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

                            try {
                                const fileName = path.basename(file, path.extname(file));
                                const jsonString = annotationToJson(file, fileName, annotations, entry);
                                const fileDst = path.join(target, `${fileName}.json`);
                                fs.writeFile(fileDst, jsonString, {encoding: `utf8`}, (err) => {
                                    if (err) {
                                        console.error(chalk.red(`Can't write file ${fileDst}. Skipping it.`));
                                    } else {
                                        console.log(`${fileDst} generated`);
                                    }
                                });
                            } catch (error) {
                                console.error(error);
                                console.error(chalk.red(`Can't write converted annotation for ${entry}. Skipping it.`));
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
};
