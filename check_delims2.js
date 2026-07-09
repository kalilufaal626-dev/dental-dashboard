const fs = require('fs');
const path = 'c:\\Users\\E SOHNA\\Videos\\dental\\indext.html';
const s = fs.readFileSync(path,'utf8');
const cnt = ch => (s.split(ch).length-1);
console.log('backticks', cnt('`'));
console.log('${ occurrences', (s.match(/\$\{/g)||[]).length);
console.log('open {', (s.match(/{/g)||[]).length, 'close }', (s.match(/}/g)||[]).length);
console.log('open (', (s.match(/\(/g)||[]).length, 'close )', (s.match(/\)/g)||[]).length);
if (cnt('`') % 2) { console.error('UNBALANCED_BACKTICKS'); process.exit(2); }
if ((s.match(/{/g)||[]).length !== (s.match(/}/g)||[]).length) { console.error('UNBALANCED_BRACES'); process.exit(3); }
if ((s.match(/\(/g)||[]).length !== (s.match(/\)/g)||[]).length) { console.error('UNBALANCED_PARENS'); process.exit(4); }
console.log('OK');
