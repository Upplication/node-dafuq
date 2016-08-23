#!/usr/bin/env node
var argv = require('yargs')
    .usage('$0 [name]')
    .example('$0 John', 'salutes John')
    .example('$0', 'salutes the world')
    .describe('name', 'the name to salute!')
    .default('name', 'World')
    .help('h')
    .alias('h', 'help')
    .argv;

console.log(`Hello ${ argv.name }`);