export function extractYouTubeId(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return "";

  if (/^[a-zA-Z0-9_-]{11}$/.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return parsed.pathname.slice(1).split("/")[0] ?? "";
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") ?? "";
      }
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts") {
        return parts[1] ?? "";
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function buildYouTubeEmbedHtml(urlOrId) {
  const id = extractYouTubeId(urlOrId);
  if (!id) return "";
  return `<iframe class="site-video-iframe" src="https://www.youtube.com/embed/${id}" title="YouTube videó" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`;
}
