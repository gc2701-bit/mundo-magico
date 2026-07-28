/* Reemplaza fotos de producto por versiones de mejor calidad provistas en
   "productos/Mejor calidad/", reprocesándolas con el mismo normalizador
   (fondo blanco, escala por área, centrado) que usa normalize-products.js.
   Guarda backup de la foto anterior en _orig si todavía no existe uno.
   Uso: node .claude/replace-quality.js */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CANVAS = 1080;
const TARGET_AREA_FRAC = 0.26;
const MAX_EXTENT = 0.94;
const LUMA_DARK = 215;
const SAT_MIN = 36;
const BG_DIST_MIN = 18;
const MIN_RELIABLE_AREA = 0.05;

async function analyze(input) {
  const W = 480;
  const { data, info } = await sharp(input).resize(W, null, { fit: 'inside' })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const patch = Math.max(2, Math.round(Math.min(w, h) * 0.02));
  const corners = [[0, 0], [w - patch, 0], [0, h - patch], [w - patch, h - patch]];
  let bgR = 0, bgG = 0, bgB = 0, bgN = 0;
  for (const [cx0, cy0] of corners) for (let y = cy0; y < cy0 + patch; y++) for (let x = cx0; x < cx0 + patch; x++) {
    const i = (y * w + x) * c; bgR += data[i]; bgG += data[i + 1]; bgB += data[i + 2]; bgN++;
  }
  bgR /= bgN; bgG /= bgN; bgB /= bgN;
  let area = 0, sx = 0, sy = 0, minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * c, r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const distBg = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    if (a > 20 && (luma < LUMA_DARK || (Math.max(r, g, b) - Math.min(r, g, b)) > SAT_MIN || distBg > BG_DIST_MIN)) {
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!area) return null;
  return {
    areaFrac: area / (w * h),
    cxFrac: (sx / area) / w, cyFrac: (sy / area) / h,
    bboxWFrac: (maxX - minX + 1) / w, bboxHFrac: (maxY - minY + 1) / h,
    minXFrac: minX / w, maxXFrac: (maxX + 1) / w, minYFrac: minY / h, maxYFrac: (maxY + 1) / h
  };
}

async function processImg(input, output) {
  const meta = await sharp(input).metadata();
  const W = meta.width, H = meta.height;
  const a = await analyze(input);
  if (!a) { console.log('  sin contenido:', path.basename(input)); return; }
  let s, cx, cy;
  if (a.areaFrac < MIN_RELIABLE_AREA) {
    s = Math.min((CANVAS * MAX_EXTENT) / W, (CANVAS * MAX_EXTENT) / H, 1);
    cx = (W * s) / 2; cy = (H * s) / 2;
    console.log('  (deteccion poco confiable, sin zoom):', path.basename(input));
  } else {
    s = Math.sqrt((CANVAS * CANVAS * TARGET_AREA_FRAC) / (a.areaFrac * W * H));
    const sCapW = (CANVAS * MAX_EXTENT) / (a.bboxWFrac * W);
    const sCapH = (CANVAS * MAX_EXTENT) / (a.bboxHFrac * H);
    s = Math.min(s, sCapW, sCapH);
    cx = a.cxFrac * (W * s); cy = a.cyFrac * (H * s);
  }
  const sw = Math.round(W * s), sh = Math.round(H * s);
  let left = Math.round(CANVAS / 2 - cx), top = Math.round(CANVAS / 2 - cy);
  if (a.minXFrac != null) {
    const prodLeft = left + a.minXFrac * sw, prodRight = left + a.maxXFrac * sw;
    if (prodLeft < 0) left -= prodLeft; else if (prodRight > CANVAS) left -= (prodRight - CANVAS);
    const prodTop = top + a.minYFrac * sh, prodBottom = top + a.maxYFrac * sh;
    if (prodTop < 0) top -= prodTop; else if (prodBottom > CANVAS) top -= (prodBottom - CANVAS);
    left = Math.round(left); top = Math.round(top);
  }
  const scaled = await sharp(input).resize(sw, sh).flatten({ background: '#ffffff' }).toBuffer();
  const sxoff = Math.max(0, -left), syoff = Math.max(0, -top);
  const destLeft = Math.max(0, left), destTop = Math.max(0, top);
  const cropW = Math.min(sw - sxoff, CANVAS - destLeft), cropH = Math.min(sh - syoff, CANVAS - destTop);
  const win = await sharp(scaled).extract({ left: sxoff, top: syoff, width: cropW, height: cropH }).toBuffer();
  await sharp({ create: { width: CANVAS, height: CANVAS, channels: 3, background: '#ffffff' } })
    .composite([{ input: win, left: destLeft, top: destTop }])
    .webp({ quality: 84 }).toFile(output);
  console.log('  ok', path.basename(output));
}

