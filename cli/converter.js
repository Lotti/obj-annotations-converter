#!/usr/bin/env node

require(`dotenv`).config();
const path = require(`path`);
const log4js = require(`log4js`);
log4js.configure(path.join(__dirname, `..`, `log4js.json`));
const program = require(`commander`);
const log = log4js.getLogger(`converter`);
const fg = require(`fast-glob`);
const fs = require(`fs-extra`);
const xmlbuilder = require(`xmlbuilder`);

program
    .version(`0.1`)
    .usage(`--path . --target ./annotations --from watson --to voc`)
    .option(`--from <type>`, `Set annotation origin format [watson, voc]`, /^(watson|voc)$/i, `watson`)
    .option(`--to <type>`, `Set annotation destination format [watson, voc]`, /^(watson|voc)$/i, `voc`)
    .option(`--source <src>`, `origin directory`)
    .option(`--target <dst>`, `target directory`)
    .parse(process.argv);

if (program.from === program.to) {
    log.fatal(`Can't proceed with same format as origin and destination`);
    process.exit(1);
}

let source = process.cwd();
if (program.source) {
    source = path.resolve(program.source);
}

let target = process.cwd();
if (program.target) {
    target = path.resolve(program.target);
}

try {
    if (!fs.lstatSync(source).isDirectory()) {
        log.fatal(`Path source ${source} must be a directory`);
        process.exit(1);
    }
} catch (error) {
    log.fatal(`Path source ${source} doesn't exists!`);
    process.exit(1);
}

try {
    if (!fs.lstatSync(target).isDirectory()) {
        log.fatal(`Path target ${target} must be a directory`);
        process.exit(1);
    }
} catch (error) {
    log.warn(`Path target ${target} doesn't exists, creating it...`);
    fs.ensureDirSync(target);
}

const options = {onlyFiles: true, deep: 0, absolute: true};

if (program.from === `watson` && program.to === `voc`) {
    const entries = fg.sync(path.join(source, `*.json`), options);
    log.info(`Found ${entries.length} entries.`);
    let i = 0;
    for (const entry of entries) {
        fs.readFile(entry, {encoding: `utf8`}, (err, data) => {
            if (err) {
                log.error(`Can't access file ${entry}. Skipping it.`);
            } else {
                try {
                    const json = JSON.parse(data);

                    const xml = xmlbuilder.create(`annotation`);
                    xml.ele(`folder`, {}, 'Unspecified');
                    xml.ele(`filename`, {}, json.source.filename);
                    xml.ele(`path`, {}, path.join(source, json.source.filename));
                    xml.ele(`source`).ele(`database`, {}, json.image_id);
                    const size = xml.ele(`size`);
                    size.ele('width', {}, json.dimensions.width);
                    size.ele('height', {}, json.dimensions.height);
                    size.ele('dept', {}, 3);
                    xml.ele(`segmented`, {}, 0);

                    for (const o of json.training_data.objects) {
                        const obj = xml.ele(`object`);
                        obj.ele('name', {}, o.object);
                        obj.ele('pose', {}, 'Unspecified');
                        obj.ele('truncated', {}, 0);
                        obj.ele('difficult', {}, 0);
                        const bndbox = obj.ele('bndbox');
                        bndbox.ele('xmin', {}, o.location.left);
                        bndbox.ele('ymin', {}, o.location.top);
                        bndbox.ele('xmax', {}, o.location.left + o.location.width);
                        bndbox.ele('ymax', {}, o.location.top + o.location.height);
                    }

                    const fileName = `${path.basename(entry, `.json`)}.xml`;
                    const fileDst = path.join(target, fileName);
                    const xmlString = xml.end({pretty: true});
                    fs.writeFile(fileDst, xmlString, {encoding: `utf8`}, (err) => {
                        if (err) {
                            log.error(`Can't write file ${fileDst}. Skipping it.`);
                        } else {
                            i++;
                            log.info(`${fileDst} generated`);
                        }
                    });
                } catch (error) {
                    log.error(`Can't parse file ${entry}. Skipping it.`);
                    log.error(error);
                }
            }
        });
    }
} else if (program.from === `voc` && program.to === `watson`) {
    const entries = fg.sync(path.join(program.source, `*.xml`), options);
    for (const entry of entries) {
        log.info(entry);
    }
} else {
    log.fatal(`Can't convert from ${program.from} to ${program.to}: case not supported!`);
    process.exit(1);
}
