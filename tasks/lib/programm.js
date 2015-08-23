var fs = require('fs'),
ee = require('event-emitter'),
path = require('path'),
GDM = require('./vendor/getDefinedModule.js'),
Installer = require('./component-installer.js'),
slashrize= function(url) {
	url=url.replace(/\\/g, "/").replace('//', '/');
	if (url.substr(-1)!=='/') url+='/';
	return url;
},
_ = require('underscore'),
getScopeContent = require('./vendor/common/getScopeContent.js'),
getFunctionArguments = require('./vendor/common/getFunctionArguments.js'),
determineResourceType = require('./vendor/common/determineResourceType.js'),
unixify = function(url) {
	return url.replace(/\\/g, '/');
},
/*
Возвращает true, если у запрашиваемого файла нету расширения, или он .js
*/
is_jsfile = function(url) {
	url=url.toLowerCase().split('?')[0];
	return (url.lastIndexOf('/')>url.lastIndexOf('.') || url.substr(-3)==='.js')
},
is_jsonfile = function(url) {
	url=url.toLowerCase().split('?')[0];
	return (url.lastIndexOf('/')>url.lastIndexOf('.') || url.substr(-5)==='.json')
},
/*
Преобразует url в js-url, если у запрашиваемого имени файла нету расширения
*/
javascriptify = function(url) {
	
	url=unixify(url).split('?');
	if (url[0].lastIndexOf('/')>url[0].lastIndexOf('.')) url[0]+='.js';
	
	return url.join('?');
},
each = function(subject, fn) {
	for (var prop in subject) {
		if (subject.hasOwnProperty(prop)) {
			if (fn.call(subject, subject[prop], prop)===false)  break;
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
	each(aliases, function(path, alias) {
		if (p.substr(0, alias.length)===alias) {
			p = patchAliases(aliases, aliases[alias]+p.substr(alias.length));
			return false;
		}
	});
	return p;
}
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
Анализатор .js файла с define аббревиатурой
*/
defineTester = function(generator, url) {
	// Selffactory
	if (this.constructor!==defineTester) return new defineTester(generator, url);

	var self = this;
	/*
	Ссылка на генератор
	*/

	this.url = url;
	/*
	Постоянная ссылка на генератор
	*/
	this.generator = generator;
	/*
	Locations of file
	*/
	this.location = slashrize(path.dirname(url));
	/*
	Analyses results
	*/
	this.results = {
		'abstract': [],
		'thirdparty': [],
		'required': [],
		'includes': []
	}
	/*
	Script data
	*/
	this.data = null;
	/*
	Make it eventable
	*/


	ee(this);
	this.isready = false;
	this.on('ready', function() {
		this.isready = true;
		this.emit('isReady');
	});
};
defineTester.prototype = {
	constructor: defineTester,
	ready: function(fn) {
		if (this.isready) fn.apply(this);
		else this.on('isReady', fn);
		return this;
	},
	parse: function() {
		var self = this,loadings=0,
		ready=function() {
			loadings--;
			if (loadings===0) {
				self.emit('ready');
			}
		}
		this.url = javascriptify(this.url);
		if (fs.existsSync( this.url )) {
			loadings++;
			var filecontent = fs.readFileSync(this.url, 'utf-8');

			self.data = GDM(filecontent);
			/*
			Перебираем все зависимости
			*/

			if (self.data.requires!==null)
			self.data.requires.forEach(function(component, i) {
				if ("string"===typeof component && component.substr(0,3)==='$//') {
					if ("string"===typeof self.data.arguments[i]) self.results['required'].push(component);
					if (self.results['abstract'].indexOf(component)<0) self.results['abstract'].push(component);
					if (self.results['includes'].indexOf(component)<0) self.results['includes'].push(component);
				} else {
					//var absr = unixify(relative(component, self.location));
					if (self.results['thirdparty'].indexOf(component)<0) self.results['thirdparty'].push(component);
					//if (self.results['includes'].indexOf(absr)<0) self.results['includes'].push(absr);
				}
			});
			/*
			Перебираем thirdparty
			*/
			if (self.results['thirdparty'].length>0)
			self.results['thirdparty'].forEach(function(tp) {
				/*
				Пробиваем адрес по aliases
				*/
				if (self.generator.aliases[tp]) tp = self.generator.aliases[tp];

				if (is_jsfile(tp)||is_jsonfile(tp)) {
					

					var fullurl = unixify(relative(tp, self.location, self.generator.aliases));
					
					/*
					Это компонент и его необходимо анализировать асинхроноо
					*/
					
					//self.generator.debug('test def', tp);
					if (/dom\/attr/.test(fullurl))
					{
						console.log('FUCK', tp);
						process.exit(0);
					}



					tester = (/component\.json/.test(fullurl)) ? self.generator.initProgramm(fullurl) : defineTester(self.generator, fullurl);
					if (tester.isparsed) {
						// Break parsed programms
						ready();
						return;
					}

					loadings++;
					tester.ready(function() {
						/*
						Получаем данные из глубинных файлов о компонентах и требуемых компонентах движка.
						*/
						self.results['abstract'] = _.union(self.results['abstract'], this.results['abstract']);
						self.results['required'] = _.union(self.results['required'], this.results['required']);

						ready();
					});
					setTimeout(function() {
						this.parse();
					}.bind(tester), 13);
				}
			});
			ready();
		} else {
			this.generator.warn('File is not exists >', this.url);
		}
	}
}
/*
Анализатор компонента (component.json)
*/
Programm = function(generator, src) {

	this.src = src;
	// Selffactory
	if (this.constructor!==Programm) return new Programm(generator, src);
	/*
	Link to generator
	*/
	this.generator = generator;
	/*
	Согласно новой директивы, путь до файлов компонентов теперь могут содержать опциональные настройки, идущие после указания имени
	компонента. Если таковые имеются, их необходимо проанализировать.
	*/
	var ssrc = src.split(/component\.json[#0-9a-z\.]*/i);
	this.path = ssrc[0]+'component.json';

	this.optionals = ssrc[1]||'';
	
	/*
	Basename of component
	*/
	this.basename = path.basename(this.path),
	/*
	Location of component
	*/
	this.location = path.dirname(this.path),
	/*
	Содержит данные первого скрипта (основного)
	*/
	this.main = {};
	/*
	Results data
	*/
	this.results = {
		'abstract': [], // Abstract componenets
		"components": [], // Componennts
		'thirdparty': [], // TP files
		'required': [], // Required (depricated)
		'includes': [] // Includes
	}
	/*
	Factory of the component (depricated for components)
	*/
	this.factory = {
		'scope': null,
		'arguments': null
	}
	/*
	Make it eventable
	*/
	ee(this);
	this.completed = false;
	this.isready = false;
	this.isparsed = false;
	this.on('ready', function() {

		this.isready = true;
		this.emit('isReady');
	});
	/*
	Получаем код файла component.json
	*/
	try {
	this.data = JSON.parse(fs.readFileSync(this.path, 'utf-8'));
	
	} catch(e) {
		generator.warn('Bad component', src, e); process.exit(0);
	}
}

Programm.prototype =  {
	constructor: Programm,
	ready: function(fn) {

		if (this.isready) fn.apply(this);
		else this.on('isReady', fn);
		return this;
	},
	/*
	Анализ данных component.json
	*/
	parse: function() {

		if (this.isready||this.isparsed) return false;
		/*
		Если в процессе парсинга будет снова вызыван парсинг этой программы, мы не должны будем его выполнять
		*/
		this.isparsed = true; 		
		var data=this.data,self = this,depends=[],names=[],insta=[];
		/*
		В первую очередь необходимо проанализировать зависимости
		*/

		if ("object"===typeof data.dependencies) {
			
			for (var submod in data.dependencies) {
				var mmn = submod.split('/');
				var linkName = mmn.join('~')+'@'+data.dependencies[submod];
				if ("undefined"===typeof this.generator.aliases[linkName]) {

					
					names.push(linkName);
					if ("string"===typeof self.generator.aliases[mmn[0]]) {
						console.log("Short way for ", mmn[0]+'//'+mmn[1]+'/component.json#'+data.dependencies[submod]);
						depends.push(mmn[0]+'//'+mmn[1]+'/component.json');
					} else {
						insta.push(submod+'@'+data.dependencies[submod]);
						depends.push('components//'+mmn[0]+'/'+mmn[1]+'/'+data.dependencies[submod]+'/component.json');
					}
				}
			}

			/*
			Фиксируем ссылки
			*/
			if (names.length) {
				names.forEach(function(name, i) {
					self.generator.addAlias(name, depends[i]);
				});
			}
		}

		self.generator.notice("Installation components:\n", insta.join("\n"));

		/*
		Устанавливаем компоненты
		*/
		if (insta.length>0)
		Installer(this.generator, insta, function() {

			self.analyse();
		});
		else
		self.analyse();
	}
}

/*
Принудительный анализ файла
*/
Programm.prototype.optionalScript = function(optional) {
	var self = this,surl,fullurl;
	/*
	Если опциональный скрипт указан мы его пропустить, так как мы и так проводим анализ каждого опционального скрипта
	*/
	if ("object"===typeof this.data.optional&&this.data.optional[optional.substr(1)]) {
		/* ... */

		surl = this.data.optional[optional.substr(1)];
	} else {
		/*
		Если указан путь без псевдонима, его необходимо рассчитывать относительно местоположения
		первого скрипта в списке scripts.
		*/
		var redir = '';
		if (this.data.scripts && "string"===typeof this.data.scripts[0]) {
			redir = path.dirname(this.data.scripts[0])+'/';
		}

		surl = redir+optional;
	}
	fullurl = unixify(relative(javascriptify(surl), self.location));
	try {
		var tester = {
			url: fullurl,
			data: GDM(fs.readFileSync(fullurl, 'utf-8'))
		}
	} catch(e) {

		this.generator.warn('Optional file is not exists', optional, fullurl);
		process.exit(0);
	}
	return tester;
}

Programm.prototype.analyse = function() {
	var data = this.data,
	self=this,
	loadings=0,
	tester,
	ready=function() {
		loadings--;
		if (loadings===0) {
			if (self.main.data===undefined) { process.exit(0); } // debug
			
			self.factory.scope = getScopeContent(self.main.data.code, true);
			self.factory.arguments = self.main.data.arguments;
			self.completed = true;
			self.emit('ready');
		}
	}
	this.generator.debug('test component', this.path);
	/*
	Анализируем каждый скрипт в приложении. Если указан опциональный скрипт, мы должны проанализировать его.
	*/
	var testscripts = data.scripts instanceof Array ? data.scripts.slice() : [];
	if ("object"===typeof data.optional) {
		for (var prop in data.optional) {
			if (data.optional.hasOwnProperty(prop)) testscripts.push(data.optional[prop]);
		}
	}
	var debugtest = testscripts.splice();
	if (this.optionals&&!/^[\s]+$/.test(this.optionals)) {
		/*
		Если опциональный скрипт указан мы его пропустить, так как мы и так проводим анализ каждого опционального скрипта
		*/
		if ("object"===typeof data.optional&&data.optional[this.optionals.substr(1)]) {
			/* ... */
		} else {
			/*
			Если указан путь без псевдонима, его необходимо рассчитывать относительно местоположения
			первого скрипта в списке scripts.
			*/
			var redir = '';
			if (data.scripts && "string"===typeof data.scripts[0]) {
				redir = path.dirname(data.scripts[0])+'/';
			}
			
			testscripts.push(redir+this.optionals);
		}
	}

	testscripts = _.uniq(testscripts);
	testscripts.forEach(function(tp, i) {
		if (is_jsfile(tp)) {

			var fullurl = unixify(relative(javascriptify(tp), self.location));
			//self.generator.notice('get', fullurl)
			/*
			Это компонент и его необходимо анализировать асинхроноо
			*/
			if (/component\.json/.test(fullurl)) {

				process.exit(0);
				// хм... tester = Programm(self.generator, fullurl)
			} else {
				
				self.generator.debug('test', tp);
				if (fullurl.substr('master/src/attr.js'.length*-1)=='master/src/attr.js') {
					console.warn('STRANGE', self.src);
					process.exit(0);
				}
				tester = defineTester(self.generator, fullurl);
			}
			 

			if (i===0) self.main = tester;

			loadings++;
			tester.ready(function() {
				/*
				Получаем данные из глубинных файлов о компонентах и требуемых компонентах движка.
				*/
				self.results['abstract'] = _.union(self.results['abstract'], this.results['abstract']);
				self.results['required'] = _.union(self.results['required'], this.results['required']);
				self.results['thirdparty'] = _.union(self.results['thirdparty'], this.results['thirdparty']);

				ready();
			});
			setTimeout(function() {
				this.parse();
			}.bind(tester), 13);
		}
	});
}

module.exports = Programm;