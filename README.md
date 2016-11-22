# dafuq

  A cli commands based API.

  [![NPM Version][npm-image]][npm-url]
  [![Build Status][travis-image]][travis-url]
  [![Test Coverage][coveralls-image]][coveralls-url]

[![dafuq][dafuq-logo]](http://i1.kym-cdn.com/photos/images/newsfeed/000/290/698/c3e.jpg)

dafuq allows you to create an api that executes files on the os command line (via `child_process.exec`) and returns the output generated through a JSON API.

## dafuq(opts)

### Options
* **commands**: Path where to look for commands to run on requests.
* **shebang** (optional): If specified, this will be the command line interpreter to be used when running the file. If it is not specified we will check the file for execution permisions and run it by itself. Defaults to `''`.
* **debug** (optional): Log debug function. A function that will used as loggin function instead of the default . Defaults to `debug('dafuq')`.
* **bearer** (optional): Add bearer token authorization method to the api. The acces token is provided as the value of this config. Defaults to ''
* **timeout** (optional): Time to wait before killing an spawned command. Defaults to `0` which means infinite.
* **middlewares** (optional): Array of middlewares that will be executed after the command has run but before sending the api respnse. The response object has a `dafuq` property containing `result` and `type` properties with the result of the execution.
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
On init, dafuq searches for all the files named like an http method (with extension) and creates a route for that method at the path of the file.
Then, any request that reaches the server and matches one of the directories and method will trigger an execution of the file and return its output.

### Command arguments/parameters
Dafuq translates any parameter on the request to command line flags with double dash `--`. The request fields searched for parmeters and its override order is as follows (upper means it will prevail in case of name clashing):
* Multipart files
* Multipart form fields
* Body fields: Can be URL encoded or JSON. Multilevel object structures will be flattened full path key
* URL params: (parts of the url that start with `:`)
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

### Building the resposne
If the exit code of the command was different from 0 it will be taken as unsuccessful (almost every time, see [Sending a file]).

When a command is ran the output will be determined by this steps:
* **If the output of the command is parseable as JSON and contains a success property**: the whole command output is considered the final response that will be sent, ignoring the previous success value.
* **Else if success was `true`**: The output of the command is placed on a `result` property. If the output was *JSON-parseable*, it will be parsed.
* **Else if success was `false`**: The output of the command is placed on a `message` property. If the output was *JSON-parseable*, it will be parsed.

Also, the success value is added to the header `X-Success`.

### Sending a file
There is an exception to the [Building the response] description. If the command exits with an exit code equal to `10` dafuq assumes you want to return a file instead of a JSON. In this case the output of your command should be **strictly** and **only** the absolute path you want to serve. Don't worry about breaklines or blankspaces, the output will be trimmed before working with it.

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
