import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { startLocalGame, PROJECT_PATH, openLocalBrowser } from "../launch.mjs";
import { BUILD_VERSION } from "../public/version.mjs";
import { characters } from "../public/engine.mjs";

const roster = Object.keys(characters);

async function occupiedPort(t) {
  const old = http.createServer((req, res) => res.end("unrelated existing server"));
  old.listen(0, "127.0.0.1");
  await once(old, "listening");
  t.after(() => new Promise(resolve => { old.closeAllConnections(); old.close(resolve); }));
  return old.address().port;
}

test("occupied default port opens this checkout on a new port and preserves the old server", async t => {
  const busy = await occupiedPort(t);
  const logs = [], opened = [];
  const launched = await startLocalGame({
    preferredPort: busy,
    log: line => logs.push(line),
    opener: async url => {
      const response = await fetch(url);
      assert.equal(response.status, 200, "browser only opens after the new server is listening");
      const html = await response.text();
      assert.equal((html.match(/data-char="/g) || []).length, roster.length);
      for (const character of roster) assert.ok(html.includes(`data-char="${character}"`));
      opened.push(url);
    },
  });
  t.after(() => launched.app.close());
  assert.notEqual(launched.address.port, busy);
  assert.deepEqual(opened, [launched.url]);
  assert.equal(await (await fetch(`http://127.0.0.1:${busy}/`)).text(), "unrelated existing server");
  assert.ok(logs.some(line => line.includes(PROJECT_PATH)));
  assert.ok(logs.some(line => line.includes(BUILD_VERSION) && line.includes(`${roster.length} fighters`)));
  assert.ok(logs.some(line => line.includes(launched.url)));
});

test("an explicit occupied port fails without opening a browser or changing the old server", async t => {
  const busy = await occupiedPort(t);
  let opened = false;
  await assert.rejects(startLocalGame({ port: busy, opener: () => { opened = true; }, log() {} }), { code: "EADDRINUSE" });
  assert.equal(opened, false);
  assert.equal(await (await fetch(`http://127.0.0.1:${busy}/`)).text(), "unrelated existing server");
});

test("invalid PORT values and nonlocal opener URLs are rejected", async () => {
  let opened = false;
  for (const port of ["", "8000x", "-1", "65536", "1.5", " 8000", "Infinity"]) {
    await assert.rejects(startLocalGame({ port, opener: () => { opened = true; }, log() {} }), /PORT/);
  }
  assert.equal(opened, false);
  await assert.rejects(openLocalBrowser("http://example.com/;echo injected"), /local game URL/);
});

test("CLI --no-open starts from another working directory and exits cleanly", async t => {
  const launcher = new URL("../launch.mjs", import.meta.url);
  const child = spawn(process.execPath, [fileURLToPath(launcher), "--no-open"], {
    cwd: tmpdir(), env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => { if (child.exitCode === null) child.kill("SIGTERM"); });
  let output = "", errors = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { errors += chunk; });
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Launcher did not start: ${output} ${errors}`)), 5000);
    child.once("error", error => { clearTimeout(timer); reject(error); });
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`Launcher exited early: ${code} ${errors}`)); });
    child.stdout.on("data", () => {
      const match = output.match(/Open: (http:\/\/127\.0\.0\.1:\d+\/rebirth\/)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  assert.equal((await fetch(url)).status, 200);
  assert.ok(output.includes(PROJECT_PATH));
  assert.ok(output.includes(`${BUILD_VERSION} · ${roster.length} fighters`));
  assert.equal(errors, "");
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  assert.equal((await exited)[0], 0);
});
