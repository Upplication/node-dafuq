#!/usr/bin/env node
var fs = require('fs')
var argv = require('yargs')
	.usage('Shows the content of the file')
    .describe('file', 'the file to analyze')
    .argv;

console.log(fs.readFileSync(argv.file, 'utf-8'));