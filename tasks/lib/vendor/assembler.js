var cwd = process.cwd().split('\\').join('/'),
extend = require('extend'),
determineResourceType = require('./common/determineResourceType.js'),
getScopeContent = require('./common/getScopeContent.js'),
fs = require('fs'),
path = require('path'),
linefy = require('./linefy-tree.js'),
scopesregex = /({[^{}}]*[\n\r]*})/g,
chalk = require('chalk'),

unixify = function(p) {
	return p.replace(/\\/g, '/');
},
searchIn = function(stack, needle) {
	for (var prop in stack) {
		if (stack.hasOwnProperty(prop)&&stack[prop]==needle) return true; 
	}
	return false;
},
Programm = require('./../programm.js'),
mixin = (function() {
  var mixinup = function(a,b) { 
  	for(var i in b) { 
  		
  		if (b.hasOwnProperty(i)) { 
              
  			a[i]=b[i]; 
  		} 
  	} 
  	return a; 
  } 
  
  return function(a) { 
  	var i=1; 
  	for (;i<arguments.length;i++) { 
  		if ("object"===typeof arguments[i]) {
  			mixinup(a,arguments[i]); 
  		} 
  	} 
  	return a;
  }
})(),
each = function(subject, fn) {
	for (var prop in subject) {
		if (subject.hasOwnProperty(prop)) {
			fn.call(subject, subject[prop], prop);
		}
	}
},
/*
Функция прогоняет url по списку псевдонимов рекруссивно, пока
псевдонимы не будет присутствовать в url.
(необходимость функции возникала, потому что значением псевдонимов 
может быть опять таки псевдоним )
*/
patchAliases = function(aliases, p) {

	var graph = [];
	for (var prop in aliases) {
		if (aliases.hasOwnProperty(prop)) {
			graph.push([prop, aliases[prop]]);
		}
	}
	var gotya = false;
	do {
		for (var i = 0;i<graph.length;++i) {
			if (graph[i]===0) continue;
			if (graph[i][0]===p.substr(0, graph[i][0].length)) {
				p = graph[i][1]+p.substr(graph[i][0].length);
				graph[i]=null;
			}
		}
	} while(gotya);

	
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
},
/*
Возвращает true, если у запрашиваемого файла нету расширения, или он .js
*/
is_jsfile = function(url) {
	url=url.toLowerCase().split('?')[0];
	return (url.indexOf('/')>url.indexOf('.') || url.substr(-3)==='.js')
},
/*
Преобразует url в js-url, если у запрашиваемого имени файла нету расширения
*/
javascriptify = function(url) {
	if (url.substr(-1)==='/') return url;
	url=unixify(url).split('?');
	if (url[0].lastIndexOf('/')>url[0].lastIndexOf('.')) url[0]+='.js';
	
	return url.join('?');
},
/*
Возвращает содержимое кода внутри скобок { } (без самих скобок)
contentonly возвращает только контент
*/
getScopeContent = require('./common/getScopeContent.js'),
/* Функция принимает в качестве текста код функции. Возвращает аргументы функции. */
getFunctionArguments = require('./common/getFunctionArguments.js'),
/* Removes all scopes { } except root */
killscopes = function(text) {
	var p = getScopeContent(text),
	prefix=p[0],sufix=[2],text=p[1];
	while(/({[^{}}]*[\n\r]*})/g.test(text)) {
		text = text.replace(/({[^{}}]*[\n\r]*})/g,'');
	}
	return prefix+text+sufix;
},
/* Test for empty function */
testemptyfunction = function(code) {
	return (/^[\n\r\s]*$/g.test(getScopeContent(code)[1]))
},
/*
Function requires code as text. Returns define function dependecies and function text
*/
getDefineFunctionData = function(code) {
	var defineData = {};
	var define = function(g, e, b) {
		var returnable=false,empty=false,code='',nsb='';
		// Если передана только фабрика
		if (arguments.length===1) {
			if (typeof g === 'function') {
				b=g; g=null; e=null;
			} else if (g instanceof Array) {
				
				b=null; e=g; g=null; 
			} else {
				b=null; g=null; e=null;
			}
		}

		// Если передано два аргумента
		else if (arguments.length==2) {
			// Переданы зависимости и фабрика
			("object"==typeof g) && (b=e,e=g,g=null);
			// Передано имя и фабрика
			("string"==typeof g) && (b=e,e=0);
		}
		
		// Переданы все аргументы
		else {
			"string" != typeof g && (b = e, e = g, g = null);
			!(e instanceof Array) && (b = e, e = 0);
		}

		if (b!==null&&b!==undefined) {
			code=b.toString();
			// test for returne aviable
			var test = killscopes(code);
			if (/return /gi.test(test)) {
				returnable=!0;
			}

			// test for empty
			empty = testemptyfunction(code);

			// Get function scope
			nsb = getScopeContent(code, true);

		} else {
			empty = !0;
			nsb = '';
		}

		/*
		Получаем список аргументов в теле функции
		*/


		defineData = {
			requires: e,
			arguments: getFunctionArguments(code),
			code: nsb,
			returnable: returnable,
			empty: empty
		}
	}

	try {
		eval(code);
		return defineData;
	} catch(e) {
		console.log('File has no root define declaration', code);
	}
} 
/*
Assembler constructor
*/
assembler = function(config, generator) {
	this.generator = generator;
	this.map = {};
	this.modules = {};
	/*
	Псевдонимы для url
	*/
	this.aliases = [];
	/* 
	Файлы css, которые в финальной сборке будут поставлены на зегрузку
	*/
	this.requireCss = [];
	this.report = {
		totaldefines: 0,
		uniqueModules: []
	}
	/*
	Внедрение кода
	*/
	this.injects = [];
	this.config = extend({
		out: '/',
		compress: false,
		epistle: 'HAVE A NICE MAKING MONEY, GENTELMENS',
		aliases: {},
		constants: {},
		wrap: false, // Обернуть весь результат внутрь анонимной функции
		ignoreExpr: false, // Игнорирует компоненты, совпадающие с рег. выражением
		banner: false, // Дописывается в шапку файла
		reptile: false // Отладчик
	}, config);

	this.out = {
		js: '',
		css: ''
	}

	// 
	if (this.config.compress && "string"!==typeof this.config.compress) this.config.compress = this.config.out;
};

