// Browser-side image prep for shop images (23 Nov). Everything is resized
// on the phone before upload so a 6 MB camera photo becomes a few hundred
// KB, and the server only ever stores small JPEG/PNG data URLs.

function load(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(new Error('not_image')); return; }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('bad_image')); };
    img.src = URL.createObjectURL(file);
  });
}

function draw(img: HTMLImageElement, max: number, fill?: string) {
  const sc = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(img.width * sc));
  cv.height = Math.max(1, Math.round(img.height * sc));
  const g = cv.getContext('2d')!;
  if (fill) { g.fillStyle = fill; g.fillRect(0, 0, cv.width, cv.height); }
  g.drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(img.src);
  return cv;
}

/** Logo: ≤512px, PNG (keeps a transparent background) unless JPEG is needed to fit ~400 KB. */
export async function prepLogo(file: File): Promise<string> {
  const cv = draw(await load(file), 512);
  let out = cv.toDataURL('image/png');
  if (out.length <= 400000) return out;
  const flat = document.createElement('canvas'); flat.width = cv.width; flat.height = cv.height;
  const g = flat.getContext('2d')!; g.fillStyle = '#fff'; g.fillRect(0, 0, flat.width, flat.height); g.drawImage(cv, 0, 0);
  let q = 0.9; out = flat.toDataURL('image/jpeg', q);
  while (out.length > 400000 && q > 0.4) { q -= 0.1; out = flat.toDataURL('image/jpeg', q); }
  return out;
}

/** Shop photo: ≤1400px JPEG under ~860 KB. */
export async function prepPhoto(file: File): Promise<string> {
  const cv = draw(await load(file), 1400, '#fff');
  let q = 0.85; let out = cv.toDataURL('image/jpeg', q);
  while (out.length > 860000 && q > 0.35) { q -= 0.1; out = cv.toDataURL('image/jpeg', q); }
  return out;
}
