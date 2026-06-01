(function () {
  var enabled = false;
  var clickInverted = false;
  var pointer = { x: -80, y: -80 };
  var cursor = { x: -80, y: -80 };
  var cursorNode = null;
  var rafId = null;
  var clickTimer = null;

  function supportsFinePointer() {
    return window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  }

  function createCursor() {
    var node = document.createElement("div");
    node.className = "tensorcat-cursor";
    node.setAttribute("aria-hidden", "true");
    node.innerHTML =
      '<svg class="tensorcat-cursor-svg" viewBox="0 0 256 256" focusable="false">' +
      '<g class="tensorcat-cursor-tail">' +
      '<path d="M118 182 C89 209 119 239 149 221 C170 208 159 185 140 195" fill="none" stroke="#ffffff" stroke-width="15" stroke-linecap="round"/>' +
      '<path d="M118 182 C89 209 119 239 149 221 C170 208 159 185 140 195" fill="none" stroke="#111827" stroke-width="9" stroke-linecap="round"/>' +
      "</g>" +
      '<g class="tensorcat-cursor-head">' +
      '<path d="M38 22 L82 98 L55 142 L39 188 L107 155 L128 184 L128 63 Z" fill="#111827" stroke="#ffffff" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="M128 63 L218 22 L198 111 L218 168 L159 166 L128 184 Z" fill="#ffffff" stroke="#111827" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path class="tensorcat-cursor-ear tensorcat-cursor-ear-left" d="M62 35 L90 97 L75 83 Z" fill="#ffffff" stroke="#111827" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path class="tensorcat-cursor-ear tensorcat-cursor-ear-right" d="M194 35 L170 96 L185 82 Z" fill="#111827" stroke="#ffffff" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<path d="M128 62 L128 184" stroke="#111827" stroke-width="3" opacity="0.9"/>' +
      '<path d="M70 116 C88 108 101 110 112 120 C96 125 80 129 70 116 Z" fill="#ffffff"/>' +
      '<circle cx="96" cy="118" r="5" fill="#111827"/>' +
      '<path d="M144 120 C158 108 177 106 190 115 C178 130 159 127 144 120 Z" fill="#111827"/>' +
      '<circle cx="164" cy="118" r="5" fill="#ffffff"/>' +
      '<path d="M116 151 L128 146 L140 151 L128 160 Z" fill="#ffffff" stroke="#111827" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M128 160 Q118 172 104 174 M128 160 Q140 172 154 174" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>' +
      '<path class="tensorcat-cursor-whiskers" d="M47 145 L8 132 M52 157 L10 162 M204 145 L244 132 M199 157 L242 162" stroke="#111827" stroke-width="5" stroke-linecap="round"/>' +
      '<path class="tensorcat-cursor-whiskers-light" d="M47 145 L8 132 M52 157 L10 162 M204 145 L244 132 M199 157 L242 162" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>' +
      "</g>" +
      "</svg>";
    document.body.appendChild(node);
    return node;
  }

  function render() {
    cursor.x += (pointer.x - cursor.x) * 0.28;
    cursor.y += (pointer.y - cursor.y) * 0.28;

    if (cursorNode) {
      cursorNode.style.transform =
        "translate3d(" + (cursor.x - 23) + "px, " + (cursor.y - 23) + "px, 0)";
    }

    rafId = window.requestAnimationFrame(render);
  }

  function showCursor(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (cursorNode) cursorNode.classList.add("is-visible");
  }

  function hideCursor() {
    if (cursorNode) cursorNode.classList.remove("is-visible");
  }

  function pulseCursor() {
    if (!cursorNode) return;

    window.clearTimeout(clickTimer);
    cursorNode.classList.add("is-clicking");
    clickTimer = window.setTimeout(function () {
      cursorNode.classList.remove("is-clicking");
    }, 540);
  }

  function createClickPop(event) {
    var pop = document.createElement("div");
    pop.className = "tensorcat-click-pop" + (clickInverted ? " is-inverted" : "");
    pop.style.left = event.clientX + "px";
    pop.style.top = event.clientY + "px";
    pop.innerHTML =
      '<span class="tensorcat-word-tensor">Tensor</span>' +
      '<span class="tensorcat-word-cat">Cat</span>';

    clickInverted = !clickInverted;
    document.body.appendChild(pop);

    window.setTimeout(function () {
      if (pop.parentNode) pop.parentNode.removeChild(pop);
    }, 1100);
  }

  function init() {
    if (enabled || !supportsFinePointer()) return;

    enabled = true;
    document.documentElement.classList.add("tensorcat-cursor-enabled");
    cursorNode = createCursor();

    document.addEventListener("pointermove", showCursor, { passive: true });
    document.addEventListener("pointerleave", hideCursor, { passive: true });
    document.addEventListener("pointerdown", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      showCursor(event);
      pulseCursor();
      createClickPop(event);
    });

    rafId = window.requestAnimationFrame(render);
  }

  function destroy() {
    enabled = false;
    document.documentElement.classList.remove("tensorcat-cursor-enabled");
    if (rafId) window.cancelAnimationFrame(rafId);
    if (cursorNode && cursorNode.parentNode) cursorNode.parentNode.removeChild(cursorNode);
    cursorNode = null;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  if (window.matchMedia) {
    var pointerQuery = window.matchMedia("(pointer: fine)");
    if (pointerQuery.addEventListener) {
      pointerQuery.addEventListener("change", function (event) {
        if (event.matches) init();
        else destroy();
      });
    }
  }
})();
