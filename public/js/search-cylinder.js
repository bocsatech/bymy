/**
 * Keresés oldal — közös 3D henger-dobkerék (autó / teher / ingatlan almenük).
 * Snap + haptic; kattintásra megnyílik a kiválasztott kereső.
 * Folytonos forgás max 20 teljes körig, utána megáll (nincs végtelen wrap-ugrás).
 */

import { lockPageScroll, unlockPageScroll } from "./ingatlan-wheels.js?v=scrollLock7";

const ITEMS = [
  {
    id: "szemelyauto",
    label: "Személyautó",
    group: "Autó",
    image: "/images/categories/benzin.png?v=cyl1",
    href: "/auto.html",
  },
  {
    id: "leasing",
    label: "Lizingelhető",
    group: "Autó",
    image: "/images/categories/leasing.png?v=cyl1",
    href: "/auto.html?cat=leasing",
  },
  {
    id: "berauto",
    label: "Bérelhető",
    group: "Autó",
    image: "/images/categories/berelheto.png?v=cyl1",
    href: "/auto.html?cat=berelheto",
  },
  {
    id: "lakokocsi",
    label: "Bérelhető Lakókocsi",
    group: "Autó",
    image: "/images/categories/lakokocsi.png?v=cyl1",
    href: "/auto.html?cat=lakokocsi",
  },
  {
    id: "kisteher",
    label: "Kisteherautó 3,5-ig",
    group: "Teherautó",
    image: "/images/categories/kisteher.png?v=cyl1",
    href: "/teherauto.html?kategoria=35-alatt",
  },
  {
    id: "teherauto",
    label: "Teherautó 3,5-től",
    group: "Teherautó",
    image: "/images/categories/teherauto.png?v=cyl1",
    href: "/teherauto.html?kategoria=35-felett",
  },
  {
    id: "elado",
    label: "Eladó Ingatlanok",
    group: "Ingatlan",
    image: "/images/hub-ingatlan-01-hazak.png?v=cyl1",
    href: "/ingatlan.html?tipus=elado",
  },
  {
    id: "kiado",
    label: "Kiadó Ingatlanok",
    group: "Ingatlan",
    image: "/images/hub-ingatlan-02-lakasok.png?v=cyl1",
    href: "/ingatlan.html?tipus=kiado",
  },
  {
    id: "airbnb",
    label: "Airbnb Ingatlanok",
    group: "Ingatlan",
    image: "/images/hub-ingatlan-photo.jpg?v=cyl1",
    href: "/ingatlan.html?tipus=airbnb",
  },
];

const STEP_DEG = 40;
const FRICTION = 0.92;
const SNAP_EPS = 0.35;
/** Max teljes fordulat mindkét irányban — utána nem forog tovább. */
const MAX_REVS = 20;
const MAX_ANGLE = MAX_REVS * 360;
/** iOS ujjremegés alatt ennyi px alatt még koppintás, nem húzás. */
const DRAG_START_PX = 28;
const TAP_MAX_PX = 36;

function clampAngle(a) {
  return Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, a));
}

function itemIndexFromAngle(angleDeg, n) {
  const raw = Math.round(-angleDeg / STEP_DEG);
  const m = ((raw % n) + n) % n;
  return (n - 1 - m) % n;
}

/** Snap a legközelebbi lépésre — NEM ugrik vissza az első fordulatra. */
function snapAngleNear(angleDeg) {
  const stepped = Math.round(angleDeg / STEP_DEG) * STEP_DEG;
  return clampAngle(stepped);
}

function hapticCenterLock() {
  try {
    if (!navigator.vibrate) return;
    /* Rövid „beugrás” — rezgőmotor-szerű, ahol a böngésző engedi (legtöbb Android). */
    navigator.vibrate([14, 24, 10]);
  } catch {
    /* ignore */
  }
}

