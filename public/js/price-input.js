/** Csoportosított ármezők (hu-HU: 3 700 000) — ugyanaz a logika, mint km. */
export {
  parseKmDigits as parsePriceDigits,
  formatKmDigits as formatPriceDigits,
  initKmInput as initPriceInput,
  setKmInputValue as setPriceInputValue,
} from "./km-input.js?v=kmFmt1";

export const PRICE_INPUT_IDS = [
  "vetelar",
  "vetelar_eur",
  "forgalomba_helyezes_ar",
  "akcios_ar",
];
