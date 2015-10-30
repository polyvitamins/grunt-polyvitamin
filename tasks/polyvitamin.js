/*
 * polyvitamin
 * 
 *
 * Copyright (c) 2015 Vladimir Morulus
 * Licensed under the MIT license.
 */



'use strict';

var each = function(subject, fn) {
  for (var prop in subject) {
    if (subject.hasOwnProperty(prop)) {
      if (fn.call(subject, subject[prop], prop)===false)  break;
    }
  }
},

unixify = function(url) {
  return url.replace(/\\/g, '/');
},

/*
Функция прогоняет url по списку псевдонимов рекруссивно, пока
псевдонимы не будет присутствовать в url.
(необходимость функции возникала, потому что значением псевдонимов 
может быть опять таки псевдоним )
*/
patchAliases = function(aliases, p) {
  each(aliases, function(path, alias) {
    if (p.substr(0, alias.length)===alias) {
      p = patchAliases(aliases, aliases[alias]+p.substr(alias.length));
      return false;
    }
  });
  return p;
},

/*
Converts relative path to absolue by process current folder 
*/
relative = function(p, root, aliases) {

  root = root || unixify(process.cwd());
  p = p.replace('\\', '/');
  root = root.substr(-1)==='/'?root:root+'/';
  
  p = patchAliases(aliases, p);
  
  if (p.substr(0,2)==='./') {
    p = p.substr(2);
  } else if (p.substr(0,1)==='/' || /^[a-zA-Z]{1}:/.test(p)) {
    return p.replace('//', '/');
  }
  p = root+p;
  return p.replace('//', '/');
}

module.exports = function (grunt) {

  var generator = require('./lib/generator.js')({
    dir: process.cwd()+'/.dev/poly/'
  });

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('polyvitamin', 'polyvitamin builder', function () {

    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      punctuation: '.',
      separator: ', '
    });

    var done = this.async(),
    subtasks=this.data.components.length,
    ready = function() {
        subtasks--;
        if (subtasks===0) done();
    }
    var dist = unixify(relative(this.data.dist, process.cwd())),
    map = {};
    for (var i=0;i<subtasks;++i) {
      var compName = this.data.components[i].split('\\').join('/').split('/').filter(function(v,i,a) {return i===a.length-2;})[0];
      
      var comp = unixify(relative(this.data.components[i], process.cwd()));
      if (subtasks>1)
      map[dist+'/'+compName+'/'] = comp;
      else
      map[dist] = comp;
    }

    generator.perform({
      "root": process.cwd()+'/.dev/poly/',
      "apps": map,
      "aliases": {
          "/poly/": process.cwd()+'/.dev/poly/'
      }
    }, done);

  });

};
