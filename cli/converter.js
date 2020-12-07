#!/usr/bin/env node
require(`dotenv`).config();
const path = require(`path`);
const program = require(`commander`);
const chalk = require(`chalk`);
const fs = require(`fs-extra`);
const watsonToVoc = require('../plugins/watsonToVoc');
const watsonToCa = require('../plugins/watsonToCa');
const vocToWatson = require('../plugins/vocToWatson');
const caToWatson = require('../plugins/caToWatson');
const watsonToMVI = require('../plugins/watsonToMVI');
// const vocToMVI = require('../plugins/vocToMVI');

program.version(`0.2`)
    .usage(` --from watson --to voc --source . --target ./annotations`)
    .option(`--from <type>`, `Set annotation origin format [watson, voc, ca]`, /^(watson|voc|ca)$/, `watson`)
    .option(`--to <type>`, `Set annotation destination format [watson, voc, ca, mvi]`, /^(watson|voc|ca|mvi)$/, `voc`)
    .option(`--source <src>`, `origin directory`)
    .option(`--target <dst>`, `target directory`)
    .option(`--dataset <name>`, `dataset name`, ``)
    .parse(process.argv);

if (program.from === program.to) {
    console.error(chalk.bold.red(`Can't proceed with same format as origin and destination`));
    process.exit(1);
}

if (program.to === 'mvi' && program.dataset.length === 0) {
    console.error(chalk.bold.red(`You must provide a dataset name using parameter --dataset for MVI`));
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

const globOptions = {onlyFiles: true, deep: 0, absolute: true};
const main = async (source, target, globOptions) => {
    if (program.from === `watson` && program.to === `mvi`) {
        await watsonToMVI(source, target, globOptions, program.dataset);
    } else if (program.from === `voc` && program.to === `mvi`) {
        await vocToMVI(source, target, globOptions);
    } else if (program.from === `watson` && program.to === `voc`) {
        await watsonToVoc(source, target, globOptions);
    } else if (program.from === `voc` && program.to === `watson`) {
        await vocToWatson(source, target, globOptions);
    } else if (program.from === `ca` && program.to === `watson`) {
        await caToWatson(source, target, globOptions);
    } else if (program.from === `watson` && program.to === `ca`) {
        await watsonToCa(source, target, globOptions);
    } else {
        throw new Error(`Can't convert from ${program.from} to ${program.to}: case not supported!`)
    }
}

main(source, target, globOptions).then(() => {
    console.log(chalk.bold.green(`Done!`));
}).catch((error) => {
    console.error(chalk.bold.red(error.message));
    process.exit(1);
});