export function initSearchCylinder(root = document) {
  const viewport = root.querySelector("[data-cyl-viewport]");
  const drum = root.querySelector("[data-cyl-drum]");
  if (!viewport || !drum) return;

  const n = ITEMS.length;
  const radius = (() => {
    const h = Math.max(120, Math.min(window.innerWidth * 0.42, 168));
    return h / (2 * Math.tan(((STEP_DEG / 2) * Math.PI) / 180));
  })();

  drum.style.setProperty("--cyl-radius", `${radius.toFixed(1)}px`);
  drum.style.setProperty("--cyl-step", `${STEP_DEG}deg`);

  drum.innerHTML = ITEMS.map(
    (item, i) => `
    <a class="cyl-face" href="${item.href}" data-cyl-index="${i}" data-cyl-id="${item.id}"
      style="--i:${n - 1 - i}" aria-label="${item.label}" draggable="false">
      <span class="cyl-face__media">
        <img src="${item.image}" alt="" width="640" height="360" decoding="async" draggable="false" />
      </span>
      <span class="cyl-face__copy">
        <span class="cyl-face__group">${item.group}</span>
        <strong class="cyl-face__label">${item.label}</strong>
      </span>
    </a>`
  ).join("");

  const faces = [...drum.querySelectorAll(".cyl-face")];
  let angle = -(n - 1) * STEP_DEG;
  let velocity = 0;
  let index = 0;
  let pointerId = null;
  let dragActive = false;
  let pointerDown = false;
  let lastY = 0;
  let lastT = 0;
  let raf = 0;
  let primed = false;
  let tapFace = null;
  let tapStartX = 0;
  let tapStartY = 0;
  let blockFaceNavUntil = 0;
  let lastNavAt = 0;
  let lastHapticIndex = -1;

  function faceFromEvent(ev) {
    return ev.target?.closest?.(".cyl-face") ?? null;
  }

  function activeFace() {
    return faces[itemIndexFromAngle(angle, n)] ?? null;
  }

  function openFace(face) {
    if (!face) return false;
    const href = face.getAttribute("href") || ITEMS[Number(face.dataset.cylIndex)]?.href;
    if (!href) return false;
    if (performance.now() - lastNavAt < 700) return true;
    lastNavAt = performance.now();
    window.location.assign(href);
    return true;
  }

  function setDragVisual(on) {
    viewport.classList.toggle("is-dragging", on);
    document.body.toggleAttribute("data-cyl-dragging", on);
  }

  function setAngle(next) {
    const clamped = clampAngle(next);
    const hitEnd = clamped !== next;
    angle = clamped;
    if (hitEnd) velocity = 0;
    return !hitEnd;
  }

  function notifyCentered(force = false) {
    if (!primed) return;
    const active = itemIndexFromAngle(angle, n);
    if (!force && active === lastHapticIndex) return;
    lastHapticIndex = active;
    index = active;
    hapticCenterLock();
  }

  function paint() {
    drum.style.transform = `translateZ(${-radius}px) rotateX(${angle}deg)`;
    const active = itemIndexFromAngle(angle, n);
    faces.forEach((face, i) => {
      let dist = Math.abs(i - active);
      dist = Math.min(dist, n - dist);
      face.classList.toggle("is-active", i === active);
      face.classList.toggle("is-near", dist === 1);
      face.classList.toggle("is-far", dist > 1);
      face.setAttribute("aria-current", i === active ? "true" : "false");
      face.tabIndex = i === active ? 0 : -1;
    });
    index = active;
  }

  function snapToNearest() {
    const target = snapAngleNear(angle);
    const start = angle;
    const dist = target - start;
    if (Math.abs(dist) < SNAP_EPS) {
      angle = target;
      velocity = 0;
      paint();
      notifyCentered();
      return;
    }
    const t0 = performance.now();
    const dur = Math.min(280, 120 + Math.abs(dist) * 3);
    cancelAnimationFrame(raf);
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      setAngle(start + dist * ease);
      paint();
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        angle = target;
        velocity = 0;
        paint();
        notifyCentered();
      }
    };
    raf = requestAnimationFrame(tick);
  }

  function coast() {
    cancelAnimationFrame(raf);
    const step = () => {
      if (pointerDown && dragActive) return;
      const ok = setAngle(angle + velocity);
      if (!ok) {
        velocity = 0;
        snapToNearest();
        return;
      }
      velocity *= FRICTION;
      paint();
      if (Math.abs(velocity) > 0.08) raf = requestAnimationFrame(step);
      else {
        velocity = 0;
        snapToNearest();
      }
    };
    raf = requestAnimationFrame(step);
  }

  function pointerMove(ev) {
    if (!pointerDown || ev.pointerId !== pointerId) return;
    const totalMove = Math.hypot(ev.clientX - tapStartX, ev.clientY - tapStartY);
    if (!dragActive) {
      if (totalMove < DRAG_START_PX) return;
      dragActive = true;
      setDragVisual(true);
      viewport.setPointerCapture?.(ev.pointerId);
    }
    const y = ev.clientY;
    const t = performance.now();
    const dy = y - lastY;
    const dt = Math.max(8, t - lastT);
    const dAngle = -dy * 0.28;
    setAngle(angle + dAngle);
    velocity = dAngle * (16 / dt);
    lastY = y;
    lastT = t;
    paint();
    document.dispatchEvent(new CustomEvent("bymy-scroll-activity"));
  }

  function tryOpenFromTap(face) {
    const target = face || tapFace || activeFace();
    if (!target) return false;
    return openFace(target);
  }

  function endPointer(ev) {
    if (ev.pointerId !== pointerId) return;
    const totalMove = Math.hypot(ev.clientX - tapStartX, ev.clientY - tapStartY);
    const wasTap = !dragActive && totalMove < TAP_MAX_PX;
    pointerDown = false;
    pointerId = null;
    setDragVisual(false);
    try {
      viewport.releasePointerCapture?.(ev.pointerId);
    } catch {
      /* ignore */
    }
    const face = tapFace;
    tapFace = null;
    if (wasTap) {
      ev.preventDefault();
      tryOpenFromTap(face);
      return;
    }
    if (dragActive) blockFaceNavUntil = performance.now() + 320;
    dragActive = false;
    if (Math.abs(velocity) > 0.45) coast();
    else snapToNearest();
  }

  function onPointerDown(ev) {
    if (ev.button != null && ev.button !== 0) return;
    pointerDown = true;
    dragActive = false;
    pointerId = ev.pointerId;
    tapFace = faceFromEvent(ev);
    tapStartX = ev.clientX;
    tapStartY = ev.clientY;
    velocity = 0;
    cancelAnimationFrame(raf);
    lastY = ev.clientY;
    lastT = performance.now();
    setDragVisual(false);
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", pointerMove);
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  viewport.addEventListener(
    "wheel",
    (ev) => {
      ev.preventDefault();
      setAngle(angle - ev.deltaY * 0.08);
      paint();
      document.dispatchEvent(new CustomEvent("bymy-scroll-activity"));
      clearTimeout(viewport._cylWheelSnap);
      viewport._cylWheelSnap = setTimeout(() => snapToNearest(), 90);
    },
    { passive: false }
  );

  faces.forEach((face) => {
    face.addEventListener("click", (ev) => {
      if (dragActive || performance.now() < blockFaceNavUntil) {
        ev.preventDefault();
        return;
      }
      ev.preventDefault();
      openFace(face);
    });
  });

  window.addEventListener(
    "keydown",
    (ev) => {
      if (ev.key === "ArrowDown" || ev.key === "ArrowRight") {
        ev.preventDefault();
        const nextAngle = clampAngle(angle - STEP_DEG);
        if (nextAngle === angle) return;
        angle = nextAngle;
        paint();
        snapToNearest();
      } else if (ev.key === "ArrowUp" || ev.key === "ArrowLeft") {
        ev.preventDefault();
        const nextAngle = clampAngle(angle + STEP_DEG);
        if (nextAngle === angle) return;
        angle = nextAngle;
        paint();
        snapToNearest();
      } else if (ev.key === "Enter") {
        openFace(activeFace());
      }
    },
    { passive: false }
  );

  paint();
  snapToNearest();
  requestAnimationFrame(() => {
    primed = true;
  });

  document.body.classList.add("immo-cyl-scroll-lock");
  lockPageScroll();
  window.addEventListener(
    "pagehide",
    () => {
      document.body.classList.remove("immo-cyl-scroll-lock");
      document.body.removeAttribute("data-cyl-dragging");
      unlockPageScroll(true);
    },
    { once: true }
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initSearchCylinder());
} else {
  initSearchCylinder();
}
