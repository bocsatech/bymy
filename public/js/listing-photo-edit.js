/**
 * Willhaben-szerű képszerkesztő: forgatás + zoom/pan a keretben.
 * A keret pontosan mutatja, mi fér bele; a kereten kívüli rész elsötétül.
 * Kimenet: JPEG File (a meglévő feltöltő pipeline-hoz).
 */

const DEFAULT_ASPECT = 4 / 3;
const OUT_MAX_SIDE = 1600;
const MAX_ZOOM_FACTOR = 4;

function normalizeAspect(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0.25 || n > 8) return DEFAULT_ASPECT;
  return n;
}

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

async function loadImageSource(source) {
  if (source instanceof Blob) {
    if (typeof createImageBitmap === "function") {
      try {
        const bmp = await createImageBitmap(source);
        return { image: bmp, close: () => bmp.close?.() };
      } catch {
        /* fall through to Image */
      }
    }
    const url = URL.createObjectURL(source);
    try {
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("A kép betöltése sikertelen."));
        el.src = url;
      });
      return {
        image: img,
        close: () => URL.revokeObjectURL(url),
      };
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
  }

  const url = String(source || "").trim();
  if (!url) throw new Error("A kép nem olvasható.");
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () =>
      reject(new Error("A kép nem tölthető be szerkesztéshez (CORS vagy hálózat)."));
    el.src = url;
  });
  return { image: img, close: () => {} };
}

function naturalSize(image) {
  return {
    w: image.naturalWidth || image.width || 0,
    h: image.naturalHeight || image.height || 0,
  };
}

function rotatedSize(w, h, deg) {
  const r = ((deg % 360) + 360) % 360;
  return r === 90 || r === 270 ? { w: h, h: w } : { w, h };
}

function coverScale(frameW, frameH, imgW, imgH) {
  return Math.max(frameW / imgW, frameH / imgH);
}

