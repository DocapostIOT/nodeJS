
var fs = require('fs');
var obj = JSON.parse(fs.readFileSync('tel.json', 'utf8'));
console.log(obj);
