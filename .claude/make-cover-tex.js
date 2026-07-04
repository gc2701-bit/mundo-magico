const path = require('path');
const sharp = require(path.join(__dirname, 'pdf-extract', 'node_modules', 'sharp'));

const src = 'C:/Users/guada/Downloads/Texture book/A23DTEX_Albedo.jpg';
const out = path.join(__dirname, '..', 'assets', 'cover-cloth.jpg');

sharp(src)
  .resize(700, 700, { fit: 'cover' })
  .jpeg({ quality: 82 })
  .toFile(out)
  .then(info => console.log('OK', JSON.stringify(info)))
  .catch(err => { console.error('ERR', err.message); process.exit(1); });