assembler.prototype = {
	constructor: assembler
};

assembler.prototype.config = function() {};


/*
Преобразует в код модуль, переданный как объект с данными.
Объект {
	required: [], - пути до компонентов
	arguments: [], - аргументы фабрики
	code: [], - код фабрики
	returnable, - есть ли у фабрики return
	empty - пуста ли фабрика
}
*/
assembler.prototype.virtualStringify = function(path, data) {
	
	this.analyze(javascriptify(path), data);
	this.reaper();
	
	this.generator.log('Generated', path);

	/*
	Внедряем дополнительный код
	*/
	this.injects.forEach(function(code) {

		this.out.js=code+"\n"+this.out.js;
	}.bind(this));

	var UglifyJS = require("uglify-js");
	if (this.config.compress) {
		/*
		Упаковываем код
		*/
		try {
			var compress = UglifyJS.minify(this.out.js, {fromString: true});
			this.out.js = compress.code;
			this.out.map = compress.map;
		} catch(e) {
			console.log(chalk.red('Error uglify'), e);
		}
	} else {
		/*
		Делаем код красивым
		*/
		try {
			var ast = UglifyJS.parse(this.out.js);
			var stream = UglifyJS.OutputStream({
				beautify: true,
				width: 50
			});
			ast.print(stream);
			
			this.out.js = stream.toString();
		} catch(e) {
			this.generator.warn('UglifyJS drop error');
			this.config.reptile.log(this.out.js);
		}
	}
	/*
	Устаналиваем баннер
	*/
	if (this.config.banner) {
		this.out.js = this.config.banner+"\n"+this.out.js;
	}
	return this;
}
/*
Excludes define() from files. Required components are included in final script as variables. 
*/
assembler.prototype.stringify = function(file) {
	this.analyze(file);
	this.reaper();
	return this;
};

