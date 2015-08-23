_base64DecodeString = (function() {
	var fromCharCode = String.fromCharCode;
	// constants
	var b64chars
	    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	var b64tab = function(bin) {
	    var t = {};
	    for (var i = 0, l = bin.length; i < l; i++) t[bin.charAt(i)] = i;
	    return t;
	}(b64chars);
	var cb_decode = function(cccc) {
	    var len = cccc.length,
	    padlen = len % 4,
	    n = (len > 0 ? b64tab[cccc.charAt(0)] << 18 : 0)
	        | (len > 1 ? b64tab[cccc.charAt(1)] << 12 : 0)
	        | (len > 2 ? b64tab[cccc.charAt(2)] <<  6 : 0)
	        | (len > 3 ? b64tab[cccc.charAt(3)]       : 0),
	    chars = [
	        fromCharCode( n >>> 16),
	        fromCharCode((n >>>  8) & 0xff),
	        fromCharCode( n         & 0xff)
	    ];
	    chars.length -= [0, 0, 2, 1][padlen];
	    return chars.join('');
	};
	var atob = function(a){
	        return a.replace(/[\s\S]{1,4}/g, cb_decode);
	    };
	var re_btou = new RegExp([
	        '[\xC0-\xDF][\x80-\xBF]',
	        '[\xE0-\xEF][\x80-\xBF]{2}',
	        '[\xF0-\xF7][\x80-\xBF]{3}'
	    ].join('|'), 'g');
	var cb_btou = function(cccc) {
	        switch(cccc.length) {
	        case 4:
	            var cp = ((0x07 & cccc.charCodeAt(0)) << 18)
	                |    ((0x3f & cccc.charCodeAt(1)) << 12)
	                |    ((0x3f & cccc.charCodeAt(2)) <<  6)
	                |     (0x3f & cccc.charCodeAt(3)),
	            offset = cp - 0x10000;
	            return (fromCharCode((offset  >>> 10) + 0xD800)
	                    + fromCharCode((offset & 0x3FF) + 0xDC00));
	        case 3:
	            return fromCharCode(
	                ((0x0f & cccc.charCodeAt(0)) << 12)
	                    | ((0x3f & cccc.charCodeAt(1)) << 6)
	                    |  (0x3f & cccc.charCodeAt(2))
	            );
	        default:
	            return  fromCharCode(
	                ((0x1f & cccc.charCodeAt(0)) << 6)
	                    |  (0x3f & cccc.charCodeAt(1))
	            );
	        }
	    };
	var btou = function(b) {
	        return b.replace(re_btou, cb_btou);
	    };
	var _decode = function(a) { return btou(atob(a)) }
	return function(a){
	    return _decode(
	        String(a).replace(/[-_]/g, function(m0) { return m0 == '-' ? '+' : '/' })
	            .replace(/[^A-Za-z0-9\+\/]/g, '')
	    );
	};
})();