export function shortUrl(url, max = 80) {
  const text = String(url ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
