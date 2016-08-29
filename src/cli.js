#!/usr/bin/env node
const path = require('path')
  ,   express = require('express')
  ,   app = express()
  ,   dafuq = require('./')

var argv = require('yargs')
    .usage('$0 Leverages a command-based api')
    .describe('commands', 'the path to commands directory')
    // commands
    .alias('commands', 'c')
    .alias('commands', 'path')
    .alias('commands', 'directory')
    .demand('commands')
    // shebang
    .describe('shebang', 'the interpreter to use when running the command files')
    .default('shebang', '')
    // bearer
    .describe('bearer', 'an access token that must be provided on the requests to the api')
    .default('bearer', '')
    // port
    .describe('port', 'the port where to listen for api call')
    .alias('port', 'p')
    .default('port', 3000)
    // debug
    .describe('debug', 'show debug and trace output when running')
    .boolean('debug')
    .alias('debug', 'd')
    .default('debug', false)
    // help
    .help('help')
    .alias('help', 'h')
    .version()
    .alias('version', 'v')
    .argv;

// Resolve full path when executing via CLI
if (require.main === module)
    argv.commands = path.resolve(process.cwd(), argv.commands)

app.use(dafuq({
    path: argv.commands,
    shebang: argv.shebang,
    debug: argv.debug
}))
app.listen(argv.port)
