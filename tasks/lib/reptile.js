var extend = require('extend'),
fs = require('fs'),
Reptile = function(cwd, dip) {
	if (this.constructor!==Reptile) return new Reptile(cwd, dip);
	this.file = cwd;
	this.dip = (dip||0)+1;
	// Очищаем файл
	fs.writeFileSync(this.file, '');
	this.log('Ok, im reptilie');
}

Reptile.prototype = {
	constructor: Reptile,
	log: function(message) {
		fs.appendFileSync(this.file, (new Array( this.dip ).join('     '))+Array.prototype.slice.call(arguments).join(', ')+"\n");
	},
	group: function(groupName) {
		this.dip++;
	},
	groupEnd: function(groupName) {
		this.dip--;
	},	
	deeper: function() {
		var subReptile = new Reptile(this.file, this.dip);
	}
}




module.exports = Reptile;