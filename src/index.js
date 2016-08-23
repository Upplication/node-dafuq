'use strict'

const fs = require('fs')
  ,   path = require('path')
  ,   assert = require('assert')
  ,   child_process = require('child_process')
  ,   glob = require('glob')
  ,   debug = require('debug')('dafuq')
  ,   express = require('express')
  ,   bodyParser = require('body-parser')

/**
 * @typedef DafuqPath
 * @type {object}
 * @property {string} absolute Absolute path pointing to a file
 * @property {string} relative Path to the same file pointed by absolute property,
 *                             but relative to the invoking script
 */

const moduleName = 'dafuq'

/**
 * Asserts the provided **absolute** path is a directory
 * 
 * @param  {String} path - the path to check if is a directory
 * @return {String} the provided path
 * @throws {AssertionError} If the path is not a directory
 */
function assertIsDirectory(path) {
    let dirStats;
    try {
        assert(fs.statSync(path).isDirectory(), `path ${path} is not a directory`)
    } catch(e) {
        const msg = `path ${path} does not exists or doesn't have proper permissions`
        debug(msg)
        assert(false, msg)
    }
    return path
}

/**
 * Glob pattern that matches all the files that would generate a route
 * @type {String}
 */
const globPattern = '**/+(all|get|post|put|delete|head|options).*'

/**
 * Returns the files at dir matching the given glob pattern
 * 
 * @param  {String} dir The directory to search for files
 * @param  {String} pattern A glob pattern that files must match
 * @return {DafuqPath[]} All the files that mattched the pattern at the given dir
 */
function findFilesAt(dir, pattern) {
    return glob.sync(path.join(dir, pattern), { nocase: true })
        .map(p => ({
            absolute: p,
            relative: path.relative(dir, p)
        }))
}

/**
 * Binary mask for files mode. Checks against user execution permision.
 * @type {number}
 */
const MASK_EXEC = parseInt('0100', 8)

/**
 * Returns true if the provided path can be executed, false otherwise
 * 
 * @param  {DafuqPath} path the path to check if is executable
 * @return {Boolean}     true if the path is executable, false otherwise
 */
function isExecutable(path) {
    let isExe
    try {
        const stats = fs.statSync(path.absolute)
        isExe = !!(stats.mode & MASK_EXEC)
    } catch(e) { isExe = false }
    if (!isExe)
        debug(`${ path.absolute } is not executable, ignoring`)
    return isExe
}

/**
 * Executes the specified command on the OS terminal and returns via cb the
 * response written to the stdout and stderr wrapped arround a JSON object.
 *
 * The result will always contain a field named succes that tells if the
 * command executed properly or not. A command is cosidered successful when
 * its exit code is 0 and no errors are thrown.
 *
 * The output of the command is considered in the following order, the first
 * one to match will be considered as the command output:
 * * The content of strderr if it is not empty
 * * The content of stdout if it is not empty
 * * The error message if the error was reported while using
 *  node's `child_process.exec`
 *
 * Finally, once the output is determined, we try to parse it as json. If
 * successful and the parsed JSON contains the success property the output
 * just generated will be treated as the result of the command execution.
 * If the JSON was correctly parsed but didn't contain any success field, the
 * result will be an object containing `success` and `result`, being result
 * the just parsed JSON.
 * If the output string couldn't be parsed as JSON, the result field will be
 * directly the string.
 *
 * @param  {String}   cmd Command to be executed via `child_process.exec`
 * @param  {Function} cb  Completion callback. The result object is passed as
 *                        only argument
 */
function execCommand(command, cb) {
    child_process.exec(command, function(err, stdout, stderr) {
        const code = err && err.code ? err.code : 0
        let result =  stderr || stdout || (err || {}).message
        if (result)
            result = result.trim()
        try {
            // Try to parse it as JSON
            const json = JSON.parse(result)
            result = json
        } catch(e) {
            // If an error occurs parsing the json, treat it as a string
            result = { result: result }
        }

        // If the result doesnt contain the field success, treat its
        // contents as the result part and add the succes field
        if (result.success === undefined) {
            result = {
                success: code === 0,
                result: result
            }
        }

        cb(result)
    })
}

function dafuq(opts) {

    debug('Building dafuq instance with %j', opts)
    // Allow constructor to be only the commands directory
    if (typeof opts === 'string')
        opts = { path: path }

    // Assign default values
    opts = Object.assign({
        shebang: '',
        intercept: () => {}
    }, opts)

    // Options validation

    // Valid string path is mandatory
    if (!opts.path || typeof opts.path !== 'string' || opts.path.length == 0)
        throw new TypeError('path must be a string pointing to the commands directory')

    // If shebang provided, but not valid
    if (opts.shebang && (typeof opts.shebang !== 'string' || opts.shebang.length == 0))
        throw new TypeError('shebang must be a non empty string')

    // If intercept provided, but not valid
    if (opts.intercept && (typeof opts.intercept !== 'function'))
        throw new TypeError('intercept must be a function')

    // Build an absolute path to the commands directory and assert it is actually a directory
    const commandsPath = path.resolve(path.dirname(module.parent.filename), opts.path)
    assertIsDirectory(commandsPath)

    // Find the files to be mounted as execution points
    let files = findFilesAt(commandsPath, globPattern)

    // If no shebang is specified, the file need to be executable by itself
    if (!opts.shebang)
        files = files.filter(isExecutable)

    const app = express()
    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())

    /**
     * Returns a middleware that once inkoed will execute the specified file and
     * put the result of its execution on response object in the property pointed
     * by moduleName.
     *
     * @param {String} file
     */
    function executionMiddleware(file) {
        return (req, res, next) => {
            // Build the base command
            let cmd = file
            if (opts.shebang)
                cmd = `${ opts.shebang } ${ cmd }`

            // Append all the parameters provided via query, params and body to the cmd
            // as cli configuration flags
            const flags = Object.assign({}, req.query, req.params, req.body)
            Object.keys(flags).forEach(function(flagName) {
                const flagValue = flags[flagName]
                cmd += ` --${flagName}`
                if (flagValue)
                    cmd += ` ${flagValue}`
            })

            debug(`$ ${cmd}`)
            execCommand(cmd, result => {
                Object.defineProperty(res, moduleName, { value: result })
                next()
            })
        }
    }

    // Add all the files routes
    files.forEach(file => {
        const filePath = file.relative
        const url = '/' + path.dirname(file.relative)
        const method = path.basename(filePath, path.extname(filePath))
        const middleware = executionMiddleware(file.absolute)
        debug(`Adding ${ method } ${ url }`)
        app[method](url, middleware)
    })

    // Allow library clients to do something with the responses rather
    // than the default behaviour
    opts.intercept(app)

    // Fallback behaviour, send the result as json
    app.all('*', (req, res, next) => {
        if (res[moduleName])
            res.type('json').json(res[moduleName])
        else
            res.status(404).send()
        next()
    })
    return app
}

module.exports = dafuq