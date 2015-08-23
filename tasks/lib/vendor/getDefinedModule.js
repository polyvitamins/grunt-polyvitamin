var funcarguments = new RegExp(/[\d\t]*function[ ]?\(([^\)]*)\)/i),
scopesregex = /({[^{}}]*[\n\r]*})/g,
funcarguments = new RegExp(/[\d\t]*function[ ]?\(([^\)]*)\)/i),
/*
Converts relative path to relative by process current folder 
*/
relative = function(p, root) {
	root = root || cwd;
	p = p.replace('\\', '/');
	root = root.substr(-1)==='/'?root:root+'/';
	if (p.substr(0,2)==='./') {
		p = p.substr(2);
	} else if (p.substr(0,1)==='/') {
		p = p.substr(1);
	}
	return root+p;
},
/*
Возвращает содержимое кода внутри скобок { } (без самих скобок)
contentonly возвращает только контент
*/
getScopeContent = function(code, contentonly) {
	var 
	prefixc = code.indexOf('{'),sufixc = code.lastIndexOf('}'),
	prefix=code.substring(0,prefixc),sufix=code.substring(sufixc+1,code.length);
	if (contentonly) {

		return code.substring(prefixc+1, sufixc);
	}
	return [prefix, code.substring(prefixc+1, sufixc), sufix];
},
/* Функция принимает в качестве текста код функции. Возвращает аргументы функции. */
getFunctionArguments = function(code) {
	if (funcarguments.test(code)) {
		var match = funcarguments.exec(code);
		return match[1].replace(' ','').split(',');
	}
	return [];
},
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
Функция принимает код файла js с функций define. Возвращает список зависимостей,
собственное имя модуля и код функции, параметр returnable и empty.

Ответ:
requires - список зависимостей
arguments - список аргументов фабрики
code - код фабрики (без скобок)
returnable - возвращает ли модуль что либо
empty - пустой модуль
*/
GDM = function(code) {
	var defineData = {},defined=false,
	define = function(g, e, b) {
		defined=true;
		var returnable=false,empty=false,code='';
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
			var nsb = killscopes(code);
			if (/return /gi.test(nsb)) {
				returnable=!0;
			}

			// test for empty
			empty = testemptyfunction(code);
		} else {
			empty = !0;
		}

		/*
		Получаем список аргументов в теле функции
		*/
		defineData = {
			requires: e,
			arguments: getFunctionArguments(code),
			code: code,
			scope: getScopeContent(code, true),
			returnable: returnable,
			empty: empty
		}
	}

	define.amd = true;

	window = {
		define: define
	}

	try {
		(function() {
			/*
			Если функция defined не вызвана, значит
			этот модуль работает по схеме CommonJs, поэтому нам 
			наобходимо предусмотреть этот вариант.
			*/
			var module = Object.create(null, {
				"exports": {
					set: function(module) {
						
						define(function() {
							return module;
						});
					}
				}
			});
			eval(code);
		}).call(window);
		
		return defineData;
	} catch(e) {
		console.log('ERROR in FILE >> '+code);
	}
}

module.exports = GDM;