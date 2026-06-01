(function () {
  var NAVIGATE_DELAY = 660;
  var activeAnimation = null;
  var pendingNavigation = false;

  function ready(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback);
    } else {
      callback();
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
    var stretch = Math.min(86, Math.max(18, travel * 0.34 + widthDelta * 0.28));
    var glideWidth = Math.max(
      to.width,
      from.width + Math.min(52, travel * 0.18) + widthDelta * 0.22
    );
    var settle = Math.min(7, Math.max(2, travel * 0.018));

    var first = {
      left: direction > 0 ? from.left : from.left - stretch,
      width: from.width + stretch,
    };

    var second = {
      left: from.left + distance * 0.66 - (direction < 0 ? stretch * 0.16 : 0),
      width: glideWidth,
    };

    var third = {
      left: to.left - direction * settle,
      width: to.width + settle * 2,
    };

    return [
      {
        transform: "translate3d(" + from.left + "px, 0, 0)",
        width: from.width + "px",
        offset: 0,
      },
      {
        transform: "translate3d(" + first.left + "px, 0, 0)",
        width: first.width + "px",
        offset: 0.3,
      },
      {
        transform: "translate3d(" + second.left + "px, 0, 0)",
        width: second.width + "px",
        offset: 0.72,
      },
      {
        transform: "translate3d(" + third.left + "px, 0, 0)",
        width: third.width + "px",
        offset: 0.9,
      },
      {
        transform: "translate3d(" + to.left + "px, 0, 0)",
        width: to.width + "px",
        offset: 1,
      },
    ];
  }

  function animateIndicator(indicator, from, to, duration) {
    if (activeAnimation) activeAnimation.cancel();

    if (!indicator.animate) {
      place(indicator, to);
      return null;
    }

    activeAnimation = indicator.animate(stretchKeyframes(from, to), {
      duration: duration || 720,
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

    return activeAnimation;
  }

  function syncToActive(scroll, indicator) {
    var activeLink = document.querySelector(".portfolio-nav-link.is-active");
    if (!activeLink) return null;

    centerInScroll(scroll, activeLink);
    var position = measure(scroll, activeLink);
    place(indicator, position);
    return activeLink;
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

    var activeLink = syncToActive(scroll, indicator);
    if (!activeLink) return;

    document.querySelectorAll(".portfolio-nav-link").forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (!isNormalClick(event) || pendingNavigation) return;

        var href = link.href;
        if (!href || href === window.location.href) return;

        var current = document.querySelector(".portfolio-nav-link.is-active") || activeLink;
        var from = measure(scroll, current);
        var to = measure(scroll, link);

        event.preventDefault();
        pendingNavigation = true;

        current.classList.remove("is-active");
        link.classList.add("is-active");
        animateIndicator(indicator, from, to, 760);

        window.setTimeout(function () {
          window.location.href = href;
        }, NAVIGATE_DELAY);
      });
    });

    var resizeTimer = null;
    window.addEventListener("resize", function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        syncToActive(scroll, indicator);
      }, 90);
    });

    window.addEventListener("pageshow", function () {
      window.requestAnimationFrame(function () {
        pendingNavigation = false;
        syncToActive(scroll, indicator);
      });
    });
  });
})();
