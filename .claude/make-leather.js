const path = require('path');
const sharp = require(path.join(__dirname, 'pdf-extract', 'node_modules', 'sharp'));

const src = 'C:/Users/guada/Downloads/Leather texture/A23DTEX_Albedo.png';
const out = path.join(__dirname, '..', 'assets', 'leather-cover.jpg');

sharp(src)
  .resize(1100, 1100, { fit: 'cover' })
  .jpeg({ quality: 82 })
  .toFile(out)
  .then(info => console.log('OK', JSON.stringify(info)))
  .catch(err => { console.error('ERR', err.message); process.exit(1); });
