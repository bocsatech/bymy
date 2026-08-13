import { buildYouTubeEmbedHtml } from "./youtube-embed.js";

const SIDE_KEYS = ["left", "right"];
const VIDEO_COUNT = 3;

function getPresentSides() {
  return SIDE_KEYS.filter((side) => document.querySelector(`[data-site-side="${side}"]`));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getPageId() {
  return document.body?.dataset?.sitePage || document.querySelector("[data-site-page]")?.dataset?.sitePage || "home";
}

async function fetchPageBlocks(page) {
  const response = await fetch(`/api/site-blocks?page=${encodeURIComponent(page)}`);
  if (!response.ok) throw new Error("Nem sikerült betölteni az oldalsáv tartalmat.");
  return response.json();
}

async function savePageBlocks(page, payload) {
  const response = await fetch("/api/site-blocks", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ page, ...payload }),
  });
  if (!response.ok) throw new Error("Mentés sikertelen.");
  return response.json();
}

function renderVideoSlots(container, videos, { editing = false } = {}) {
  container.innerHTML = "";
  for (let index = 0; index < VIDEO_COUNT; index += 1) {
    const url = videos[index] ?? "";
    const slot = document.createElement("div");
    slot.className = "site-video-slot";
    if (!url && !editing) slot.classList.add("site-video-slot--empty");

    if (editing) {
      slot.innerHTML = `
        <label class="site-video-edit-label">
          <span>YouTube link ${index + 1}</span>
          <input type="url" class="site-video-input" data-video-index="${index}" value="${escapeHtml(url)}" placeholder="https://www.youtube.com/watch?v=…">
        </label>
      `;
    } else if (url) {
      const embed = buildYouTubeEmbedHtml(url);
      slot.innerHTML = embed || `<span class="site-video-placeholder">Érvénytelen YouTube link</span>`;
    } else {
      slot.innerHTML = `<span class="site-video-placeholder">Videó helye ${index + 1}</span>`;
    }

    container.appendChild(slot);
  }
}

function renderCenter(data, { editing = false } = {}) {
  const wrap = document.querySelector("[data-center-content]");
  if (!wrap) return;

  const titleEl = wrap.querySelector("[data-center-title]");
  const bodyEl = wrap.querySelector("[data-center-body]");
  if (!titleEl || !bodyEl) return;

  if (editing) {
    titleEl.innerHTML = `<input type="text" class="site-side-input home-center-input" data-edit-center-title value="${escapeHtml(data.title)}">`;
    bodyEl.innerHTML = `<textarea class="site-side-textarea home-center-textarea" data-edit-center-html rows="10">${escapeHtml(data.html)}</textarea>`;
    return;
  }

  titleEl.textContent = data.title;
  bodyEl.innerHTML = data.html;
}

function readCenter() {
  const wrap = document.querySelector("[data-center-content]");
  return {
    title: wrap?.querySelector("[data-edit-center-title]")?.value?.trim() ?? "",
    html: wrap?.querySelector("[data-edit-center-html]")?.value?.trim() ?? "",
  };
}

function renderPanel(side, data, { editing = false } = {}) {
  const panel = document.querySelector(`[data-site-side="${side}"]`);
  if (!panel) return;

  const titleEl = panel.querySelector("[data-side-title]");
  const videosEl = panel.querySelector("[data-side-videos]");
  if (!titleEl || !videosEl) return;

  if (editing) {
    titleEl.innerHTML = `<input type="text" class="site-side-input" data-edit-title value="${escapeHtml(data.title)}">`;
  } else {
    titleEl.textContent = data.title;
  }

  renderVideoSlots(videosEl, data.videos ?? [], { editing });
}

function readPanel(side) {
  const panel = document.querySelector(`[data-site-side="${side}"]`);
  const title = panel?.querySelector("[data-edit-title]")?.value ?? panel?.querySelector("[data-side-title]")?.textContent ?? "";
  const videos = [];
  panel?.querySelectorAll("[data-video-index]").forEach((input) => {
    videos[Number(input.dataset.videoIndex)] = input.value.trim();
  });
  while (videos.length < VIDEO_COUNT) videos.push("");
  return { title: title.trim(), videos: videos.slice(0, VIDEO_COUNT) };
}

export async function initSiteSideContent() {
  const page = getPageId();
  const editBtn = document.getElementById("site-side-edit");
  const saveBtn = document.getElementById("site-side-save");
  const cancelBtn = document.getElementById("site-side-cancel");
  const toolbar = document.getElementById("site-side-toolbar");

  if (!document.querySelector("[data-site-side]")) return;

  let blocks = await fetchPageBlocks(page);
  let editing = false;

  const pageData = {
    left: blocks.left,
    right: blocks.right,
    center: blocks.center ?? null,
  };

  const renderAll = () => {
    for (const side of getPresentSides()) {
      renderPanel(side, pageData[side], { editing });
    }
    if (document.querySelector("[data-center-content]") && pageData.center) {
      renderCenter(pageData.center, { editing });
    }
    if (toolbar) toolbar.hidden = !editing;
    if (editBtn) editBtn.hidden = editing;
  };

  renderAll();

  editBtn?.addEventListener("click", () => {
    editing = true;
    renderAll();
  });

  cancelBtn?.addEventListener("click", async () => {
    editing = false;
    blocks = await fetchPageBlocks(page);
    pageData.left = blocks.left;
    pageData.right = blocks.right;
    pageData.center = blocks.center ?? pageData.center;
    renderAll();
  });

  saveBtn?.addEventListener("click", async () => {
    const payload = {};
    for (const side of getPresentSides()) {
      payload[side] = readPanel(side);
    }
    if (document.querySelector("[data-center-content]")) {
      payload.center = readCenter();
    }
    const saved = await savePageBlocks(page, payload);
    for (const side of getPresentSides()) {
      pageData[side] = saved.pages[page][side];
    }
    if (saved.pages[page].center) {
      pageData.center = saved.pages[page].center;
    }
    editing = false;
    renderAll();
  });
}
