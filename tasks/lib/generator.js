var extend = require('extend'),
colors = require('colors'),
_ = require('underscore'),
vendor = require('./vendor/processor.js'),
fs = require('fs'),
path = require('path'),
md5 = require('MD5'),
Base64 = require('js-base64').Base64,
filendir = require('filendir'),
unixify = function(url) {
	return url.replace(/\\/g, '/');
},
slashrize= function(url) {
	url=url.replace(/\\/g, "/").replace('//', '/');
	if (url.substr(-1)!=='/') url+='/';
	return url;
},
sortByMaxLength = function(obj) {
	var test = [],res={};
	for (var prop in obj) {
		if (obj.hasOwnProperty(prop)) {
			if ("object"!==typeof test[prop.length]) test[prop.length] = [];
			test[prop.length].push(prop);
		}
	}
	for (var t=test.length-1;~t;--t) {
		if ("object"!==typeof test[t]) continue;
		for (var i=0;i<test[t].length;++i) {

			res[test[t][i]] = obj[test[t][i]];
		}
	}
	return res;
},
regComponentName = /[a-z0-9\-\_]+~[a-z0-9\-\_]+\@[a-z0-9\.]+/i,
/*
Программа логирования
*/
Reptile = require('./reptile.js')(process.cwd()+'/reptile.log', 0),
/*
Converts relative path to absolue by process current folder 
*/
relative = function(p, root, aliases) {
	root = root || unixify(process.cwd());
	p = p.replace('\\', '/');
	root = root.substr(-1)==='/'?root:root+'/';
	
	if (aliases && /^[$a-z0-9\-_]+\/\//i.test(p) && "string"===typeof aliases[p.split('//')[0]]) {

		/* Alias */
		var alias = p.split('//')[0];
		/*
		Теперь формируем путь
		*/
		var p = aliases[alias]+(aliases[alias].substr(-1)==='/' ? '' : '/')+p.substr(alias.length+2);

		return p;		
	} else if (p.substr(0,2)==='./') {
		p = p.substr(2);
	} else if (p.substr(0,1)==='/' || /^[a-zA-Z]{1}:/.test(p)) {
		return p;
	}
	return root+p;
},
makeFunctionCodeScoped = function(code) {
	return ";(function() {\n"+code+"\n})()";
}
Programm = require('./programm.js'),
Generator = function(config) {
	// Selffactory
	if (this.constructor!==Generator)
	return new Generator(config);
	
	// Init config
	this.config = extend({
		dir: '',
		debugLogFile: ''
	}, config);
	// References
	this.aliases = {
		'components/': process.cwd()+'/components'
	};
	// Slashrize dir
	this.config.dir = slashrize(this.config.dir);
	
	this.config.debugLogFile = this.config.dir+'/build.log';
	// Programms
	this.programms = [];

	// build data
	this.results = {
		'abstract-included': [], // Компоненты AbstractJs
		'abstract-required': [], // Компоненты AbstractJs переданные в аргументы функции
		'thirdparty': [], // Другие компоненты
		'required': [], // Запрашиваемые компоненты
		'abs-distribute-paths': [] // Компоненты AbstractJs, которые должны попасть на выдачу
	}

	// app caches
	this.caches = {};
};
Generator.prototype = {
	constructor: Generator,
	/* Кеширем компонент воизбежании его повторного анализа */
	cacheApplication: function(absurl, dataobject) {
		this.caches[absurl] = dataobject;
	},
	initProgramm: function(absurl) {
		/*
		Что бы адекватно закешировать программу, нам необходимо отсечь ту часть, которая идет после component.json
		*/
		var saveurl = absurl.split(/component\.json[#0-9a-z\.]*/i)[0];
		if ("object"!==typeof this.caches[saveurl]) {
			
			this.caches[saveurl] = Programm(this, absurl);
		}
		return this.caches[saveurl];
	},
	/*
	Сборка abstract исходя из настроек. Настройки могут/должны содержать ключи:
	dist - путь до директории для сохранения
	apps - путь до файлов приложений
	include - компоненты, включаемые в проект принудительно
	separated - движок abstract создает отдельно от остальных программ
	*/
	perform: function(options, callback) {
		this.options = extend({
			"dist": "", // Путь для сохранения базового приложения,
			/* Библиотекa astract будет возвращена как amd модуль */
			"amd": false,
			/*
			Библиотека будет глобальной (window.Abstract и window.$)
			*/
			"globalize": true,
			"compress": false,
			"aliases": {}
		},options)

		/* Импортируем псевдонимы */
		for (var prop in this.options.aliases) {
			if (this.options.aliases.hasOwnProperty(prop)) this.addAlias(prop, this.options.aliases[prop]);
		}

		if (this.options.compress) this.notice('COMPRESS: ON');
		
		if ("undefined"!==typeof this.options['apps']) {
			this.analyseApps(this.options['apps'], function() {
				this.build(callback);
			}.bind(this));
		}
		else {
			this.build(callback);
		}
	},
	build: function(callback) {

		var self = this;
		/*
		Подключаем в общий список требуемых компонентов abstract список из файла .abstractrc
		*/
		self.results['abstract-included'] = _.union(self.results['abstract-included'], this.config['requires']);
		
		/*
		Мы должны сформировать функцию, которая включает в себя все компоненты abstract,
		которые запрашиваются в приложении. Для этого нам необходимо перебрать каждый
		компонент abstract-included и сравнить его со списком required.
		*/
		if (self.results['abstract-included'].length>0) {
			self.results['abstract-included'].forEach(function(url) {
				if (self.results['required'].indexOf(url)>=0) self.results['abstract-required'].push(url);
				else self.results['abstract-required'].push(null);
			});

			/*
			Читаем bower файл
			*/
			var bower = JSON.parse(fs.readFileSync(__dirname+'/../bower.json', 'utf-8'));
			/*
			Выполняем постройку abstract
			*/
			var assembler = new vendor.assembler({
				aliases: {
					'$': __dirname+'/../src'
				},
				compress: config.compress,
				banner: "/**\nAbstractJs custom build. Source version: "+bower.version+".\nAuthor: "+bower.authors[0].name+" <"+bower.authors[0].email+">.\nLicense: "+bower.license+"\n*/",
				wrap: true,
				reptile: Reptile
			}, this), anonymFuncName, assemblyCode,rni=0;

			assembler.config.out = this.config.dist;

			do {
				var assemblyCode = md5(self.results['abstract-included'].join(',')+rni);
				var anonymFuncName = path.normalize(__dirname+'/../src/'+assemblyCode+'.js');
				rni++;
			}
			while(fs.existsSync(anonymFuncName));

			var fileContent = assembler.virtualStringify(anonymFuncName, {
				requires: ['$//$'].concat(self.results['abstract-included']), 
				arguments: ['$'].concat(self.results['abstract-required'].map(function(v,i) { return 'a'+i; })),
				code: (function() {
					var fc = [''];
					self.results['abstract-required'].forEach(function(r,i) {
						if (r!==null)
						fc.push('$.alias("'+md5(r)+'", a'+i+');');
					});
					if (config.globalize) {
						fc.push('window.Abstract = window.$ = $;');
					}
					return fc.join("\n");
				})(),
				returnable: true,
				empty: false
			}).out.js;

			/*
			Записываем результат
			*/
			fs.writeFile(unixify(relative(config['dist'])), fileContent, function(err) {
				if (!err) {
					self.log('Abstract.js', '>>', unixify(relative(config['dist'])));
					/*
					Отмечаем те алиасы, которые вошли в сборку
					*/
					['$//$'].concat(self.results['abstract-included']).forEach(function(component) {
						//self.notice('# '+component);
					});
				}
			});

			/*
			Массив констант передаваемых в приложения. Когда приложение запрашивает компонент
			abstract, мы передаем ему не сам компонент, или не принуждает его загружать заново,
			а передаем ссылку на него через $.alias().
			*/
			var abstractConstants = {};
			self.results['abstract-required'].forEach(function(r) { 
				if (r===null) return true;
				abstractConstants[r] = 'Abstract.alias("'+md5(r)+'")';
			});
		};

		
		/*console.log('CACHES');
		for (var prop in this.caches) {
			console.log('prop # ', prop, this.caches[prop].main.data.requires);
		}
		process.exit(0);*/
		/*
		После формирования движка, создаем сами приложения
		*/
		var total = 0, done = function() {
			self.log('Mission complete!');
			if ("function"===typeof callback) callback();
		}, complete = function() {
			total--;
			if (total===0) {
				done();
			}
		}
		_.each(this.programms, function() {
			total++;
		});
		_.each(this.programms, function(proga) {
			/*
			Приложений записываются в директорию, которая указывается как ключ в объекте. 
			Предусмотрены специальные обозначения, такие как . и ... Где . предполагает, 
			что программа будет создана в той же директории и .. в предыдущей. Естественно, 
			так же доступно просто релятовное написание.
			Для этого приложения мы должны подключить только те компоненты, которые не относятс к abstract.
			Для этого мы создаем новй сборщик, куда передает константы. Константы в данном случае - это
			набор путей до компонентов Abstract, которые будут получены путем обращения к функции $.alias();
			*/

			var assembler = new vendor.assembler({
				constants: abstractConstants,
				ignoreExpr: /^\$\/\//, // Файлы подпадающие под данную регулярку полностью игнорируются
				virginExpr: regComponentName, // Файлы подпадающие под данную регулярку не преобразуются в абсолютный путь
				compress: self.options.compress,
				debug: true,
				wrap: true,
				reptile: Reptile,
				rerouting: [
					{
						expr: /component\.json/i,
						handler: function(absfile) {
							/*
							Приложение
							*/
							
							var proga = self.initProgramm(absfile);

							var optionals = absfile.split(/component\.json[#0-9a-z\.]*/i)[1];


							if (optionals&&!/^[\s]+$/.test(optionals)) {

								var tester = proga.optionalScript(optionals);
							} else {
								
								var tester = proga.main;
							}

							try {
								
								return {
									url: tester.url,
									type: 'module',
									requires: tester.data.requires, 
									arguments: tester.data.arguments,
									code: tester.data.scope,
									returnable: tester.data.returnable,
									empty: tester.data.empty
								}
							} catch(e) {
								console.log('ERROR DATA', tester); process.exit(0);
							}
							/*callback({
								url: proga.main.url,
								type: 'module',
								requires: proga.main.data.requires, 
								arguments: proga.factory.arguments,
								code: (function() {
									return proga.factory.scope
								})(),
								returnable: true,
								empty: false
							});*/
						}
					},
					{
						expr: /\.(html|htm|dhtml)?$/i,
						handler: function(absfile) {
							/*
							Поскольку в данном модуле мы будем использовать конверт base64, декодер необходимо вмонтировать 
							в итоговый скрипт.
							*/
							this.injectCode(fs.readFileSync(__dirname+'/tools/base64decode.js', 'utf-8'));
							return {
								url: absfile,
								type: 'nativecode',
								nativeCode: '_base64DecodeString("'+Base64.encode(fs.readFileSync(absfile, "utf-8"))+'")',
								returnable: true
							};
						}
					}
				]
			}, self);

			/*
			Так как в зависимостях приложения могут быть ресурсы не относящиеся к Abstract и в то же время
			не включенные в список аргументов, их загрузка так же необходима. Необходимо создавать массив, 
			содержащий список зависимостей не входящих ни в Abstract, ни в аргументы
			*/
			var thirdparty = []; 

			proga.results['thirdparty'].forEach(function(inc) {
				if (proga.results['required'].indexOf(inc)<0) thirdparty.push(inc);
			});

			self.debug('Build rich application', proga.path);

			

			assembler.virtualStringify(proga.main.url, {
				url: proga.main.url,
				type: 'module',
				requires: proga.main.data.requires, 
				arguments: proga.factory.arguments,
				code: (function() {
					return proga.factory.scope
				})(),
				returnable: true,
				empty: false
			});



			/*
			Записываем программу
			*/
			if (assembler.out.js!=='') {

				var jsfilename = proga.distloc+proga.name+'.js';

				/*
				Перед тем как произвести запись мы должны обернуть приложение в функцию-интерфейс,
				если она указана.
				*/
				filendir.wa(jsfilename, assembler.out.js, function(err) {
					if (!err) {
						self.log(proga.name+'.js', '>>', jsfilename);
						
					} else {
						self.warn('The programm is not created', err);
					}
					complete();
				});
			}
			if (assembler.out.css!=='') {
				var cssfilename = proga.distloc+proga.name+'.css';
				// Test file already exists
				filendir.wa(cssfilename, assembler.out.css, function(err) {
					if (!err) {
						self.log(proga.name+'.css', '>>', cssfilename);
					}
					complete();
				});
							
			}			
		});
	},
	analyseApps: function(apps, callback) {
		var self=this,loadings=0,ready = function() {

			loadings--;
			if (loadings===0) callback();
		};
		/*
		Произвожу сбор данных со всех приложений.
		В массив abstract помещаются только те запросы, что относятся к движку abstract.
		thirdparty - сторонние запросы, на javascript или не javascript файлы.
		required - в этот массив помещаются запросы, которые должны будет переданы в аргументы.
		*/
		_.each(apps, function() {
			loadings++;
		});
		_.each(apps, function(appPath, distloc) {
			var absurl = unixify(path.normalize(relative(appPath, self.config.dir)));
			self.log('get', absurl);
			var pro = self.initProgramm(absurl);

			pro.ready(function() {
				/*
				Формируем путь, куда программа будет сохраняться
				*/
				pro.name = path.basename(pro.main.url).split('.')[0].replace(/[^a-z\-$0-9_]/ig, '');
				
				pro.distloc = slashrize( distloc==='.' ? path.dirname(absurl) : relative( distloc, self.config.dir) );


				self.results['abstract-included'] = _.uniq(self.results['abstract-included'].concat(pro.results['abstract']));
				self.results['thirdparty'] = _.uniq(self.results['thirdparty'].concat(pro.results['thirdparty'])); // Не абсолюты
				self.results['required'] = _.uniq(self.results['required'].concat(pro.results['required']));

				ready();
			});

			self.programms.push(pro);
			setTimeout(function() {
				pro.parse();
			});
		});
	},
	addAlias: function(name, value) {
		this.debug('Set alias', name, value);
		this.aliases[name] = value;
		this.aliases = sortByMaxLength(this.aliases);
	},
	warn: function(message) {
		var messages = Array.prototype.slice.apply(arguments);
		messages[0] = messages[0].yellow;
		console.log.apply(console, messages);
		return true;
	},
	log: function() {
		var messages = Array.prototype.slice.apply(arguments);
		messages[0] = messages[0].cyan;
		console.log.apply(console, messages);
		return true;
	},
	notice: function() {
		var messages = Array.prototype.slice.apply(arguments).join(' ').gray;
		console.log.call(console, messages);
		return true;
	},
	debug: function() {
		var messages = Array.prototype.slice.apply(arguments);
		messages[0] = messages[0].magenta.bold;
		console.log.apply(console, messages);
		return true;
	}
};

module.exports = Generator;