#!/usr/bin/env node
var fs = require('fs')
var argv = require('yargs')
	.usage('Shows the file path provied')
    .describe('file', 'a file path')
    .argv;

console.log(argv.file);