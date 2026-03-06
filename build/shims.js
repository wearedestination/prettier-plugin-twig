import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const grammarPath = path.join(__dirname, '../grammar');

fs.writeFileSync(
  path.join(grammarPath, 'liquid-html.ohm.js'),
  'module.exports = ' +
    'String.raw`' +
    fs
      .readFileSync(path.join(grammarPath, 'liquid-html.ohm'), 'utf8')
      .replace(/`/g, '${"`"}') +
    '`;',
  'utf8',
);