assembler.prototype.reaper = function() {
	var that=this,linefyTree = linefy(this.map, true);
	that.out.js=[];

	linefyTree.forEach(function(files,i) {
		var scope = [];

		files.forEach(function(sourcefn) {
			/*
			Получаем реальный адрес ресурса через его модуль, если он есть.
			Если его нету, то скорей всего это css
			*/
			var file = that.modules[sourcefn] ? that.modules[sourcefn].url : sourcefn;
			
			that.report.uniqueModules.push(unixify(file));
			var varname = path.basename(file).split('.'),vardeps=[],mop=2,noclosure=true;
			varname.pop();varname=varname.join('').replace(/[^a-z$0-9]/ig, '');
			while (searchIn(that.aliases, varname)) {
				varname=varname+''+mop; ++mop;
			}
			/*
			Проверяем наличие файла в константах. Url-константы игнорируются
			на этапе построения модели.
			*/
			if (that.config.constants[file] || determineResourceType(file)!==1) {
				
				if (that.modules[sourcefn]) {
					switch(that.modules[sourcefn].type) {
						case 'nativecode':
							/*
							Данный модуль содержит в себе нативный код, он просто вписывается после quals и до ;
							Нативный код применяется для HTML файлов, когда контент из HTML файла полностью переносится
							в Javascript, как правило, в base64.
							*/
							scope.push('var '+varname+' = '+that.modules[sourcefn].nativeCode+';');
							that.aliases[sourcefn] = varname;
						break;
					}
				}
			} else {
				/*
				Необходимо передать в функцию запрашиваемые переменные
				*/
				if (that.map[sourcefn] instanceof Array) {
					that.map[sourcefn].forEach(function(d) {
						try {
							/*
							Проверяем путь на наличие в массиве констант
							*/
							if (that.config.constants[d]) {
								vardeps.push(that.config.constants[d]);
							}
							else if (that.modules[d].returnable) {
								vardeps.push(that.aliases[d]);
							} else {
								vardeps.push('null');
							}
						} catch(e) {
							// Для этого типа файлов не существует модуля
						}
					});
				}
				/*
				Проверяем имена переменных, запрошенных в функции. Если они совпадают с именами переменных, передаваемых в функцию, 
				то создание контекста нам не требуется. Это поможет сократить объект кода за счет удаления лишних анонимных функций.
				*/
				try {
					for (var a = 0;a<that.modules[sourcefn].arguments.length;++a) {
						if (vardeps[a]!=='null'&&vardeps[a]!=that.modules[sourcefn].arguments[a]) { noclosure=false; break; }
					}
				} catch(e) {
					console.log(chalk.red('Error in file:'), file, e);
				}
				/*
				Урезаем количество передаваймых в функцию знаечний до количества аргумнетов функции
				*/
				if (vardeps.length>that.modules[sourcefn].arguments.length) {
					vardeps = vardeps.slice(0,that.modules[sourcefn].arguments.length);
				}
				if (!that.modules[sourcefn].empty) {
					that.aliases[sourcefn] = varname;
					if (i===linefyTree.length-1 || !that.modules[sourcefn].returnable) {
						if (noclosure) {
							
							scope.push(that.modules[sourcefn].code);
						} else {

							scope.push(';(function('+that.modules[sourcefn].arguments.join(',')+') {'+that.modules[sourcefn].code+'})('+vardeps.join(',')+');');
						}
					}
					else
					scope.push('var '+varname+' = (function('+that.modules[sourcefn].arguments.join(',')+') {'+that.modules[sourcefn].code+'})('+vardeps.join(',')+');');
				} else {
					that.aliases[sourcefn] = 'null';
				}
			}
		});
		
		that.out.js.push(scope.join("\n\n"));
	});
	/*
	Включаем в финальную сборку css, если они есть в наличии.
	*/
	if (this.requireCss.length>0) {
		that.out.css = this.requireCss.map(function(res) {
			return fs.readFileSync(res, 'utf-8');
		}).join("\n\n");
	}
	that.out.js =  that.wrap(that.out.js.join("\n\n"));
}

