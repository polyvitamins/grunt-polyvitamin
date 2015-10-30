module.exports = function(code, contentonly) {
	var 
	prefixc = code.indexOf('{'),sufixc = code.lastIndexOf('}'),
	prefix=code.substring(0,prefixc),sufix=code.substring(sufixc+1,code.length);
	if (contentonly) {

		return code.substring(prefixc+1, sufixc);
	}
	return [prefix, code.substring(prefixc+1, sufixc), sufix];
};