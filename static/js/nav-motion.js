(function () {
  var STORAGE_KEY = "tensorcat-nav-transition";
  var TRANSITION_TTL = 2600;
  var activeAnimation = null;

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
    }
  }

  function normalizeUrl(value) {
    try {
      var url = new URL(value, window.location.href);
      var path = url.pathname.replace(/\/+$/, "");
      return path || "/";
    } catch (_error) {
      return "/";
    }
  }

  function writeTransition(fromHref, toHref) {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          from: normalizeUrl(fromHref),
          to: normalizeUrl(toHref),
          time: Date.now(),
        })
      );
    } catch (_error) {
      // The navigation still works; only the cross-page underline motion is skipped.
    }
  }

  function readTransition() {
    try {
      var raw = window.sessionStorage.getItem(STORAGE_KEY);
      window.sessionStorage.removeItem(STORAGE_KEY);
      if (!raw) return null;

      var transition = JSON.parse(raw);
      if (!transition || Date.now() - transition.time > TRANSITION_TTL) return null;
      if (transition.to !== normalizeUrl(window.location.href)) return null;

      return transition;
    } catch (_error) {
      return null;
    }
  }

  function linkForPath(path) {
    var links = Array.prototype.slice.call(document.querySelectorAll(".portfolio-nav-link"));
    return links.find(function (link) {
      return normalizeUrl(link.href) === path;
    });
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

  function centerInScroll(scroll, link) {
    if (!scroll || !link || scroll.scrollWidth <= scroll.clientWidth) return;

    var target =
      link.offsetLeft -
      Math.max(0, (scroll.clientWidth - link.offsetWidth) / 2);

    scroll.scrollLeft = Math.max(
      0,
      Math.min(target, scroll.scrollWidth - scroll.clientWidth)
    );
  }

  function place(indicator, position) {
    indicator.style.width = position.width + "px";
    indicator.style.transform = "translate3d(" + position.left + "px, 0, 0)";
  }

  function stretchKeyframes(from, to) {
    var distance = to.left - from.left;
    var travel = Math.abs(distance);
    var direction = distance >= 0 ? 1 : -1;
    var widthDelta = Math.abs(to.width - from.width);
    var stretch = Math.min(104, Math.max(22, travel * 0.38 + widthDelta * 0.32));
    var glideWidth = Math.max(
      to.width,
      from.width + Math.min(60, travel * 0.2) + widthDelta * 0.25
    );
    var settle = Math.min(6, Math.max(2, travel * 0.014));

    return [
      {
        transform: "translate3d(" + from.left + "px, 0, 0)",
        width: from.width + "px",
        offset: 0,
      },
      {
        transform:
          "translate3d(" +
          (direction > 0 ? from.left : from.left - stretch) +
          "px, 0, 0)",
        width: from.width + stretch + "px",
        offset: 0.28,
      },
      {
        transform:
          "translate3d(" +
          (from.left + distance * 0.72 - (direction < 0 ? stretch * 0.12 : 0)) +
          "px, 0, 0)",
        width: glideWidth + "px",
        offset: 0.72,
      },
      {
        transform: "translate3d(" + (to.left - direction * settle) + "px, 0, 0)",
        width: to.width + settle * 2 + "px",
        offset: 0.9,
      },
      {
        transform: "translate3d(" + to.left + "px, 0, 0)",
        width: to.width + "px",
        offset: 1,
      },
    ];
  }

  function animateIndicator(indicator, from, to) {
    if (activeAnimation) activeAnimation.cancel();

    if (!indicator.animate) {
      place(indicator, to);
      return;
    }

    activeAnimation = indicator.animate(stretchKeyframes(from, to), {
      duration: 840,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    });

    activeAnimation.onfinish = function () {
      place(indicator, to);
      if (activeAnimation) {
        activeAnimation.cancel();
        activeAnimation = null;
      }
    };
  }

  function playActiveIndicator(indicator, position) {
    if (activeAnimation) activeAnimation.cancel();

    if (!indicator.animate) {
      place(indicator, position);
      return;
    }

    var bloom = Math.min(34, Math.max(18, position.width * 0.28));
    var softSettle = Math.min(8, Math.max(4, position.width * 0.08));
    var expanded = {
      left: position.left - bloom,
      width: position.width + bloom * 2,
    };
    var settled = {
      left: position.left + softSettle / 2,
      width: Math.max(24, position.width - softSettle),
    };

    activeAnimation = indicator.animate(
      [
        {
          transform: "translate3d(" + position.left + "px, 0, 0)",
          width: position.width + "px",
          offset: 0,
        },
        {
          transform: "translate3d(" + expanded.left + "px, 0, 0)",
          width: expanded.width + "px",
          offset: 0.42,
        },
        {
          transform: "translate3d(" + settled.left + "px, 0, 0)",
          width: settled.width + "px",
          offset: 0.82,
        },
        {
          transform: "translate3d(" + position.left + "px, 0, 0)",
          width: position.width + "px",
          offset: 1,
        },
      ],
      {
        duration: 620,
        easing: "cubic-bezier(0.2, 1, 0.22, 1)",
        fill: "forwards",
      }
    );

    activeAnimation.onfinish = function () {
      place(indicator, position);
      if (activeAnimation) {
        activeAnimation.cancel();
        activeAnimation = null;
      }
    };
  }

  function syncToActive(scroll, indicator) {
    var activeLink = document.querySelector(".portfolio-nav-link.is-active");
    if (!activeLink) return null;

    centerInScroll(scroll, activeLink);
    place(indicator, measure(scroll, activeLink));
    return activeLink;
  }

  function runArrivalMotion(scroll, indicator, transition) {
    var activeLink = document.querySelector(".portfolio-nav-link.is-active");
    var fromLink = transition ? linkForPath(transition.from) : null;
    if (!activeLink || !fromLink || fromLink === activeLink) {
      syncToActive(scroll, indicator);
      return;
    }

    centerInScroll(scroll, activeLink);

    window.requestAnimationFrame(function () {
      var from = measure(scroll, fromLink);
      var to = measure(scroll, activeLink);

      place(indicator, from);
      window.requestAnimationFrame(function () {
        animateIndicator(indicator, from, to);
      });
    });
  }

  function isNormalClick(event) {
    return (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    );
  }

  ready(function () {
    var scroll = document.querySelector(".portfolio-nav-scroll");
    var indicator = document.querySelector(".portfolio-nav-indicator");
    if (!scroll || !indicator) return;

    scroll.classList.add("is-enhanced");

    runArrivalMotion(scroll, indicator, readTransition());

    document.querySelectorAll(".portfolio-nav-link").forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (!isNormalClick(event)) return;

        var activeLink = document.querySelector(".portfolio-nav-link.is-active");
        if (!activeLink) return;

        if (normalizeUrl(link.href) === normalizeUrl(activeLink.href)) {
          event.preventDefault();
          centerInScroll(scroll, activeLink);
          playActiveIndicator(indicator, measure(scroll, activeLink));
          return;
        }

        writeTransition(activeLink.href, link.href);
      });
    });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        syncToActive(scroll, indicator);
      }, 90);
    });

    window.addEventListener("pageshow", function (event) {
      if (!event.persisted) return;
      window.requestAnimationFrame(function () {
        syncToActive(scroll, indicator);
      });
    });
  });
})();
