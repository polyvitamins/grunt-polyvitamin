/* 
Метод принимает двумерный массив состояний из ключей-имен и массивов имен, от которых это имя зависит. И выставлякт каждому рейтинг приоритетности, возвращая одномерный массив.
Результатом будем массив где каждому имени будет выдан индекс приоритетности.

Ключ asis принуждает вернуть массив пакетов с номерами приоритетов
Используется в директиве ajax-export
*/
function linefy(packages, asis) {
	var line=[], levels=[], name, keys=[];

	function _watchDep(name) {



		if ("undefined"===typeof line[name]) line[name] = 0;
		if ("undefined"!==typeof packages[name] && null!==packages[name])
		packages[name].forEach(function(dep, prop) {
			
			if ("undefined"===typeof line[packages[name][prop]]) line[packages[name][prop]] = 0;



			line[packages[name][prop]]++;
			_watchDep(packages[name][prop]);
		});
	}


	for (name in packages) {
		if (packages.hasOwnProperty(name))
		_watchDep(name)
	}

	line.sort();

	if (asis) {
		/* 
			Данный алгоритм хоть и рабочий, но не дает самую оптимальную последовательность пакетов 
			Необходимо его переписать с точки зрения оптимизации очереди загрузки.
		*/
		var levels = [];
		for (var name in line) {
			if (line.hasOwnProperty(name)) {
				if ("undefined"===typeof levels[line[name]]) levels[line[name]] = [];
				levels[line[name]].push(name);
			}
		}
		return levels.reverse();
	}

	
	for (var prop in line) {
		if (line.hasOwnProperty(prop)) keys.push(prop);
	}
	
	return line;
}

module.exports = linefy;