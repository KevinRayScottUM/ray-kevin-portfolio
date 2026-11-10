(function () {
  var root = document.querySelector(".home-publication");
  if (!root) return;
  var notes = Array.prototype.slice.call(root.querySelectorAll("[data-home-note]"));
  root.querySelectorAll("[data-home-filter]").forEach(function (button) {
    button.addEventListener("click", function () {
      var filter = button.dataset.homeFilter;
      var count = 0;
      notes.forEach(function (note) {
        var matches = filter === "all" || note.dataset.homeNote === filter;
        note.hidden = !matches || count >= 2;
        if (matches) count++;
      });
      root.querySelectorAll("[data-home-filter]").forEach(function (item) {
        item.setAttribute("aria-pressed", item === button);
      });
      root.querySelector("[data-home-filter-status]").textContent = "Showing " + Math.min(count, 2) + " notes";
    });
  });
  var fine = window.matchMedia("(pointer: fine)");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  root.querySelectorAll("[data-home-photo], [data-home-note-tilt]").forEach(function (paper) {
    var rect = null;
    var isNote = paper.hasAttribute("data-home-note-tilt");
    function reset() {
      rect = null;
      ["--photo-x", "--photo-y", "--photo-tilt", "--paper-rx", "--paper-ry"].forEach(function (property) {
        paper.style.removeProperty(property);
      });
    }
    paper.addEventListener("pointerenter", function () {
      rect = paper.getBoundingClientRect();
    });
    paper.addEventListener("pointermove", function (event) {
      if (!fine.matches || reduced.matches || event.pointerType === "touch") return;
      if (!rect) rect = paper.getBoundingClientRect();
      var x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      var y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      paper.style.setProperty("--photo-x", x * 4 + "px");
      paper.style.setProperty("--photo-y", y * 3 - 4 + "px");
      paper.style.setProperty("--photo-tilt", x * (isNote ? 2 : 1.5) + "deg");
      if (isNote) {
        paper.style.setProperty("--paper-rx", -y * 4 + "deg");
        paper.style.setProperty("--paper-ry", x * 5 + "deg");
      }
    }, { passive: true });
    paper.addEventListener("pointerleave", reset);
    paper.addEventListener("pointercancel", reset);
    reduced.addEventListener("change", reset);
    fine.addEventListener("change", reset);
    window.addEventListener("blur", reset);
  });
})();
