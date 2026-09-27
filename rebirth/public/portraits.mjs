/** Upper-body selection art loads independently from battle sprites. */
const PORTRAIT_REVISION = "7.4";
const ids = new Set(['saber', 'archer', 'gilgamesh', 'lancer', 'medusa', 'iskandar', 'gojo', 'heracles', 'allmight', 'katja', 'magnus', 'ambessa', 'acheron', 'boothill']);
const warmed = new Map();
export function portraitURL(character, large = false) {
  if (!ids.has(character)) throw new Error(`Unknown portrait: ${character}`);
  return new URL(`./art/portraits/${character}${large ? '' : '-thumb'}.webp?v=${PORTRAIT_REVISION}`, import.meta.url).href;
}
export function setPortrait(image, character, { large = false, label = '' } = {}) {
  const url = portraitURL(character, large);
  if (image.src !== url) image.src = url;
  if (image.alt !== label) image.alt = label;
  image.dataset.character = character;
}
export function warmPortrait(character) {
  if (!warmed.has(character)) {
    const image = new Image();
    image.decoding = 'async';
    image.src = portraitURL(character, true);
    warmed.set(character, image);
  }
}
