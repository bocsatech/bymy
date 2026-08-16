/** Vízszintes feed-sáv: egérrel húzható görgetés, scrollbar nélkül. */
function initHubRailDrag(root = document) {
  root.querySelectorAll(".hf-rail").forEach((rail) => {
    if (rail.dataset.dragBound === "1") return;
    rail.dataset.dragBound = "1";

    let pointerId = null;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    rail.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "touch") return;
      if (event.button != null && event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = rail.scrollLeft;
      moved = false;
      rail.classList.add("is-dragging");
      try {
        rail.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
    });

    rail.addEventListener("pointermove", (event) => {
      if (pointerId == null || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      rail.scrollLeft = startScroll - dx;
    });

    function endDrag(event) {
      if (pointerId == null || event.pointerId !== pointerId) return;
      pointerId = null;
      rail.classList.remove("is-dragging");
      if (moved) {
        rail.dataset.suppressClick = "1";
        window.setTimeout(() => {
          delete rail.dataset.suppressClick;
        }, 0);
      }
    }

    rail.addEventListener("pointerup", endDrag);
    rail.addEventListener("pointercancel", endDrag);

    rail.addEventListener(
      "click",
      (event) => {
        if (rail.dataset.suppressClick === "1") {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      true
    );
  });
}

initHubRailDrag();
