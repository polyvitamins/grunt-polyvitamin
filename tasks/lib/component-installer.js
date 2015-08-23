var resolve = require('component-resolver');
var utils = require('component-consoler');
var semver = require('semver');
var path = require('path');
var fs = require('fs');

var exists = fs.existsSync;
var write = fs.writeFileSync;
var fatal = utils.fatal;
var log = utils.log;
var dependencies = [];

var Installer = function(generator, dependencies, callback) {
	var options = {
	  development: [],
	  proxy: undefined,
	  timeout: 5000,
	  install: true,
	  verbose: true,
	};

	var json = false;

	var deps = {};
	dependencies = dependencies.map(function (dependency) {
	  var frags = dependency.split('@');
	  var name = frags[0].toLowerCase();
	  if (!~name.indexOf('/')) return generator.warn('"' + name + '" is not a valid dependency');
	  var version = frags[1];
	  deps[name] = version || '*';
	  return [name, version];
	});

	resolve({
	  dependencies: deps
	}, options, function (err, tree) {
	  if (err) return generator.warn(err);
	  log('install', 'complete');
	  callback();
	  //if (!json) return;

	 // json.dependencies = json.dependencies || {};

	 /* dependencies.forEach(function (dep) {
	    var name = dep[0];
	    var version = dep[1];
	    // if the dependency, don't install.
	    // not sure if this is correct behavior.
	    //if (json.dependencies[name]) return;
	    // if we're installing "any" version,
	    // add a corresponding ^ or ~ to the current version
	    if (!version) {
	      var node = tree.dependencies[name];
	      if (!node.version) {
	        version = '*'; // this means master
	      } else if (semver.gte(node.version, '1.0.0')) {
	        version = '^' + node.version;
	      } else {
	        version = '~' + node.version;
	      }
	    }
	    //json.dependencies[name] = version;
	  });*/
	});

	
}

module.exports = Installer;


