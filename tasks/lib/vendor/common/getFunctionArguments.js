var funcarguments = new RegExp(/[\d\t]*function[ ]?\(([^\)]*)\)/i);
module.exports = function(code) {
	if (funcarguments.test(code)) {
		var match = funcarguments.exec(code);
		return match[1].replace(' ','').split(',');
	}
	return [];
}