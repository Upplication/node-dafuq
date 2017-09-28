# dafuq

  A cli commands based API.

  [![NPM Version][npm-image]][npm-url]
  [![Build Status][travis-image]][travis-url]
  [![Test Coverage][coveralls-image]][coveralls-url]

[![dafuq][dafuq-logo]](http://i1.kym-cdn.com/photos/images/newsfeed/000/290/698/c3e.jpg)

dafuq allows you to create an API that executes files on the os command line (via `child_process.exec`) and returns the output generated through a JSON API.

## dafuq(opts)

### Options
* **commands**: Path where to look for commands to run on requests.
* **shebang** (optional): If specified, this will be the command line interpreter to be used when running the file. If it is not specified we will check the file for execution permisions and run it by itself. Defaults to `''`.
* **debug** (optional): Log debug function. A function that will used as loggin function instead of the default . Defaults to `debug('dafuq')`.
* **bearer** (optional): Add bearer token authorization method to the api. The acces token is provided as the value of this config. Defaults to `''`
* **timeout** (optional): Time to wait before killing an spawned command. Defaults to `0` which means infinite.
* **middlewares** (optional): Array of middleware functions that will be executed after the command has run but before sending the API respnse. See [middlewares](#middlewares)
* **env** (optional): Object of environment variables to set when executing the spawned commands.

### Example

Lets assume this is the structure of our commands directory.

```
commands/
├── bye
│   └── get.js
├── hello
│   ├── get.js
│   ├── index.js
│   ├── :name
│   │   └── get.js
│   └── post.js
└── no-exec
    └── all.js
```

```js
var express = require('express')
 ,  dafuq = require('dafuq')

var app = expres()
app.use('/api.cmd/', dafuq({
	commands: './commands',
	shebang: '/usr/bin/env node', // optional
	debug: true // optional
	bearer: 'y67x81eg-21od-eewg-ciey-d52f6crtcrqv'
}))
app.listen(3000)
```

With the previous express server we would be serving the following routes:
```
GET  /bye
GET  /hello/:name
GET  /hello
POST /hello
*    /no-exec
```

### CLI
dafuq also allows to be used as cli:
```
$ dafuq \
	--commands="./commands" \
	--port=8080 \ # Defaults to 3000
	--shebang="/usr/bin/env node" \ # Defaults to '' (direct terminal execution)
	--bearer="y67x81eg-21od-eewg-ciey-d52f6crtcrqv" # API will require bearer access token
	--debug
```

## Considerations

### Directory Structure
On init, dafuq searches for all the files named like an http method (with extension) and creates a route for that HTTP method at the path of the file.
Then, any request that reaches the server that matches one of the directories and method will trigger an execution of the file and return its output.

### Command arguments/parameters
Dafuq translates any parameter on the request to command line flags with double dash `--`. The request fields parsed as parmeters and its override order is as follows (upper means it will prevail in case of name clashing):
* Multipart files
* Multipart form fields
* Body fields: Can be URL encoded or JSON. Nested object structures will be flattened to a plain key-value object.
* URL params: (directories that start with `:`)
* Query Params
* Headers: (the ones starting with `X-Arg-`)

```
POST /hello/john?age=25&male HTTP/1.1
Content-Type: application/json
Content-Length: 100
X-Arg-username: jhon78

{
  "surname": "wick",
  "profession": "killer",
  "confirmedKills": [
    "target1",
    "target2"
  ],
  "ammo": {
    "usp": 12
    "ump": 25
  }
}

```
would be equivalent to the following command
```
./hello/\:name/get.sh \
    --name "john" \
    --surname "wick" \
    --username "jhon78" \
    --age "25" \
    --male \
    --profession "killer" \
    --confirmedKills.0 "target1" \
    --confirmedKills.1 "target2" \
    --ammo.usp "12" \
    --ammo.ump "25"
```

### Recieving Files
When a file is posted via multipart dafuq will pass the absolute path where the file has been temporary uploaded to the command via a flag with the name of the name of the file on the form.

```
POST /upload HTTP/1.1
Content-Type: multipart/form-data; boundary=----------------------
Content-Length: 554

------------------------
Content-Disposition: form-data; name="text"

text default
------------------------
Content-Disposition: form-data; name="file1"; filename="a.txt"
Content-Type: text/plain

Content of a.txt.

------------------------
Content-Disposition: form-data; name="file2"; filename="a.html"
Content-Type: text/html

<!DOCTYPE html><title>Content of a.html.</title>

--------------------------
```
would be equivalent to the following command
```
./upload/post.sh \
	--text "text default"
	--file1 /tmp/upload-1886474873587 \
	--file2 /tmp/upload-1886474873952
```

### Building the response
Once a command finishes running, the following checks happen

- **If execution exit code is 0**: Command [output](#detrmining-the-output) is [parsed](#parsing-the-output) and sent as the response.
- **If execution exit code is 1**: Command [output](#detrmining-the-output) is sent as a `text/plain` response.
- **If execution exit code is 11**: Command [output](#detrmining-the-output) is [parsed](#parsing-the-output) and returned as the response, the main difference here is this allows the command executions to be marked as failed but prevent them from generating a Internal server error (500).
- **If execution exit code is 10**: Command output is expected to be an absolute path that points to a file that will be sent as an attachment on the response.

#### Determining the output
The output of the command is taken from the `stderr` if any, and if not, from the `stdout`. Whatever the result is taken, the output is trimmed before passing it to further steps. **TODO:** Use stderr only if the execution is marked as failed.

#### Parsing the output
The response sent by the server will always be of the form:
```ts
{
  success: boolean,
  result?: string|object|array,
  message?: string,
}
```

The `result` property is determined as follows:
- If the output is JSON-parseable and contains a `success` field the whole output is considered the final response body to be sent to the client.
- If the output is JSON parseable: the parsed JSON object is assigned to `result`. The value of `success` is set based on the exit code, see [Building the response](#building-the-response).
- If the output is not JSON parseable: the output is set as a string on the `result` property. The value of `success` is set based on the exit code, see [Building the response](#building-the-response).

### Middlewares
Dafuq middleware functions are the same concept as express middlewares. These allow dafuq users to perform actions on the execution result **before** sending it to api consumers.
```js

/**
 * @typedef {object} res.dafuq
 * @property {string} type - based on the command exit code, can be "object"
 *                         or "file"
 * @property {string?} error - Output of the command after its execution was
 *                          determined to be a failure.
 * @property {object|string} output - Parsed output of the command.
 */

/** Log the dafuq execution error */
function loggingMiddleware(req, res, next) {
  /**
   * From now on, res.dafuq is defined, see {@link #res.dafuq}
   */

  // Log the execution information
  if (res.dafuq.error)
    logger.error(res.dafuq.error)
  else
    logger.info('type=', res.dafuq.type, 'output=', res.dafuq.output)

  // Don't forget to mark execution complete from within the middleware!
  next()
}
```

Dafuq middlewares are also allowed to change the dafuq response in any way or manner, **but be aware of execution failures**
```js
function adaptingMiddleware(req, res, next) {
  // If the execution was a failure res.dafuq will
  // only contain a non enumerable property called error, so
  // check that first!
  if (!res.dafuq.error) {
    const output = res.dafuq.output
    Object.assign(output, {
      // rename success to ok
      ok: output.success,
      success: undefined,
      // rename result to data
      data: output.result,
      result: undefined,
    })
    // Note: res.dafuq, res.dafuq.type, res.dafuq.output are non
    // writable, meaning that the following code WOULD FAIL on runtime
    res.dafuq.output = {
      ok: res.dafuq.output.success,
      data: res.dafuq.output.result,
    }
  }

  // Don't forget to mark execution complete from within the middleware!
  next()
}
```

## Motivation
Ok, so you just discovered a really neat tool/library but... *oh, oh* its written in **THAT LANGUAGE**. All your dreams of api-fing that thing just blew up because you just wanted to run a little few commands here and there.

This recently happened at @Upplication, and **that language** happened to be ruby. It's not that we don't like ruby, it's just we dont have anyone on the team who can or have the time and motivation to start learning about it *properly*. So we decided to implement this kind of solution.

## License
[MIT](LICENSE)

[dafuq-logo]: http://i1.kym-cdn.com/photos/images/newsfeed/000/290/698/c3e.jpg
[npm-image]: https://img.shields.io/npm/v/dafuq.svg
[npm-url]: https://npmjs.org/package/dafuq
[travis-image]: https://img.shields.io/travis/Upplication/node-dafuq/master.svg
[travis-url]:  https://travis-ci.org/Upplication/node-dafuq
[coveralls-image]: https://img.shields.io/coveralls/Upplication/node-dafuq/master.svg
[coveralls-url]: https://coveralls.io/r/Upplication/node-dafuq?branch=master
