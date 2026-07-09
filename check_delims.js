const fs = require('fs');
const path = 'c:\\Users\\E SOHNA\\Videos\\dental\\indext.html';
const s = fs.readFileSync(path,'utf8');
const cnt = ch => (s.split(ch).length-1);
console.log('backticks', cnt('`'));
console.log('${ occurrences', (s.match(/\$\{/g)||[]).length);
const openBrace = (s.match(/{/g)||[]).length;
const closeBrace = (s.match(/}/g)||[]).length;
console.log('open {', openBrace, 'close }', closeBrace);
const openPar = (s.match(/\(/g)||[]).length;
const closePar = (s.match(/\)/g)||[]).length;
console.log('open (', openPar, 'close )', closePar);
if (cnt('`') % 2) { console.error('UNBALANCED_BACKTICKS'); process.exit(2); }
if (openBrace !== closeBrace) { console.error('UNBALANCED_BRACES'); process.exit(3); }
if (openPar !== closePar) { console.error('UNBALANCED_PARENS'); process.exit(4); }
console.log('OK');
