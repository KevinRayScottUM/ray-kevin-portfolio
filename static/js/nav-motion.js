(function () {
  var STORAGE_KEY = "tensorcat-nav-indicator";

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  function readPrevious() {
    try {
      var raw = window.sessionStorage && window.sessionStorage.getItem(STORAGE_KEY);
      if (window.sessionStorage) window.sessionStorage.removeItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  function writePrevious(value) {
    try {
      if (window.sessionStorage) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (_error) {
      // Session storage is optional; the active underline still renders without it.
    }
  }

  function measure(scroll, link) {
    var scrollRect = scroll.getBoundingClientRect();
    var linkRect = link.getBoundingClientRect();
    var inset = Math.min(12, Math.max(8, linkRect.width * 0.16));

    return {
      left: linkRect.left - scrollRect.left + scroll.scrollLeft + inset,
      width: Math.max(24, linkRect.width - inset * 2),
    };
  }

  function place(indicator, position) {
    indicator.style.width = position.width + "px";
    indicator.style.transform = "translateX(" + position.left + "px)";
  }

  function animateIndicator(indicator, from, to) {
    var direction = to.left >= from.left ? 1 : -1;
    var fromRight = from.left + from.width;
    var toRight = to.left + to.width;
    var stretchLeft = direction > 0 ? from.left : Math.min(to.left, from.left);
    var stretchRight = direction > 0 ? Math.max(toRight, fromRight) : fromRight;
    var stretchWidth = Math.max(24, stretchRight - stretchLeft);

    if (indicator.getAnimations) {
      indicator.getAnimations().forEach(function (animation) {
        animation.cancel();
      });
    }

    if (!indicator.animate) {
      place(indicator, to);
      return;
    }

    indicator.animate(
      [
        {
          transform: "translateX(" + from.left + "px)",
          width: from.width + "px",
          offset: 0,
        },
        {
          transform: "translateX(" + stretchLeft + "px)",
          width: stretchWidth + "px",
          offset: 0.38,
        },
        {
          transform: "translateX(" + to.left + "px)",
          width: Math.max(to.width, stretchWidth * 0.42) + "px",
          offset: 0.74,
        },
        {
          transform: "translateX(" + to.left + "px)",
          width: to.width + "px",
          offset: 1,
        },
      ],
      {
        duration: 920,
        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      }
    );
  }

  ready(function () {
    var scroll = document.querySelector(".portfolio-nav-scroll");
    var indicator = document.querySelector(".portfolio-nav-indicator");
    var activeLink = document.querySelector(".portfolio-nav-link.is-active");
    if (!scroll || !indicator || !activeLink) return;

    scroll.classList.add("is-enhanced");

    var target = measure(scroll, activeLink);
    var previous = readPrevious();
    if (previous && typeof previous.left === "number" && typeof previous.width === "number") {
      place(indicator, previous);
      animateIndicator(indicator, previous, target);
    }
    place(indicator, target);

    document.querySelectorAll(".portfolio-nav-link").forEach(function (link) {
      link.addEventListener("click", function () {
        var current = document.querySelector(".portfolio-nav-link.is-active") || link;
        writePrevious(measure(scroll, current));
      });
    });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        activeLink = document.querySelector(".portfolio-nav-link.is-active");
        if (activeLink) place(indicator, measure(scroll, activeLink));
      }, 80);
    });
  });
})();
