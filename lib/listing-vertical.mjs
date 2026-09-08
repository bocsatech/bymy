
const TEHER_SUBTYPES = new Set(["kisteher", "teherauto", "teher"]);

export function resolveVerticalFromFields(verticalRaw, alkategoriaRaw) {
  const vertical = String(verticalRaw ?? "")
    .trim()
    .toLowerCase();
  const sub = String(alkategoriaRaw ?? "")
    .trim()
    .toLowerCase();

  if (vertical === "teher" || vertical === "ingatlan" || vertical === "auto") {
    if (vertical === "auto" && TEHER_SUBTYPES.has(sub)) return "teher";
    return vertical;
  }
  if (TEHER_SUBTYPES.has(sub)) return "teher";
  if (sub === "ingatlan" || sub.startsWith("ingatlan")) return "ingatlan";
  return "auto";
}

export function resolveListingVertical(item) {
  const filter = item?.preview?.filter ?? {};
  const form = item?.form ?? {};
  return resolveVerticalFromFields(
    filter.hirdetes_vertical ?? form.hirdetes_vertical,
    filter.hirdetes_alkategoria ?? form.hirdetes_alkategoria
  );
}

export function normalizeFormVertical(formData = {}) {
  const data = { ...formData };
  const next = resolveVerticalFromFields(data.hirdetes_vertical, data.hirdetes_alkategoria);
  data.hirdetes_vertical = next;
  return data;
}
