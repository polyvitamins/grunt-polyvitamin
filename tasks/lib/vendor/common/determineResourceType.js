/*
Определяет тип ресурса
*/
// 1 - javascript
// 2 - css
// 3 - bower
// 4 - json
// 5 - image
// 0 - unknown
var resourceTypeMap = [
    'Unknown',
    'javascript',
    'Css',
    'Bower',
    'Json',
    'Image'
],
imagesRegExpr = /\.[jpg|jpeg|gif|png|bmp]*$/i;
module.exports = function(pure) {
    // Js file
    if (pure.substr(pure.length-3, 3).toLowerCase()=='.js') {
       return 1;
    } else if (pure.substr(pure.length-4, 4).toLowerCase()=='.css') {
        return 2;
    } else if (pure.substr(pure.length-10, 10).toLowerCase()=='bower.json') {
        return 3;
    } else if (pure.substr(pure.length-5, 5).toLowerCase()=='.json') {
       return 4;
    } else if (imagesRegExpr.test(pure)) {
       return 5;
    } else if (pure.lastIndexOf('.')>pure.lastIndexOf('/')) {
        return 0;
    } else {
        return false;
    }
};