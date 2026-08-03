const sharp = require('sharp');
const path = require('path');

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

const [,, src, dest] = process.argv;
processImg(src, dest);