function canvasToJpegFile(canvas, fileName) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("A kép mentése sikertelen."));
          return;
        }
        const base = String(fileName || "photo.jpg").replace(/\.[^.]+$/, "") || "photo";
        resolve(new File([blob], `${base}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92
    );
  });
}

/**
 * @param {{ source: Blob|string, fileName?: string, aspect?: number, onSave?: (file: File) => void|Promise<void> }} opts
 * @returns {Promise<File|null>} null = cancelled
 */
export function openListingPhotoEditor({
  source,
  fileName = "photo.jpg",
  aspect: aspectInput,
  onSave,
} = {}) {
  return new Promise(async (resolve, reject) => {
    const ASPECT = normalizeAspect(aspectInput);
    let settled = false;
    let loaded;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    try {
      loaded = await loadImageSource(source);
    } catch (error) {
      reject(error);
      return;
    }

    const { w: srcW, h: srcH } = naturalSize(loaded.image);
    if (!srcW || !srcH) {
      loaded.close?.();
      reject(new Error("A kép mérete nem olvasható."));
      return;
    }

    const root = document.createElement("div");
    root.className = "lpe-root";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", "Kép szerkesztése");
    root.innerHTML = `
      <div class="lpe-sheet">
        <header class="lpe-head">
          <h2 class="lpe-title">Kép szerkesztése</h2>
          <button type="button" class="lpe-close" data-lpe-close aria-label="Bezárás">×</button>
        </header>
        <div class="lpe-stage">
          <div class="lpe-viewport" data-lpe-viewport>
            <canvas class="lpe-canvas" data-lpe-canvas></canvas>
            <div class="lpe-crop" data-lpe-frame aria-hidden="true">
              <span class="lpe-crop-corner lpe-crop-corner--tl"></span>
              <span class="lpe-crop-corner lpe-crop-corner--tr"></span>
              <span class="lpe-crop-corner lpe-crop-corner--bl"></span>
              <span class="lpe-crop-corner lpe-crop-corner--br"></span>
            </div>
          </div>
          <div class="lpe-hint">A világos keret = ami befér. Csippentsd / görgesd a nagyításhoz · húzd az igazításhoz</div>
          <div class="lpe-rotates">
            <button type="button" class="lpe-rotate" data-lpe-rot="-90" aria-label="Forgatás balra">↺</button>
            <button type="button" class="lpe-rotate" data-lpe-rot="90" aria-label="Forgatás jobbra">↻</button>
          </div>
        </div>
        <footer class="lpe-foot">
          <button type="button" class="lpe-btn lpe-btn--cancel" data-lpe-close>Mégse</button>
          <button type="button" class="lpe-btn lpe-btn--done" data-lpe-done>Kész</button>
        </footer>
      </div>
    `;
    document.body.appendChild(root);
    document.body.classList.add("lpe-open");

    const viewport = root.querySelector("[data-lpe-viewport]");
    const frame = root.querySelector("[data-lpe-frame]");
    const canvas = root.querySelector("[data-lpe-canvas]");
    const ctx = canvas.getContext("2d");

    // Keret aránya = a tényleges megjelenés (pl. borító széles, logo négyzet)
    frame.style.aspectRatio = String(ASPECT);
    if (ASPECT >= 1.35) {
      viewport.classList.add("lpe-viewport--wide");
      viewport.style.aspectRatio = String(ASPECT);
    } else if (ASPECT <= 0.85) {
      viewport.classList.add("lpe-viewport--tall");
      viewport.style.aspectRatio = "3 / 4";
    } else {
      viewport.classList.add("lpe-viewport--square");
      viewport.style.aspectRatio = "1";
    }

    let rotation = 0;
    let scale = 1;
    let tx = 0;
    let ty = 0;
    let minScale = 1;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const pointers = new Map();
    let pinchStartDist = 0;
    let pinchStartScale = 1;

    /** Keret mérete és középpontja a viewportban (CSS px). */
    function cropGeom() {
      const v = viewport.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      const fw = Math.max(1, f.width);
      const fh = Math.max(1, f.height);
      return {
        vw: Math.max(1, v.width),
        vh: Math.max(1, v.height),
        fw,
        fh,
        cx: f.left - v.left + fw / 2,
        cy: f.top - v.top + fh / 2,
      };
    }

    function syncCanvasPixelSize() {
      const { vw, vh } = cropGeom();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function clampOffset() {
      const { fw, fh } = cropGeom();
      const { w, h } = rotatedSize(srcW, srcH, rotation);
      const dw = w * scale;
      const dh = h * scale;
      const maxX = Math.max(0, (dw - fw) / 2);
      const maxY = Math.max(0, (dh - fh) / 2);
      tx = clamp(tx, -maxX, maxX);
      ty = clamp(ty, -maxY, maxY);
    }

    function paint() {
      const { vw, vh, cx, cy } = cropGeom();
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dpr = canvas.width / vw;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#1a1d23";
      ctx.fillRect(0, 0, vw, vh);
      ctx.translate(cx + tx, cy + ty);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);
      ctx.drawImage(loaded.image, -srcW / 2, -srcH / 2, srcW, srcH);
      ctx.restore();
    }

    function resetToCover() {
      const { fw, fh } = cropGeom();
      const { w, h } = rotatedSize(srcW, srcH, rotation);
      minScale = coverScale(fw, fh, w, h);
      scale = minScale;
      tx = 0;
      ty = 0;
      paint();
    }

    function onResize() {
      syncCanvasPixelSize();
      const { fw, fh } = cropGeom();
      const { w, h } = rotatedSize(srcW, srcH, rotation);
      minScale = coverScale(fw, fh, w, h);
      scale = Math.max(scale, minScale);
      clampOffset();
      paint();
    }

    function cleanup() {
      window.removeEventListener("resize", onResize);
      document.body.classList.remove("lpe-open");
      root.remove();
      loaded.close?.();
    }

    // Layout után méret — különben a keret 0×0 lehet
    requestAnimationFrame(() => {
      syncCanvasPixelSize();
      resetToCover();
      requestAnimationFrame(() => {
        syncCanvasPixelSize();
        resetToCover();
      });
    });
    window.addEventListener("resize", onResize);

    root.querySelectorAll("[data-lpe-close]").forEach((btn) => {
      btn.addEventListener("click", () => finish(null));
    });

    root.querySelectorAll("[data-lpe-rot]").forEach((btn) => {
      btn.addEventListener("click", () => {
        rotation = (rotation + Number(btn.getAttribute("data-lpe-rot") || 0) + 360) % 360;
        syncCanvasPixelSize();
        resetToCover();
      });
    });

    viewport.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
        scale = clamp(scale * factor, minScale, minScale * MAX_ZOOM_FACTOR);
        clampOffset();
        paint();
      },
      { passive: false }
    );

    viewport.addEventListener("pointerdown", (event) => {
      viewport.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        dragging = true;
        lastX = event.clientX;
        lastY = event.clientY;
      } else if (pointers.size === 2) {
        dragging = false;
        const pts = [...pointers.values()];
        pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        pinchStartScale = scale;
      }
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const pts = [...pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
        scale = clamp(
          pinchStartScale * (dist / pinchStartDist),
          minScale,
          minScale * MAX_ZOOM_FACTOR
        );
        clampOffset();
        paint();
        return;
      }
      if (!dragging) return;
      tx += event.clientX - lastX;
      ty += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      clampOffset();
      paint();
    });

    const endPointer = (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) dragging = false;
      if (pointers.size === 1) {
        const only = [...pointers.values()][0];
        dragging = true;
        lastX = only.x;
        lastY = only.y;
      }
    };
    viewport.addEventListener("pointerup", endPointer);
    viewport.addEventListener("pointercancel", endPointer);

    root.querySelector("[data-lpe-done]").addEventListener("click", async () => {
      const doneBtn = root.querySelector("[data-lpe-done]");
      doneBtn.disabled = true;
      doneBtn.textContent = "Mentés…";
      try {
        let canvasW = OUT_MAX_SIDE;
        let canvasH = Math.max(1, Math.round(canvasW / ASPECT));
        if (canvasH > OUT_MAX_SIDE) {
          canvasH = OUT_MAX_SIDE;
          canvasW = Math.max(1, Math.round(canvasH * ASPECT));
        }

        const out = document.createElement("canvas");
        out.width = canvasW;
        out.height = canvasH;
        const octx = out.getContext("2d");
        if (!octx) throw new Error("A kép rajzolása sikertelen.");

        const { fw, fh } = cropGeom();
        const sx = canvasW / fw;
        const sy = canvasH / fh;

        octx.fillStyle = "#fff";
        octx.fillRect(0, 0, canvasW, canvasH);
        octx.save();
        octx.translate(canvasW / 2 + tx * sx, canvasH / 2 + ty * sy);
        octx.rotate((rotation * Math.PI) / 180);
        octx.scale(scale * sx, scale * sy);
        octx.drawImage(loaded.image, -srcW / 2, -srcH / 2, srcW, srcH);
        octx.restore();

        const file = await canvasToJpegFile(out, fileName);
        if (typeof onSave === "function") await onSave(file);
        finish(file);
      } catch (error) {
        doneBtn.disabled = false;
        doneBtn.textContent = "Kész";
        alert(error?.message || "A kép mentése sikertelen.");
      }
    });

    root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") finish(null);
    });
  });
}