/*
Parses the Javascript file. Looks for define() function and add depenendecies and code to this.module and this.map.
*/
assembler.prototype.analyze = function(sourcefn, def) {
	var ass=this;
	
	var file = unixify(relative(sourcefn, this.generator.config.dir, this.generator.aliases));

	if ("object"!==typeof def) {
		this.config.reptile.log(file);
		/*
		Анализируем тип ресурса
		*/

		/*
		Тестируем перенаправление обработчика
		*/
		this.config.rerouting.forEach(function(rer) {
			if (rer.expr&&rer.expr.test(file)) {

				def = rer.handler.call(ass, file);
				file = def.url;
				ass.config.reptile.log('SUBVIRTUAL '+file);

			};
		});

		if ("object"!==typeof def) {
			switch( determineResourceType(file) ){
				case 1: // js
					def = getDefineFunctionData(fs.readFileSync(file, 'utf-8'));
					def.url = file;
				break; 
				case 2: // css
					if (this.requireCss.indexOf(file)<0) this.requireCss.push(file);
					return;
				break;
				default:
					console.log(chalk.red('Unknown required file type'), file);
					return false;
				break
			}
		}
		
	} else {
		this.config.reptile.log('VIRTUAL '+file);
	}

	if ("object"===typeof def) {

		this.modules[sourcefn] = def;
		
		var req = [];
		if (def.requires instanceof Array) {
			def.requires.forEach(function(rurl) {
				/*
				Проверяем на наличие констант. Только если в списке констант отсутствует данная запись, мы её преобразуем в абсолютный путь.
				Это происходит потому что запись константы должна быть неизменна.
				*/
				if (rurl===undefined) {
					console.log('BUG DEF', def); process.exit(0);
				}
				if (rurl.substr(-1)==='*') {
					var sdir = path.normalize(unixify(relative(path.dirname(rurl), path.dirname(file), ass.config.aliases)));

					var sfiles = fs.readdirSync(sdir);
					sfiles.forEach(function(nurl) {
						if (fs.lstatSync(sdir+'/'+nurl).isFile()) {
							req.push(sdir+'/'+nurl);
						}
					});
				} else {
					req.push(rurl);
				}
			});

			req = req.map(function(rurl) {
				if ("undefined"===typeof ass.config.constants[rurl] && is_jsfile(rurl) && (!ass.config.ignoreExpr || !ass.config.ignoreExpr.test(rurl) ) && (!ass.config.virginExpr || !ass.config.virginExpr.test(rurl))) {
					
					return javascriptify(path.normalize(unixify(relative(rurl, path.dirname(file), ass.config.aliases))))
				} else {
					return rurl;
				}
			});
		};

		this.map[sourcefn] = req;

		/* Requires each of required files */
		req.forEach(function(rurl) {
			if ("undefined"===typeof ass.modules[rurl] && "undefined"===typeof ass.config.constants[rurl] && (!ass.config.ignoreExpr || !ass.config.ignoreExpr.test(rurl) )) {

				ass.config.reptile.group(file);
					ass.analyze(rurl);
				ass.config.reptile.groupEnd(file);
			}
		});
	}
}
/*
В завивисимости от настроек функция обертывает весь код
*/
assembler.prototype.wrap = function(code) {
	if (this.config.wrap) {
		return ";(function(m,o,r,u,l,u,s) {\n"+code+'\n})();';
	} else {
		return code;
	}
}
/*
Внедерение кода в финальную сборку
*/
assembler.prototype.injectCode = function(code) {

	if (0==~this.injects.indexOf(code)) {
		this.injects.push(code);
	}
}

module.exports = assembler;