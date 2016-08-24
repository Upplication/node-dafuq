# dafuq?

A cli commands based API.

dafuq allows you to create an api that executes files on the os command line (via `child_process.exec`) and returns the output generated through a JSON API.

## Motivation
Ok, so you just discovered a really neat tool/library but... *oh, oh* its written in **THAT LANGUAGE**. All your dreams of api-fing that thing just blew up because you just wanted to run a little few commands here and there.

This recently happened at @Upplication, and **that language** happened to be ruby. It's not that we don't like ruby, it's just we dont have anyone on the team who can or have the time and motivation to start learning about it *properly*. So we decided to implement this kind of solution.

## Usage

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

**As express middleware**
```
var express = require('express')
 ,  dafuq = require('dafuq')

var app = expres()
app.use(dafuq({
	commands: './commands',
	shebang: '/usr/bin/env node', // optional
	debug: true // optional
}))
app.listen(3000)
```

**CLI**
```
$ dafuq --commands="./commands" [--port=3000] [--shebang="/usr/bin/env node"] [--debug]
```

```
GET  /bye
GET  /hello/:name
GET  /hello
POST /hello
*    /no-exec
```

## Options
* **commands**: Path where to look for commands to run on requests.
* [**shebang**]: If specified, this will be the command line interpreter to be used when running the file. If it is not specified we will check the file for execution permisions and run it by itself. Defaults to ''.
* [**debug**]: Show debug info. If true, `console.log` will be used as loggin function. If a function it will used as loggin function instead of the default . Defaults to `false`.

## Considerations

### Directory Structure
On init, dafuq searches for all the files named like an http method (with extension) and creates a route for that method at the path of the file.
Then, any request that reaches the server and matches one of the directories and method will trigger an execution of the file and return its output.

### Command arguments/parameters
Dafuq translates any parameter (query params, body contents, url params and `x-arg` headers) on the request to command line flags with double dash `--`, meaning that a request as follows:
```
POST /hello/john?age=12&male HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Content-Length: 100
X-Arg-username: jhon78

secondName=wick&profession=killer
```
would match against the route `/hello/:name` and translate into the following command
```
./hello/\:name/get.sh --name john --age 12 --male --secondName wick --profession killer
```

### Building the resposne
If the exit code of the command was different from 0 it will be taken as unsuccessful.

When a command is run the output will be determined by this steps:
* If the output of the command is a JSON
** and contains a success property: the whole content is considered the final response that will be sent, ignoring the previous
	success value.
** and doesn't contain a success property: The output will be placed in a `result` property in an object that also contains the
	previous success value.
* If the output of the command is NOT a JSON: The output will be placed in a `result` property in an object that also contains the
previous success value.
