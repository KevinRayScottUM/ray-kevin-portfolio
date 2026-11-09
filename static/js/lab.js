import { createWorld } from "./lab-world.js";

const root = document.querySelector("[data-lab]");
if (root && !root.dataset.initialized) initializeLab(root);

function initializeLab(root) {
  root.dataset.initialized = "true";
  const host = root.querySelector("[data-lab-scene]");
  const bench = root.querySelector("[data-lab-workbench]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const defaults = { density: 16, speed: 0.4, response: 0.55, lift: 0.45, mode: "surface", color: "#2563eb", grid: true, pointer: true };
  let settings = { ...defaults };
  let running = !reduced.matches;
  let view = "workspace";
  let frameId = 0;
  let lastTime = 0;
  let phase = 0;
  let flow = settings.speed;
  let expanded = false;
  let placeholder;
  let savedOverflow = "";
  let muted = [];
  let toastTimer = 0;
  let visible = true;
  let model;
  const toastNode = root.querySelector("[data-lab-toast]");
  const $ = selector => root.querySelector(selector) || bench.querySelector(selector);

  function notify(message) {
    toastNode.textContent = message;
    toastNode.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove("is-visible"), 2400);
  }
  function schedule() {
    if (!frameId && visible && !document.hidden && view === "workspace" && model) frameId = requestAnimationFrame(frame);
  }
  function frame(now) {
    frameId = 0;
    if (view !== "workspace" || !visible || document.hidden) return;
    const interval = innerWidth <= 760 ? 1000 / 24 : 1000 / 30;
    if (lastTime && now - lastTime < interval - 1) { schedule(); return; }
    const dt = lastTime ? Math.min((now - lastTime) / 1000, 0.065) : 1 / 30;
    lastTime = now;
    flow += (settings.speed - flow) * (reduced.matches ? 1 : 1 - Math.exp(-dt * 7));
    if (running && !reduced.matches) phase += dt * flow * 0.8;
    const moving = model.step(dt, phase, running && !reduced.matches, reduced.matches);
    model.render();
    if ((running && flow > 0.001 && !reduced.matches) || moving || Math.abs(flow - settings.speed) > 0.001) schedule();
  }
  function updateControls() {
    ["density", "speed", "response", "lift"].forEach(name => {
      const value = settings[name];
      $('[data-lab-range="' + name + '"]').value = name === "density" ? value : value * 100;
      $('[data-lab-output="' + name + '"]').textContent = name === "density" ? value : value.toFixed(2);
    });
    bench.querySelectorAll("[data-lab-mode]").forEach(b => b.setAttribute("aria-pressed", b.dataset.labMode === settings.mode));
    bench.querySelectorAll("[data-lab-color]").forEach(b => b.setAttribute("aria-pressed", b.dataset.labColor === settings.color));
    ["grid", "pointer"].forEach(key => { $('[data-lab-toggle="' + key + '"]').checked = settings[key]; });
    bench.style.setProperty("--lab-accent", settings.color);
    if (model) {
      model.setOptions(settings);
      $("[data-lab-dimensions]").textContent = model.dimensions;
      $("[data-lab-point-count]").textContent = model.count;
    }
    const play = $('[data-lab-action="play"]');
    const label = running ? "Pause motion" : "Resume motion";
    play.setAttribute("aria-label", label);
    play.setAttribute("aria-pressed", !running);
    play.dataset.tooltip = label;
    $("[data-lab-pause-icon]").hidden = !running;
    $("[data-lab-play-icon]").hidden = running;
    $("[data-lab-run-status]").textContent = running ? "Running" : "Paused";
    bench.querySelector(".lab-statusbar").classList.toggle("is-paused", !running);
  }
  function resize() { if (model) model.resize(); }
  try {
    model = createWorld(host, schedule, (u, v) => {
      $("[data-lab-coordinates]").textContent = "u " + Math.max(0, Math.min(1, u)).toFixed(2) + " / v " + Math.max(0, Math.min(1, v)).toFixed(2);
    }, zoom => { $("[data-lab-camera]").textContent = Math.round(zoom * 100) + "%"; });
  } catch (error) {
    console.error("Lab scene initialization failed", error);
    $("[data-lab-fallback]").hidden = false;
    $("[data-lab-run-status]").textContent = "Unavailable";
    bench.querySelectorAll("input, button").forEach(control => { control.disabled = true; });
  }
  bench.querySelectorAll("[data-lab-range]").forEach(input => {
    input.addEventListener("input", () => {
      const key = input.dataset.labRange;
      settings[key] = Number(input.value) / (key === "density" ? 1 : 100);
      updateControls();
    });
  });
  bench.querySelectorAll("[data-lab-mode]").forEach(button => {
    button.addEventListener("click", () => { settings.mode = button.dataset.labMode; updateControls(); });
  });
  bench.querySelectorAll("[data-lab-color]").forEach(button => {
    button.addEventListener("click", () => { settings.color = button.dataset.labColor; updateControls(); });
  });
  bench.querySelectorAll("[data-lab-toggle]").forEach(input => {
    input.addEventListener("change", () => { settings[input.dataset.labToggle] = input.checked; updateControls(); });
  });
  function selectView(name, focus) {
    if (name === view) return;
    view = name;
    root.querySelectorAll("[data-lab-tab]").forEach(tab => {
      const active = tab.dataset.labTab === name;
      tab.setAttribute("aria-selected", active);
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute("aria-controls"));
      panel.hidden = !active;
      panel.classList.toggle("is-arriving", active);
      if (active && focus) tab.focus();
    });
    lastTime = 0;
    if (name === "workspace") resize();
  }
  root.querySelectorAll("[data-lab-tab]").forEach(tab => {
    tab.addEventListener("click", () => selectView(tab.dataset.labTab, false));
    tab.addEventListener("keydown", e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault();
      selectView(e.key === "Home" ? "workspace" : e.key === "End" ? "experiments" : view === "workspace" ? "experiments" : "workspace", true);
    });
  });
  function setExpanded(value) {
    if (value === expanded) return;
    expanded = value;
    const button = bench.querySelector('[data-lab-action="expand"]');
    if (expanded) {
      placeholder = document.createElement("div");
      placeholder.style.height = bench.getBoundingClientRect().height + "px";
      bench.before(placeholder);
      document.body.appendChild(bench);
      bench.appendChild(toastNode);
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      [root, document.getElementById("header"), document.querySelector("body > footer")].forEach(node => {
        if (node) { muted.push([node, node.inert]); node.inert = true; }
      });
      bench.setAttribute("role", "dialog");
      bench.setAttribute("aria-modal", "true");
      bench.setAttribute("aria-label", "Expanded workspace");
    } else {
      placeholder.replaceWith(bench);
      root.appendChild(toastNode);
      document.body.style.overflow = savedOverflow;
      muted.forEach(([node, wasInert]) => { node.inert = wasInert; });
      muted = [];
      bench.removeAttribute("role");
      bench.removeAttribute("aria-modal");
      bench.removeAttribute("aria-label");
    }
    bench.classList.toggle("is-expanded", expanded);
    button.setAttribute("aria-expanded", expanded);
    button.setAttribute("aria-label", expanded ? "Collapse workspace" : "Expand workspace");
    button.dataset.tooltip = expanded ? "Collapse workspace" : "Expand workspace";
    $("[data-lab-expand-icon]").hidden = expanded;
    $("[data-lab-collapse-icon]").hidden = !expanded;
    button.focus({ preventScroll: true });
    resize();
  }
  async function action(event) {
    const button = event.target.closest("[data-lab-action]");
    if (!button) return;
    const type = button.dataset.labAction;
    if (type === "play") { running = !running; lastTime = 0; updateControls(); }
    if (type === "reset") {
      settings = { ...defaults };
      phase = 0; flow = settings.speed;
      running = !reduced.matches;
      updateControls();
      model.reset();
      $("[data-lab-coordinates]").textContent = "u 0.50 / v 0.50";
      notify("Workspace reset");
    }
    if (type === "expand") setExpanded(!expanded);
    if (type === "camera") { model.resetCamera(); notify("Camera reset"); }
    if (type === "workspace") selectView("workspace", true);
    if (type === "download" && model) {
      try {
        const blob = await model.exportPNG();
        if (!blob) throw new Error("Empty image");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "tensorcat-world-study.png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        notify("Image exported");
      } catch (error) { console.error("Lab export failed", error); notify("Image export unavailable"); }
    }
  }
  root.addEventListener("click", action);
  bench.addEventListener("click", e => { if (expanded) action(e); });
  document.addEventListener("keydown", e => {
    if (!expanded) return;
    if (e.key === "Escape") { e.preventDefault(); setExpanded(false); }
    if (e.key === "Tab") {
      const items = [...bench.querySelectorAll("button, input, [data-lab-scene]")];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; }
    else { lastTime = 0; schedule(); }
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches) running = false;
    updateControls();
  });
  if (window.ResizeObserver) new ResizeObserver(resize).observe(host.parentElement);
  else window.addEventListener("resize", resize);
  if (window.IntersectionObserver) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) { lastTime = 0; schedule(); }
      else { cancelAnimationFrame(frameId); frameId = 0; }
    }).observe(host);
  }
  window.addEventListener("pagehide", () => {
    if (expanded) setExpanded(false);
    cancelAnimationFrame(frameId); frameId = 0;
  });
  window.addEventListener("pageshow", () => { lastTime = 0; resize(); });
  if (model) { updateControls(); resize(); }
}
