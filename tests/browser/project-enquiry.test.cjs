const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");

const root = path.resolve(__dirname, "..", "..");
const browser = process.env.BROWSER_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

test("Website acceptance checks in a real browser (no messages are sent)", { timeout: 60000 }, async (t) => {
  assert.ok(fs.existsSync(browser), "Set BROWSER_PATH to an installed Edge or Chrome executable.");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "auro-enquiry-"));
  const imageFiles = fs.readdirSync(path.join(root, "assets", "images"), { recursive: true })
    .filter((name) => [".svg", ".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(name).toLowerCase()));
  const imageTypes = { ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
  const server = http.createServer((request, response) => {
    const files = {
      "/": ["index.html", "text/html"],
      "/preview/": ["index.html", "text/html"],
      "/assets/scripts/site.js": ["assets/scripts/site.js", "text/javascript"],
      "/assets/styles/site.css": ["assets/styles/site.css", "text/css"]
    };
    for (const name of imageFiles) {
      const url = `/assets/images/${name.split(path.sep).join("/")}`;
      files[url] = [path.join("assets", "images", name), imageTypes[path.extname(name).toLowerCase()]];
    }
    const url = request.url.startsWith("/preview/assets/") ? request.url.slice("/preview".length) : request.url;
    const file = files[url];
    if (!file) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": file[1].startsWith("image/") ? file[1] : `${file[1]}; charset=utf-8` });
    response.end(fs.readFileSync(path.join(root, file[0])));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const child = spawn(browser, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"
  ], { stdio: "ignore" });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  let socket;
  t.after(async () => {
    socket?.close();
    child.kill();
    await Promise.race([exited, delay(5000)]);
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  const portFile = path.join(profile, "DevToolsActivePort");
  for (let attempt = 0; !fs.existsSync(portFile) && attempt < 100; attempt++) await delay(100);
  assert.ok(fs.existsSync(portFile), "Browser debugging port did not become available.");
  const port = fs.readFileSync(portFile, "utf8").split("\n")[0];
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const runtimeErrors = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails);
    if (!message.id) return;
    const handler = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(message.error.message));
    else handler.resolve(message.result);
  });
  function command(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  await command("Network.enable");
  await command("Runtime.enable");
  await command("Network.setBlockedURLs", { urls: ["*fonts.googleapis.com*", "*fonts.gstatic.com*"] });
  await command("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/` });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(`Boolean(document.querySelector('.form-submit') && !document.querySelector('.form-submit').disabled)`)) break;
    await delay(50);
  }
  assert.equal(await evaluate(`document.querySelector('.form-submit').disabled`), false);
  await t.test("Renamed page resources and CSS watermark resolve from the project root", async () => {
    const resources = await evaluate(`Array.from(document.querySelectorAll('img[src], script[src], link[href]'), element => element.getAttribute('src') || element.getAttribute('href')).filter(url => url.startsWith('assets/'))`);
    resources.push("assets/images/brand/auro-logo.jpg");
    for (const resource of new Set(resources)) {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/${resource}`);
      assert.equal(response.status, 200, resource);
    }
    assert.ok((await evaluate(`getComputedStyle(document.querySelector('.hero'), '::after').backgroundImage`)).includes("images/brand/auro-logo.jpg"));
  });
  const field = (name) => `document.querySelector('#contact-form [name="${name}"]')`;
  async function fill(name, value) {
    await evaluate(`${field(name)}.value = ${JSON.stringify(value)}; ${field(name)}.dispatchEvent(new Event('input', {bubbles:true}));`);
  }
  const submit = () => evaluate(`document.querySelector('#contact-form').requestSubmit()`);
  const status = () => evaluate(`document.querySelector('#form-status').textContent`);
  async function resize(width, height = 900) {
    await command("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    await delay(50);
  }
  async function ready(expectedPath) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(`Boolean(${expectedPath ? `location.pathname === ${JSON.stringify(expectedPath)} &&` : ""} !window.qaReloadPending && document.readyState === 'complete' && document.querySelector('.form-submit') && !document.querySelector('.form-submit').disabled)`)) return;
      await delay(50);
    }
    assert.fail("Website did not initialize.");
  }
  await t.test("Mobile menu, Escape, resize, and theme switching preserve accessible focus", async () => {
    await resize(375, 500);
    await evaluate(`document.querySelector('.menu-toggle').click()`);
    assert.equal(await evaluate(`document.body.classList.contains('menu-open')`), true);
    await evaluate(`document.querySelector('#theme-toggle').focus(); document.querySelector('#theme-toggle').click()`);
    assert.equal(await evaluate(`document.activeElement.id === 'theme-toggle' && getComputedStyle(document.querySelector('#nav-links')).display === 'none'`), false, "Focus must not remain in a hidden menu");
    await evaluate(`document.querySelector('.menu-toggle').click()`);
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    assert.equal(await evaluate(`document.activeElement.className`), "menu-toggle");
    assert.equal(await evaluate(`document.querySelector('.menu-toggle').getAttribute('aria-expanded')`), "false");
    await evaluate(`document.querySelector('.menu-toggle').click()`);
    await resize(1440);
    assert.equal(await evaluate(`document.body.classList.contains('menu-open')`), false);
  });
  await t.test("Primary navigation hover text retains readable contrast", async () => {
    await resize(1440);
    await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    const point = await evaluate(`(() => { const r = document.querySelector('.nav-contact').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", ...point });
    await delay(300);
    const ratio = await evaluate(`(() => {
      const s=getComputedStyle(document.querySelector('.nav-contact'));
      const luminance=color=>color.match(/[\\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
      const a=luminance(s.color), b=luminance(s.backgroundColor);
      return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    })()`);
    assert.ok(ratio >= 4.5, `Hover contrast was ${ratio.toFixed(2)}:1`);
    await command("Input.dispatchMouseEvent", { type: "mouseMoved", x: 0, y: 0 });
  });

  await t.test("Empty, whitespace-only, invalid email, and overlength values are rejected", async () => {
    await submit();
    assert.match(await status(), /correct the highlighted/);
    assert.equal(await evaluate(`document.querySelector('#enquiry-preview').hidden`), true);
    await fill("name", "   ");
    await fill("email", "not-an-email");
    await fill("service", "Website Development");
    await fill("message", "  ");
    await submit();
    assert.equal(await evaluate(`${field("name")}.validity.valid`), false);
    assert.equal(await evaluate(`${field("email")}.validity.valid`), false);
    assert.equal(await evaluate(`${field("message")}.validity.valid`), false);
    await fill("name", "Jane");
    await fill("email", "jane@example.com");
    await fill("message", "a".repeat(1801));
    await submit();
    assert.equal(await evaluate(`${field("message")}.validity.valid`), false);
  });
  await t.test("Changing a previously invalid service clears its validation error", async () => {
    await fill("service", "");
    await submit();
    assert.equal(await evaluate(`${field("service")}.getAttribute('aria-invalid')`), "true");
    await evaluate(`${field("service")}.value = 'Website Development'; ${field("service")}.dispatchEvent(new Event('change', {bubbles:true}))`);
    assert.equal(await evaluate(`${field("service")}.validity.valid`), true);
    assert.equal(await evaluate(`${field("service")}.hasAttribute('aria-invalid')`), false);
  });
  await t.test("Valid enquiry is trimmed, encoded, previewed, and not automatically sent", async () => {
    await fill("name", "  Jane & Co  ");
    await fill("email", "jane@example.com");
    await fill("phone", "   ");
    await fill("message", "  Build a site: A&B + 50%? #launch\nUnicode: \u00e9 \u2713  ");
    await submit();
    assert.equal(await evaluate(`document.querySelector('#enquiry-preview').hidden`), false);
    assert.equal(await evaluate(`document.activeElement.id`), "enquiry-text");
    const href = await evaluate(`document.querySelector('#open-enquiry-email').href`);
    const url = new URL(href);
    assert.equal(url.protocol, "mailto:");
    assert.equal(url.pathname, "bestresearchsolutions62@gmail.com");
    assert.equal(url.searchParams.get("subject"), "Project enquiry: Website Development");
    assert.match(url.searchParams.get("body"), /Name: Jane & Co\r\n/);
    assert.match(url.searchParams.get("body"), /Phone: Not provided/);
    assert.ok(url.searchParams.get("body").includes("A&B + 50%? #launch\nUnicode: \u00e9 \u2713"));
    assert.match(await status(), /not sent/);
  });
  await t.test("Copy succeeds or offers manual selection when clipboard is missing or denied", async () => {
    await evaluate(`Object.defineProperty(navigator, 'clipboard', {configurable:true, value:{writeText:async text => {window.copiedEnquiry=text;}}}); document.querySelector('#copy-enquiry').click();`);
    assert.match(await status(), /Enquiry copied/);
    assert.equal(await evaluate(`window.copiedEnquiry`), await evaluate(`document.querySelector('#enquiry-text').value`));
    for (const clipboard of ["undefined", "{writeText:async () => {throw new Error('Permission denied');}}"]) {
      await evaluate(`Object.defineProperty(navigator, 'clipboard', {configurable:true, value:${clipboard}}); document.querySelector('#copy-enquiry').click();`);
      assert.match(await status(), /Copy is unavailable/);
      assert.equal(await evaluate(`document.querySelector('#enquiry-text').selectionStart`), 0);
      assert.equal(await evaluate(`document.querySelector('#enquiry-text').selectionEnd === document.querySelector('#enquiry-text').value.length`), true);
    }
  });
  await t.test("Edits, service shortcuts, and reset invalidate stale previews", async () => {
    await fill("message", "Updated project");
    assert.equal(await evaluate(`document.querySelector('#enquiry-preview').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('#open-enquiry-email').hasAttribute('href')`), false);
    await submit();
    await evaluate(`document.querySelector('[data-service="Website Maintenance"]').click()`);
    assert.equal(await evaluate(`${field("service")}.value`), "Website Maintenance");
    assert.equal(await evaluate(`document.querySelector('#enquiry-preview').hidden`), true);
    await submit();
    await evaluate(`document.querySelector('#contact-form').reset()`);
    assert.equal(await evaluate(`document.querySelector('#enquiry-preview').hidden`), true);
    assert.equal(await evaluate(`document.querySelector('#enquiry-text').value`), "");
  });
  await t.test("Every service shortcut selects its matching enquiry option", async () => {
    const services = await evaluate(`Array.from(document.querySelectorAll('[data-service]'), link => link.dataset.service)`);
    assert.equal(services.length, 6);
    for (const service of services) {
      await evaluate(`Array.from(document.querySelectorAll('[data-service]')).find(link => link.dataset.service === ${JSON.stringify(service)}).click()`);
      assert.equal(await evaluate(`${field("service")}.value`), service);
      assert.equal(await evaluate(`${field("service")}.validity.valid`), true);
    }
  });
  await t.test("Maximum-length Unicode message and HTML-like text remain intact and inert", async () => {
    const prefix = "<img src=x onerror=alert(1)>";
    const message = prefix + "\u00e9".repeat(1800 - prefix.length);
    assert.equal(message.length, 1800);
    await fill("name", "Jane");
    await fill("email", "jane@example.com");
    await fill("message", message);
    await submit();
    assert.equal(await evaluate(`document.querySelector('#enquiry-preview').hidden`), false);
    const href = await evaluate(`document.querySelector('#open-enquiry-email').href`);
    assert.ok(new URL(href).searchParams.get("body").endsWith(message));
    assert.equal(await evaluate(`document.querySelector('#enquiry-preview img')`), null);
  });
  await t.test("Distinct light and dark palettes keep decorative shapes behind responsive content", async () => {
    for (const width of [320, 375, 820, 1000, 1440]) {
      await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
      for (const theme of ["light", "dark"]) {
        await evaluate(`(() => {
          if (window.innerWidth <= 820 && !document.querySelector('#nav-links').classList.contains('is-open')) document.querySelector('.menu-toggle').click();
          if (document.documentElement.dataset.theme !== ${JSON.stringify(theme)}) document.querySelector('#theme-toggle').click();
        })()`);
        const expectedBackground = theme === "dark" ? "rgb(8, 12, 20)" : "rgb(244, 248, 255)";
        for (let attempt = 0; attempt < 20; attempt++) {
          if (await evaluate(`getComputedStyle(document.body).backgroundColor`) === expectedBackground) break;
          await delay(50);
        }
        const colors = await evaluate(`(() => {
          const style = getComputedStyle(document.body);
          const decoration = getComputedStyle(document.body, '::before');
          return {
            background: style.backgroundColor,
            text: style.color,
            scheme: getComputedStyle(document.documentElement).colorScheme,
            sectionText: Array.from(document.querySelectorAll('.hero,.process-section,.contact-section'), el=>getComputedStyle(el).color),
            surface: getComputedStyle(document.querySelector('.contact-form')).backgroundColor,
            metadata: document.querySelector('meta[name="theme-color"]').content,
            decorationPointerEvents: decoration.pointerEvents,
            decorationFilter: decoration.filter,
            overflow: document.documentElement.scrollWidth > window.innerWidth
          };
        })()`);
        assert.equal(colors.background, expectedBackground, `Theme ${theme} at ${width}px`);
        const expectedText = theme === "dark" ? "rgb(237, 244, 255)" : "rgb(20, 36, 59)";
        assert.equal(colors.text, expectedText);
        assert.equal(colors.scheme, theme);
        assert.deepEqual(colors.sectionText, [expectedText, expectedText, expectedText]);
        assert.equal(colors.surface, theme === "dark" ? "rgb(16, 23, 34)" : "rgb(255, 255, 255)");
        assert.equal(colors.metadata, theme === "dark" ? "#080c14" : "#f4f8ff");
        assert.equal(colors.decorationPointerEvents, "none");
        assert.equal(colors.decorationFilter, "blur(55px)");
        assert.equal(colors.overflow, false);
      }
    }
  });
  await t.test("Theme persists after reload and relative resources work below a deployment subpath", async () => {
    await evaluate(`localStorage.setItem('auro-theme','dark')`);
    await command("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/preview/` });
    await ready("/preview/");
    assert.equal(await evaluate(`document.documentElement.dataset.theme`), "dark");
    const assets = await evaluate(`Array.from(document.querySelectorAll('img[src],script[src],link[rel="stylesheet"],link[rel="icon"]'), el=>el.src||el.href)`);
    for (const asset of assets.filter(asset => asset.startsWith(`http://127.0.0.1:${server.address().port}/`))) {
      assert.equal((await fetch(asset)).status, 200, asset);
    }
  });
  await t.test("Service images decode and the hero preview does not overlap its footer", async () => {
    for (const width of [320, 375, 820, 1440]) {
      await resize(width);
      const layout = await evaluate(`(() => {
        const copy=document.querySelector('.preview-copy').getBoundingClientRect();
        const footer=document.querySelector('.preview-bottom').getBoundingClientRect();
        return {overlap:copy.bottom>footer.top+1, clipped:Array.from(document.querySelectorAll('.service-card,.contact-form,.hero-copy')).filter(el=>el.scrollWidth>el.clientWidth+1).map(el=>el.className)};
      })()`);
      assert.equal(layout.overlap, false, `Preview content overlaps at ${width}px`);
      assert.deepEqual(layout.clipped, [], `Clipped content at ${width}px`);
    }
    const broken = await evaluate(`(async () => {
      const failures=[];
      for (const img of document.images) {
        img.loading='eager';
        try { await img.decode(); if (!img.naturalWidth) failures.push(img.src); }
        catch { failures.push(img.src); }
      }
      return failures;
    })()`);
    assert.deepEqual(broken, []);
  });
  await t.test("FAQ keyboard activation, internal anchors, labels, and reduced motion work", async () => {
    const issues = await evaluate(`(() => {
      const ids=Array.from(document.querySelectorAll('[id]'),el=>el.id);
      return {
        duplicateIds: ids.filter((id,i)=>ids.indexOf(id)!==i),
        missingTargets: Array.from(document.querySelectorAll('a[href^="#"]')).filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash),
        unlabelled: Array.from(document.querySelectorAll('input,select,textarea')).filter(el=>!el.labels.length).map(el=>el.id),
        introVisible: getComputedStyle(document.querySelector('.site-intro')).display !== 'none'
      };
    })()`);
    assert.deepEqual(issues, { duplicateIds: [], missingTargets: [], unlabelled: [], introVisible: false });
    await evaluate(`document.querySelector('.faq-item summary').focus()`);
    await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", text: "\r", windowsVirtualKeyCode: 13 });
    await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
    await delay(50);
    assert.equal(await evaluate(`document.querySelector('.faq-item').open`), true);
    assert.deepEqual(runtimeErrors, []);
  });
  await t.test("Unavailable browser storage does not break themes or enquiries", async () => {
    const script = await command("Page.addScriptToEvaluateOnNewDocument", {
      source: `Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Storage blocked','SecurityError');}})`
    });
    await evaluate(`window.qaReloadPending=true`);
    await command("Page.reload");
    await ready();
    const previous = await evaluate(`document.documentElement.dataset.theme`);
    await evaluate(`document.querySelector('#theme-toggle').click()`);
    assert.notEqual(await evaluate(`document.documentElement.dataset.theme`), previous);
    assert.equal(await evaluate(`document.querySelector('.form-submit').disabled`), false);
    await command("Page.removeScriptToEvaluateOnNewDocument", { identifier: script.identifier });
  });
  await t.test("Opening animation finishes and keyboard navigation immediately reveals hero content", async () => {
    await command("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
    await evaluate(`window.qaReloadPending=true`);
    await command("Page.reload");
    await ready();
    await evaluate(`document.querySelector('.skip-link').focus()`);
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.site-intro')).display`), "none");
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.hero-copy')).opacity`), "1");
    await evaluate(`window.qaReloadPending=true`);
    await command("Page.reload");
    await ready();
    for (let attempt = 0; attempt < 60; attempt++) {
      if (await evaluate(`getComputedStyle(document.querySelector('.site-intro')).visibility`) === "hidden") break;
      await delay(50);
    }
    assert.equal(await evaluate(`getComputedStyle(document.querySelector('.site-intro')).visibility`), "hidden");
    assert.deepEqual(runtimeErrors, []);
  });
  await t.test("Without JavaScript mobile navigation and direct email remain usable", async () => {
    await resize(375);
    await command("Emulation.setScriptExecutionDisabled", { value: true });
    await command("Page.reload");
    await delay(500);
    assert.equal(await evaluate(`document.querySelector('.form-submit').disabled`), true);
    assert.match(await evaluate(`document.querySelector('noscript').innerText`), /email.*directly/s);
    assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('#nav-links')).display`), "none");
  });
});