const PAIRS = [
  ['productos/Mejor calidad/11528c6d-6060-4414-8002-c7956898babf.jpg', 'productos/4. Reposteria/Moldes/Molde de Silicona Paletas x4 002420.webp'],
  ['productos/Mejor calidad/19f010dd-77e5-4255-85b1-7da271a42b9b.jpg', 'productos/4. Reposteria/Moldes/Molde de Silicona Flor x12 42317.webp'],
  ['productos/Mejor calidad/38aec32a-3e30-486e-8a8c-aeb29328d2a2.jpg', 'productos/4. Reposteria/Moldes/Molde de Silicona Números 0 al 9 67123.webp'],
  ['productos/Mejor calidad/7b1966bd-fb0d-488b-ab20-7367e1b82e2b.jpg', 'productos/4. Reposteria/Moldes/Molde de Silicona Flor Margarita x6.webp'],
  ['productos/Mejor calidad/a8adb884-a5d2-41ab-b7b8-22f843a4a801.jpg', 'productos/4. Reposteria/Moldes/Molde Media Esfera x8 5173.webp'],
  ['productos/Mejor calidad/b09612dc-e1df-4e97-aed4-8f1d1c72d86a.jpg', 'productos/4. Reposteria/Moldes/Molde de Silicona Mini Corazones x45 67123.webp'],
  ['productos/Mejor calidad/IMG_2503.PNG', 'productos/3. Disfraces/Alas mariposa tornasolada 39073.webp'],
  ['productos/Mejor calidad/IMG_2609.PNG', 'productos/4. Reposteria/Moldes/Molde de Silicona para Donas x6 85304.webp'],
  ['productos/Mejor calidad/IMG_2611.PNG', 'productos/4. Reposteria/Moldes/Molde de Silicona Budin Corona con Corazones/Molde de Silicona Budin Corona afuera 19019.webp'],
  ['productos/Mejor calidad/IMG_2612.PNG', 'productos/4. Reposteria/Moldes/Molde de Silicona Budin Corona con Corazones/Molde de Silicona Budin Corona adentro.webp'],
  ['productos/Mejor calidad/IMG_2615.PNG', 'productos/4. Reposteria/Moldes/Molde de Silicona Estrellas x15 67123.webp'],
];

(async () => {
  for (const [srcRel, destRel] of PAIRS) {
    const src = path.join(ROOT, srcRel);
    const dest = path.join(ROOT, destRel);
    if (!fs.existsSync(src)) { console.log('FALTA ORIGEN:', srcRel); continue; }
    if (!fs.existsSync(dest)) { console.log('FALTA DESTINO:', destRel); continue; }
    const dir = path.dirname(dest);
    const orig = path.join(dir, '_orig');
    if (!fs.existsSync(orig)) fs.mkdirSync(orig);
    const bak = path.join(orig, path.basename(dest));
    if (!fs.existsSync(bak)) fs.copyFileSync(dest, bak);
    console.log(path.basename(destRel), '<-', path.basename(srcRel));
    await processImg(src, dest);
  }
  console.log('Listo.');
})();
