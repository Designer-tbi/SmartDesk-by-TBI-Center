import fs from 'fs';

const content = fs.readFileSync('src/lib/i18n.tsx', 'utf8');
const lines = content.split('\n');
const errors = [
  183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195,
  293, 294, 295, 477, 479, 480, 481, 497, 509, 551, 552, 553, 554, 555, 580, 672, 815,
  1148, 1149, 1150, 1326, 1328, 1329, 1330, 1346, 1358, 1400, 1401, 1402, 1403, 1404, 1429, 1521, 1693
];

errors.forEach(line => {
  console.log('Line ' + line + ': ' + lines[line - 1]);
});
