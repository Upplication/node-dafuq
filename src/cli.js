#!/usr/bin/env node
var path = require('path')
var express = require('express')
var app = express()
var dafuq = require('./')

var argv = require('yargs')
    .usage('$0 Leverages command-based api')
    .describe('commands', 'the path to commands directory')
    .alias('commands', 'c')
    .alias('commands', 'path')
    .alias('commands', 'directory')
    .demand('commands')
    .describe('shebang', 'the interpreter to use when running the command files')
    .default('shebang', '')
    .describe('port', 'the port where to listen for api call')
    .alias('port', 'p')
    .default('port', 3000)
    .help('help')
    .alias('help', 'h')
    .argv;

// Resolve full path when executing via CLI
if (require.main === module)
    argv.commands = path.resolve(process.pwd(), argv.commands)

app.use(dafuq({
    path: argv.commands,
    shebang: argv.shebang
}))
app.listen(argv.port)
