// Image preloader. Audio files are loaded through audio.load().

/** @type {Map<string, HTMLImageElement>} */
const images = new Map();

/**
 * Load images in parallel. Paths are relative to index.html (e.g. './assets/hero.png').
 * @param {Record<string, string>} manifest name -> url
 * @param {(done: number, total: number) => void} [onProgress]
 */
export async function loadImages(manifest, onProgress) {
  const entries = Object.entries(manifest);
  let done = 0;
  await Promise.all(
    entries.map(async ([name, url]) => {
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => {
        throw new Error(`Could not load image "${name}" from ${url}`);
      });
      images.set(name, img);
      onProgress?.(++done, entries.length);
    })
  );
}

/** @param {string} name */
export function image(name) {
  const img = images.get(name);
  if (!img) throw new Error(`Image not loaded: ${name}`);
  return img;
}
