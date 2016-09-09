#!/usr/bin/env node
console.log('Hello ' + (process.env['NODE_HELLO_NAME'] || process.env['HELLO_NAME']))