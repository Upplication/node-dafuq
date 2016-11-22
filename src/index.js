const fs = require('fs')
  ,   os = require('os')
  ,   path = require('path')
  ,   assert = require('assert')
  ,   child_process = require('child_process')
  ,   debug = require('debug')
  ,   glob = require('glob')
  ,   traverse = require('traverse')
  ,   express = require('express')
  ,   multer = require('multer')
  ,   bodyParser = require('body-parser')

const LOG = debug('dafuq')

const RESPONSE_RESULT_CONTAINER = 'dafuq'
const RESPONSE_RESULT_TYPE = 'type'
const RESPONSE_RESULT = 'result'

/**
 * @typedef DafuqPath
 * @type {object}
 * @property {string} absolute Absolute path pointing to a file
 * @property {string} relative Path to the same file pointed by absolute property,
 *                             but relative to the invoking script
 */

/**
 * Exit code that determines a file response should be used instead of JSON
 * @type {Number}
 */
const EXIT_CODE_FILE = 10

/**
 * Result types when executing a command
 * @type {String}
 */
const RESULT_TYPE_OBJECT = 'object'
const RESULT_TYPE_FILE = 'file'

/**
 * Asserts the provided **absolute** path is a directory
 * 
 * @param  {String} path - the path to check if is a directory
 * @return {String} the provided path
 * @throws {AssertionError} If the path is not a directory
 */
