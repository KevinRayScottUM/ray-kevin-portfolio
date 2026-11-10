const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");

const source = readFileSync(join(__dirname, "../static/js/nav-motion.js"), "utf8");

function classList(...initial) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach(name => values.add(name)),
    remove: (...names) => names.forEach(name => values.delete(name)),
    contains: name => values.has(name),
  };
}

function setup(activePath, fromPath) {
  const paths = ["/", "/project-experience", "/about", "/blog", "/lab", "/contacts"];
  const links = paths.map((path, index) => ({
    href: "https://example.test" + path,
    classList: classList(...(path === activePath ? ["is-active"] : []), ...(path === "/contacts" ? ["portfolio-nav-contact"] : [])),
    offsetLeft: index * 100,
    offsetWidth: 80,
    listeners: {},
    addEventListener(name, handler) { this.listeners[name] = handler; },
    getBoundingClientRect() { return { left: index * 100, width: 80 }; },
  }));
  const animations = [];
  const indicator = {
    hidden: false,
    style: {},
    animate(frames, options) {
      const animation = { frames, options, cancel() {} };
      animations.push(animation);
      return animation;
    },
  };
  const scroll = {
    classList: classList(),
    scrollLeft: 0,
    scrollWidth: 600,
    clientWidth: 600,
    getBoundingClientRect: () => ({ left: 0 }),
  };
  const document = {
    readyState: "complete",
    body: { classList: classList() },
    documentElement: { classList: classList() },
    querySelector(selector) {
      if (selector === ".portfolio-nav-scroll") return scroll;
      if (selector === ".portfolio-nav-indicator") return indicator;
      if (selector === ".portfolio-nav-link.is-active") return links.find(link => link.classList.contains("is-active"));
      throw new Error("Unexpected selector: " + selector);
    },
    querySelectorAll: () => links,
  };
  const storage = new Map();
  if (fromPath) storage.set("tensorcat-nav-transition", JSON.stringify({ from: fromPath, to: activePath, time: Date.now() }));
  const frames = [];
  const timers = new Map();
  const events = {};
  let timerId = 0;
  const window = {
    location: { href: "https://example.test" + activePath },
    sessionStorage: {
      getItem: key => storage.get(key),
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key),
    },
    requestAnimationFrame: handler => frames.push(handler),
    setTimeout(handler) { timers.set(++timerId, handler); return timerId; },
    clearTimeout: id => timers.delete(id),
    addEventListener: (name, handler) => { events[name] = handler; },
  };
  vm.runInNewContext(source, { document, window, URL });
  function flushFrames() {
    for (let count = 0; frames.length; count++) {
      assert.ok(count < 100, "Animation frames should settle");
      frames.shift()();
    }
  }
  flushFrames();
  return {
    indicator, animations,
    click(path) { links[paths.indexOf(path)].listeners.click({ button: 0, preventDefault() {} }); flushFrames(); },
    resize() { events.resize(); for (const handler of timers.values()) handler(); timers.clear(); flushFrames(); },
  };
}

test("Contact starts and stays without an underline, including repeated clicks and resizing", () => {
  const state = setup("/contacts");
  state.click("/contacts");
  state.resize();
  assert.equal(state.indicator.hidden, true);
  assert.equal(state.animations.length, 0);
});

test("Entering Contact never animates the underline toward its button", () => {
  const state = setup("/contacts", "/about");
  assert.equal(state.indicator.hidden, true);
  assert.equal(state.animations.length, 0);
});

for (const [index, path] of ["/", "/project-experience", "/about", "/blog", "/lab"].entries()) {
  test("Leaving Contact places the underline directly at " + path, () => {
    const state = setup(path, "/contacts");
    assert.equal(state.indicator.hidden, false);
    assert.equal(state.animations.length, 0);
    assert.equal(state.indicator.style.transform, "translate3d(" + (index * 100 + 12) + "px, 0, 0)");
  });
}

test("Ordinary navigation retains its sliding animation", () => {
  const state = setup("/about", "/");
  assert.equal(state.animations.length, 1);
  assert.equal(state.animations[0].options.duration, 840);
  assert.equal(state.animations[0].frames[0].transform, "translate3d(12px, 0, 0)");
});

test("Repeated clicks on ordinary tabs retain their playful animation", () => {
  const state = setup("/about");
  state.click("/about");
  assert.equal(state.animations.length, 1);
  assert.equal(state.animations[0].options.duration, 1040);
});
