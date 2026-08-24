/**
 * Ajusta cualquier foto a 1080×1080 con fondo blanco, centrada, sin
 * agrandar fotos chicas — mismo comportamiento exacto que ya tenía
 * public/assets/admin-catalogo.js (procesarFoto), portado tal cual. Es
 * client-only (createImageBitmap/canvas) — no tiene test unitario por lo
 * mismo que tampoco lo tenía la versión vieja: jsdom no simula canvas de
 * verdad, se verifica a mano en el navegador.
 */
export async function procesarFoto(file: File): Promise<Blob> {
  if (!file) throw new Error('Elegí una foto.');
  if (!/^image\//.test(file.type)) throw new Error('Eso no es una imagen.');
  if (file.size > 8 * 1024 * 1024) throw new Error('La foto pesa más de 8 MB — probá con otra.');
  if (!('createImageBitmap' in window)) throw new Error('Este navegador no puede procesar la foto. Probá desde otro.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    throw new Error((err as Error)?.message || 'No se pudo leer la foto.');
  }

  const lado = 1080;
  const escala = Math.min(lado / bitmap.width, lado / bitmap.height, 1);
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const x = Math.round((lado - w) / 2);
  const y = Math.round((lado - h) / 2);

  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, lado, lado);
  ctx.drawImage(bitmap, x, y, w, h);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo procesar la foto.'))),
      'image/webp',
      0.84
    );
  });
}

export async function subirFoto(
  sb: any,
  blob: Blob,
  carpeta: string,
  slugProducto: string,
  sufijo: number
): Promise<string> {
  const nombre = `${carpeta}/${slugProducto}-${Date.now()}-${sufijo}.webp`;
  const up = await sb.storage.from('catalogo').upload(nombre, blob, { contentType: 'image/webp', upsert: false });
  if (up.error) throw up.error;
  const pub = sb.storage.from('catalogo').getPublicUrl(nombre);
  if (!pub.data?.publicUrl) throw new Error('No se pudo obtener la URL de la foto.');
  return pub.data.publicUrl as string;
}
