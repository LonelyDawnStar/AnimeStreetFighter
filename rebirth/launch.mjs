import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGameServer } from "./server.mjs";
import { characters } from "./public/engine.mjs";
import { BUILD_VERSION } from "./public/version.mjs";

export const PROJECT_PATH = fileURLToPath(new URL("../", import.meta.url));

function validPort(value) {
  if (!/^(0|[1-9]\d*)$/.test(String(value))) {
    throw new Error("PORT must be an integer from 0 to 65535.");
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) {
    throw new Error("PORT must be an integer from 0 to 65535.");
  }
  return port;
}

export function openLocalBrowser(url) {
  // Only our numeric loopback URL is accepted; no shell interprets this argument.
  if (!/^http:\/\/127\.0\.0\.1:\d+\/rebirth\/$/.test(url)) {
    return Promise.reject(new Error("The launcher can only open its local game URL."));
  }
  const [command, args] = process.platform === "win32"
    ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url]]
    : process.platform === "darwin"
      ? ["open", [url]]
      : ["xdg-open", [url]];
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { detached: true, stdio: "ignore", shell: false });
    child.once("error", reject);
    child.once("spawn", () => { child.unref(); resolve(); });
  });
}

/** Start this checkout. An occupied default port never redirects to an older server. */
export async function startLocalGame({
  port = process.env.PORT,
  preferredPort = 8000,
  openBrowser = true,
  opener = openLocalBrowser,
  log = console.log,
} = {}) {
  const explicitPort = port !== undefined;
  const firstPort = validPort(explicitPort ? port : preferredPort);
  let app = createGameServer();
  let address;
  try {
    try {
      address = await app.listen(firstPort);
    } catch (error) {
      await app.close();
      if (explicitPort || error.code !== "EADDRINUSE") throw error;
      log(`Port ${firstPort} is already in use. Starting this build on another available port.`);
      // Use a fresh server so callbacks from the failed listen cannot run on retry.
      app = createGameServer();
      address = await app.listen(0);
    }
  } catch (error) {
    await app.close();
    throw error;
  }
  const url = `http://127.0.0.1:${address.port}/rebirth/`;
  log(`AnimeStreetFighter Rebirth ${BUILD_VERSION} · ${Object.keys(characters).length} fighters`);
  log(`Project: ${PROJECT_PATH}`);
  log(`Open: ${url}`);
  log("Keep this window open while playing. Press Ctrl+C to stop this server.");
  if (openBrowser) {
    try { await opener(url); }
    catch (error) { log(`Could not open a browser (${error.message}). Open the address above manually.`); }
  }
  return { app, address, url };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const unknown = process.argv.slice(2).filter(arg => arg !== "--no-open");
    if (unknown.length) throw new Error(`Unknown argument: ${unknown.join(" ")}`);
    const { app } = await startLocalGame({ openBrowser: !process.argv.includes("--no-open") });
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, async () => { await app.close(); process.exit(0); });
    }
  } catch (error) {
    console.error(`Unable to start this Rebirth build: ${error.message}`);
    process.exitCode = 1;
  }
}
