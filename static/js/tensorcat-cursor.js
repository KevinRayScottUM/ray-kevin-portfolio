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
      '<span class="tensorcat-tail"></span>' +
      '<span class="tensorcat-cursor-core">' +
      '<span class="tensorcat-ear tensorcat-ear-left"></span>' +
      '<span class="tensorcat-ear tensorcat-ear-right"></span>' +
      '<span class="tensorcat-eye tensorcat-eye-left"></span>' +
      '<span class="tensorcat-eye tensorcat-eye-right"></span>' +
      '<span class="tensorcat-nose"></span>' +
      "</span>";
    document.body.appendChild(node);
    return node;
  }

  function render() {
    cursor.x += (pointer.x - cursor.x) * 0.28;
    cursor.y += (pointer.y - cursor.y) * 0.28;

    if (cursorNode) {
      cursorNode.style.transform =
        "translate3d(" + (cursor.x - 8) + "px, " + (cursor.y - 10) + "px, 0)";
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
    }, 360);
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
