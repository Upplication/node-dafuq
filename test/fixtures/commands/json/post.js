#!/usr/bin/env node
var traverse = require('traverse')
var argv = require('yargs')
    .argv;

traverse(argv).forEach(function(x) {
	if (this.notRoot && this.isLeaf && [ '_', '$0' ].indexOf(this.path[0]) < 0) {
		console.log(this.path.join('.') + ':' + x)
	}
})