function assertIsDirectory(path) {
    let dirStats
    try {
        assert(fs.statSync(path).isDirectory(), `path ${path} is not a directory`)
    } catch(e) {
        const msg = `path ${path} does not exists or doesn't have proper permissions`
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
 * @param  {String} path the absolute path to check if is executable
 * @return {Boolean}     true if the path is executable, false otherwise
 */
function isExecutable(path) {
    try {
        const stats = fs.statSync(path)
        return !!(stats.mode & MASK_EXEC)
    } catch(e) { return false }        
}

/**
 * Matches and extracts the headers that would be used as commadn line params
 * @type {RegExp}
 */
const HEADER_X_ARG_REGEX = /^x-arg-(.*)$/i

/**
 * Builds the command line arguments string (--option1 value1 --option2) by
 * searching on the necessary request fields.
 *
 * The fields and order or prevailing is as follows:
 *  * Headers: Header fields that match {@link HEADER_X_ARG_REGEX}
 *  * Query Params
 *  * URL params
 *  * Body members
 *  * Multipart uploaded files
 *
 * @param  {Object} req - express request object
 * @return {String} The command options string
 */
function buildCommandFlags(req) {
    let cmdFlags = ''

    // Build headers object for later merge
    const headerFlags = Object.keys(req.headers).reduce((headers, header) => {
        const mtch = HEADER_X_ARG_REGEX.exec(header)
        if (mtch)
            headers[mtch[1]] = req.headers[header]
        return headers
    }, {})

    // Build files
    const uploadFlags = (req.files || []).reduce((files, file) => {
        files[file.fieldname] = file.path
        return files
    }, {})

    // Flatten the body
    const body = traverse(req.body).reduce(function(b, val) {
        if (this.notRoot && this.isLeaf)
            b[this.path.join('.')] = val
        return b
    }, {})

    const flags = Object.assign({}, headerFlags, req.query, req.params, body, uploadFlags)
    Object.keys(flags).forEach(function(flagName) {
        let flagValue = flags[flagName]
        cmdFlags += ` --${flagName}`
        if (flagValue !== undefined) {
            flagValue = String(flagValue)
                            .replace(/\\/g, '\\\\')
                            .replace(/"/g, '\\"')
            cmdFlags += ` "${flagValue}"`
        }
    })

    return cmdFlags
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
 * @param  {Function} cb  Completion callback. The result object and the
 *                        the result type are pased as arguments
 */
function execCommand(command, env, timeout, cb) {
    const child = child_process.exec(command,
        { env, timeout },
        (err, stdout, stderr) => {
            let code = 0
            if (err) {
                code = err.code || 1
                if (err.killed === true)
                    err = new Error('Command killed due timeout')
            }

            let result =  stderr || stdout || (err || {}).message
            let type = RESULT_TYPE_OBJECT

            if (result)
                result = result.trim()

            if (code === EXIT_CODE_FILE) {
                type = RESULT_TYPE_FILE
            } else {
                try {
                    // Try to parse it as JSON
                    const json = JSON.parse(result)
                    result = json
                } catch(e) {} // If an error occurs parsing the json leave it as it was

                // If the result doesn't contain the field success, treat its
                // contents as the result part and add the succes field
                if (result.success === undefined) {
                    var success = code === 0

                    result = {
                        success: success,
                        [ success ? 'result' : 'message' ]: result
                    }
                }
            }

            cb(result, type)
        }
    )
}

const HEADER_BEARER_REGEX = /^bearer (.*)$/i

/**
 * Returns a middleware that will reject the request with 401 if the
 * bearer token at the request does not match the token provided.
 *
 * @param  {String} token The token that the request must provide to continue
 * @return {Function}     Middleware function
 *
 * @see  {@link https://www.npmjs.com/package/express-bearer-token}
 * @see  {@link https://tools.ietf.org/html/rfc6750}
 */
function accessMiddleware(token) {
    return (req, res, next) => {
        let bearer = null
        if (req.body && req.body.access_token)
            bearer = req.body.access_token
        else if (req.query && req.query.access_token)
            bearer = req.query.access_token
        else if (req.headers && req.headers['authorization']) {
            const match = HEADER_BEARER_REGEX.exec(req.headers['authorization'])
            if (match)
                bearer = match[1]
        }

        if (bearer === token)
            next()
        else
            res.status(401).send()
    }
}

/**
 * Returns a middleware that will end the response sending
 * the result of the dafuq execution.
 *
 * @return {Function} Middleware function
 */
function resultMiddleware() {
    return (req, res, next) => {
        const result = res[RESPONSE_RESULT_CONTAINER][RESPONSE_RESULT]
          ,   type = res[RESPONSE_RESULT_CONTAINER][RESPONSE_RESULT_TYPE]

        res.set('X-Success', result.success !== false);

        if (type === RESULT_TYPE_OBJECT)
            res.type('json').json(result)
        else if (type === RESULT_TYPE_FILE)
            res.download(result)
        else // This shouldn't happen, but just in case
            res.status(500).send()
    }
}

export default function dafuq(config) {

    // Allow constructor to be only the commands directory
    if (typeof config === 'string')
        config = { path: path }

    // Assign default values
    const opts = Object.assign({
        shebang: '',
        debug: LOG,
        brearer: '',
        timeout: 0,
        middlewares: [],
        env: {}
    }, config)

    // Options validation

    // Valid string path is mandatory
    if (!opts.path || typeof opts.path !== 'string' || opts.path.length == 0)
        throw new TypeError('path must be a string pointing to the commands directory')

    // If shebang provided, but not valid
    if (opts.shebang && (typeof opts.shebang !== 'string' || opts.shebang.length == 0))
        throw new TypeError('shebang must be a non empty string')

    // If bearer provided, but not valid
    if (opts.bearer && (typeof opts.bearer !== 'string' || opts.bearer.length == 0))
        throw new TypeError('bearer must be a non empty string')

    // If timeout provided, but not valid
    if (opts.timeout && (typeof opts.timeout !== 'number'))
        throw new TypeError('timeout must be a number')

    // If middlewares provided, but not valid
    if (opts.middlewares !== undefined && !Array.isArray(opts.middlewares))
        throw new TypeError('middlewares must be a an array')

    // If env provided, but not valid
    if (opts.env !== undefined && (Array.isArray(opts.env) || typeof opts.env !== 'object'))
        throw new TypeError('env must be a an object')

    if (opts.debug !== undefined && typeof opts.debug !== 'function')
        throw new TypeError('debug must be a logging function')

    opts.debug('Building dafuq instance with %j', config)

    // Build an absolute path to the commands directory and assert it is actually a directory
    const commandsPath = path.resolve(path.dirname(module.parent.filename), opts.path)
    assertIsDirectory(commandsPath)

    // Find the files to be mounted as execution points
    let files = findFilesAt(commandsPath, globPattern)

    // If no shebang is specified, the file need to be executable by itself
    if (!opts.shebang) {
        files = files.filter(file => {
            const isExe = isExecutable(file.absolute)
            if (!isExe)
                opts.debug(`${ file.absolute } is not executable, ignoring`)
            return isExe
        })
    }

    const app = express()
    const upload = multer({ dest: os.tmpdir() })

    app.use(bodyParser.urlencoded({ extended: false }))
    app.use(bodyParser.json())

    /**
     * Returns a middleware that once inkoed will execute the specified file and
     * put the result of its execution on response object in the property pointed
     * by moduleName.
     *
     * @param  {String} file
     * @return {Function}     Middleware function
     */
    function executionMiddleware(file) {
        return (req, res, next) => {
            // Initialize the dafuq result container
            Object.defineProperty(res, RESPONSE_RESULT_CONTAINER, { value: {} })

            // Build the base command
            let cmd = file.replace(/\s/g, '\\ ') // Escape blanks on the file path
            if (opts.shebang)
                cmd = `${ opts.shebang } ${ cmd }`
            /*
             Append all the parameters provided via:
                * query params
                * url params
                * body members
                * x-args headers
            */
            cmd += buildCommandFlags(req)

            // Merge both, current env and added keys
            const env = Object.assign({}, process.env, opts.env)

            opts.debug(`$ ${cmd}`)
            execCommand(cmd, env, opts.timeout, (result, type) => {
                Object.defineProperty(res[RESPONSE_RESULT_CONTAINER], RESPONSE_RESULT_TYPE, {
                    enumerable: true,
                    value: type
                })
                Object.defineProperty(res[RESPONSE_RESULT_CONTAINER], RESPONSE_RESULT, {
                    enumerable: true,
                    value: result
                })
                next()
            })
        }
    }

    // Add all the files routes
    files.forEach(file => {
        const filePath = file.relative
        const url = '/' + path.dirname(file.relative)
        const method = path.basename(filePath, path.extname(filePath)).toLowerCase()
        const middlewares = []

        // If bearer is defined, add an access middleware
        if (opts.bearer)
            middlewares.push(accessMiddleware(opts.bearer))

        // If the method is not any of the "get" methods add the multipart
        // upload middleware
        if (method !== 'get' && method !== 'head' && method !== 'options')
            middlewares.push(upload.any())

        middlewares.push(executionMiddleware(file.absolute))
        // Allow clients to do something with the responses before sending it
        middlewares.push(...opts.middlewares)
        middlewares.push(resultMiddleware())

        opts.debug(`Adding ${ method } ${ url }`)
        app[method](url, ...middlewares)
    })

    return app
}
