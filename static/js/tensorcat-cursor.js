(function () {
  var enabled = false;
  var clickInverted = false;
  var pointer = { x: -80, y: -80 };
  var cursor = { x: -80, y: -80 };
  var cursorNode = null;
  var rafId = null;
  var clickTimer = null;
  var lastPointerWrite = 0;
  var CURSOR_SVG_PATH = "/img/cursor/tensorcat_cursor_exact_vector.svg";
  var CURSOR_SVG_CACHE_KEY = "tensorcat-cursor-svg:exact-vector-v1";
  var POINTER_STATE_KEY = "tensorcat-cursor-pointer:v1";
  var POINTER_STATE_TTL = 7000;

  function supportsFinePointer() {
    return window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  }

  function createCursor() {
    var node = document.createElement("div");
    node.className = "tensorcat-cursor";
    node.setAttribute("aria-hidden", "true");
    document.body.appendChild(node);

    var cachedSvg = readCachedSvg();
    if (cachedSvg) {
      inlineCursorSvg(node, cachedSvg);
    }

    loadCursorSvg(node);
    return node;
  }

  function loadCursorSvg(node) {
    if (!window.fetch) {
      if (!node.classList.contains("is-ready")) disableCursor(node);
      return;
    }

    window
      .fetch(CURSOR_SVG_PATH, { cache: "force-cache" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("TensorCat cursor SVG failed to load");
        }
        return response.text();
      })
      .then(function (svgText) {
        if (!node.isConnected) return;
        cacheCursorSvg(svgText);
        inlineCursorSvg(node, svgText);
      })
      .catch(function () {
        if (!node.classList.contains("is-ready")) disableCursor(node);
      });
  }

  function inlineCursorSvg(node, svgText) {
    var template = document.createElement("template");
    template.innerHTML = svgText.trim();

    var svg = template.content.querySelector("svg");
    if (!svg) {
      throw new Error("TensorCat cursor asset is not valid SVG");
    }

    svg.classList.add("tensorcat-cursor-svg");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.removeAttribute("width");
    svg.removeAttribute("height");

    node.replaceChildren(svg);
    node.classList.add("is-ready");
  }

  function disableCursor(node) {
    document.documentElement.classList.remove("tensorcat-cursor-enabled");
    if (node.parentNode) node.parentNode.removeChild(node);
    if (cursorNode === node) cursorNode = null;
  }

  function isValidCursorSvg(svgText) {
    return (
      typeof svgText === "string" &&
      svgText.indexOf("<svg") !== -1 &&
      svgText.indexOf('id="tensorcat-cursor-root"') !== -1 &&
      svgText.indexOf('id="tensorcat-head"') !== -1 &&
      svgText.indexOf('id="tensorcat-tail"') !== -1
    );
  }

  function readCachedSvg() {
    try {
      var svgText = window.sessionStorage.getItem(CURSOR_SVG_CACHE_KEY);
      return isValidCursorSvg(svgText) ? svgText : null;
    } catch (_error) {
      return null;
    }
  }

  function cacheCursorSvg(svgText) {
    if (!isValidCursorSvg(svgText)) return;

    try {
      window.sessionStorage.setItem(CURSOR_SVG_CACHE_KEY, svgText);
    } catch (_error) {
      // The cursor still works; caching only removes the next navigation delay.
    }
  }

  function readPointerState() {
    try {
      var raw = window.sessionStorage.getItem(POINTER_STATE_KEY);
      if (!raw) return null;

      var state = JSON.parse(raw);
      if (!state || Date.now() - state.time > POINTER_STATE_TTL) return null;
      if (!Number.isFinite(state.x) || !Number.isFinite(state.y)) return null;
      if (state.x < -40 || state.y < -40) return null;
      if (state.x > window.innerWidth + 40 || state.y > window.innerHeight + 40) return null;

      return state;
    } catch (_error) {
      return null;
    }
  }

  function rememberPointer(force) {
    var now = Date.now();
    if (!force && now - lastPointerWrite < 90) return;
    lastPointerWrite = now;

    try {
      window.sessionStorage.setItem(
        POINTER_STATE_KEY,
        JSON.stringify({
          x: pointer.x,
          y: pointer.y,
          time: now,
        })
      );
    } catch (_error) {
      // Pointer restoration is a polish feature; normal cursor tracking continues.
    }
  }

  function render() {
    cursor.x += (pointer.x - cursor.x) * 0.28;
    cursor.y += (pointer.y - cursor.y) * 0.28;

    if (cursorNode) {
      cursorNode.style.transform =
        "translate3d(" + (cursor.x - 25) + "px, " + (cursor.y - 25) + "px, 0)";
    }

    rafId = window.requestAnimationFrame(render);
  }

  function placeCursorImmediately() {
    if (!cursorNode) return;
    cursorNode.style.transform =
      "translate3d(" + (cursor.x - 25) + "px, " + (cursor.y - 25) + "px, 0)";
  }

  function showCursor(event, forceRemember) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (cursorNode) cursorNode.classList.add("is-visible");
    rememberPointer(Boolean(forceRemember));
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

    var restoredPointer = readPointerState();
    if (restoredPointer) {
      pointer.x = restoredPointer.x;
      pointer.y = restoredPointer.y;
      cursor.x = restoredPointer.x;
      cursor.y = restoredPointer.y;
    }

    cursorNode = createCursor();
    if (restoredPointer) {
      cursorNode.classList.add("is-visible");
      placeCursorImmediately();
    }

    document.addEventListener("pointermove", showCursor, { passive: true });
    document.addEventListener("pointerleave", hideCursor, { passive: true });
    document.addEventListener("pointerdown", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      showCursor(event, true);
      pulseCursor();
      createClickPop(event);
    });

    window.addEventListener("pagehide", function () {
      rememberPointer(true);
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
