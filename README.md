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
* **shebang** (optional): If specified, this will be the command line interpreter to be used when running the file. If it is not specified we will check the file for execution permisions and run it by itself. Defaults to ''.
* **debug** (optional): Show debug info. If true, `console.log` will be used as loggin function. If a function it will used as loggin function instead of the default . Defaults to `false`.

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
$ dafuq --commands="./commands" [--port=3000] [--shebang="/usr/bin/env node"] [--debug]
```

## Considerations

### Directory Structure
On init, dafuq searches for all the files named like an http method (with extension) and creates a route for that method at the path of the file.
Then, any request that reaches the server and matches one of the directories and method will trigger an execution of the file and return its output.

### Command arguments/parameters
Dafuq translates any parameter on the request to command line flags with double dash `--`. The request fields searched for parmeters and its override order is as follows (upper means it will prevail in case of name clashing):
* Multipart files
* Multipart form fields
* Body fields
* URL params: (parts of the url that start with `:`)
* Query Params
* Headers: (the ones starting with `X-Arg-`)

```
POST /hello/john?age=12&male HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Content-Length: 100
X-Arg-username: jhon78

surname=wick&profession=killer
```
would be equivalent to the following command
```
'./hello/:name/get.sh' \
	--name john \
	--surname wick \
	--username username \
	--age 12 \
	--male \
	--profession killer
```

### Building the resposne
If the exit code of the command was different from 0 it will be taken as unsuccessful.

When a command is run the output will be determined by this steps:
* If the output of the command is a JSON
  * and contains a success property: the whole content is considered the final response that will be sent, ignoring the previous
	success value.
  * and doesn't contain a success property: The output will be placed in a `result` property in an object that also contains the
	previous success value.
* If the output of the command is NOT a JSON: The output will be placed in a `result` property in an object that also contains the
previous success value.


## Motivation
Ok, so you just discovered a really neat tool/library but... *oh, oh* its written in **THAT LANGUAGE**. All your dreams of api-fing that thing just blew up because you just wanted to run a little few commands here and there.

This recently happened at @Upplication, and **that language** happened to be ruby. It's not that we don't like ruby, it's just we dont have anyone on the team who can or have the time and motivation to start learning about it *properly*. So we decided to implement this kind of solution.

## License
[MIT](LICENSE)

[dafuq-logo]: http://i1.kym-cdn.com/photos/images/newsfeed/000/290/698/c3e.jpg
[npm-image]: https://img.shields.io/npm/v/dafuq.svg
[npm-url]: https://npmjs.org/package/dafuq
[travis-image]: https://img.shields.io/travis/upplication/node-dafuq/master.svg
[travis-url]:  https://travis-ci.org/upplication/node-dafuq
[coveralls-image]: https://img.shields.io/coveralls/upplication/node-dafuq/master.svg
[coveralls-url]: https://coveralls.io/r/upplication/node-dafuq?branch=master
