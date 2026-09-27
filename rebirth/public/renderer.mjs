/** Rebirth's native 480x270 pixel renderer. Gameplay coordinates are divided by two.
 * Prepared atlases include isolated poses and measured foot pivots. No per-frame
 * readback, flood filling, texture mutation, filters, or expensive image effects.
 */
import { moves, attackGeometry, getMove, magnusBikeShape, KATJA_ART_SCALE, ARCHER_ARROW_HEIGHT } from "./engine.mjs";

const W = 480,
  H = 270,
  FLOOR = 215;
const colors = {
  saber: "#9fe8e9", archer: "#eb8c91", gilgamesh: "#e6c471",
  lancer: "#819ee8", medusa: "#c3a0ea", iskandar: "#dcaa7c",
  gojo: "#a7b8fb", heracles: "#c69b76", allmight: "#f1d16d",
  katja: "#94d4d8", magnus: "#dfaa74", ambessa: "#df8c82",
  acheron: "#c9a0ec", boothill: "#deb37b",
};
// Portrait composition uses declared character height. Battle sprites always
// retain one authored scale and one fixed character multiplier across every pose.
const nativeHeights = { saber: 95, archer: 98, gilgamesh: 100, lancer: 98,
  medusa: 98, iskandar: 106, gojo: 100, heracles: 118, allmight: 116,
  katja: 100, magnus: 118, ambessa: 112, acheron: 96, boothill: 108 };
const characterScale = char => char === "katja" ? KATJA_ART_SCALE : 1;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const fract = (x) => x - Math.floor(x);
// Derived entirely from authoritative combat state: reconnects, interruptions,
// replays and round resets cannot leave a cinematic background behind. A new
// cast takes precedence over an idle empowered form; the final cut wins over
// all casts. Equal-priority simultaneous casts consistently use player order.
export function ultimateScene(state) {
  if (!state?.players || (state.phase && state.phase !== "fight")) return null;
  let scene = null;
  state.players.forEach((p, slot) => {
    if (p.hp <= 0 || p.action === "ko") return;
    const f = p.actionFrame || 0, move = getMove(p),
      duration = p.actionDuration || (move ? move.startup + move.active + move.recovery : 1);
    let priority = 0, amount = 0;
    if (p.char === "acheron" && p.action === "finisher") {
      priority = 400; amount = clamp((duration - f) / 20);
    } else if (p.action === "ultimate") {
      priority = ["archer", "acheron", "boothill"].includes(p.char) ? 300 : 200;
      amount = clamp(f / (p.char === "boothill" ? 18 : 24));
      if (p.char !== "acheron") amount *= clamp((duration - f) / 22);
    } else if (p.char === "acheron" && p.empower) {
      priority = 100; amount = 1;
    }
    if (priority && (!scene || priority > scene.priority)) scene = { type: p.char, player: p, slot, priority, amount };
  });
  return scene;
}
const visualFace = (p, state) => p.char === "ambessa" && p.action === "ultimate" && p.cast?.grab
  ? Math.sign((state.players[p.cast.grab.target]?.x ?? p.x) - p.x) || p.face || 1 : p.face || 1;
const noise = (x) => fract(Math.sin(x * 127.1 + 311.7) * 43758.5453);
const rect = (g, x, y, w, h, c) => {
  g.fillStyle = c;
  g.fillRect(
    Math.round(x),
    Math.round(y),
    Math.max(1, Math.round(w)),
    Math.max(1, Math.round(h)),
  );
};
const loadImage = (file) =>
  new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () =>
      reject(new Error(`그래픽을 불러오지 못했습니다: ${file}`));
    im.src = new URL(`./art/${file}`, import.meta.url).href;
  });
let sharedAssets = null,
  loadPromise = null;
async function loadAssets() {
  if (!loadPromise)
    loadPromise = (async () => {
      const dataPromise = fetch(new URL("./art/atlas.json", import.meta.url)).then(async response => {
        if (!response.ok) throw new Error("캐릭터 프레임 정보를 불러오지 못했습니다.");
        const data = await response.json();
        if (!data.frames?.length || !data.banks?.saber || !data.banks?.archer)
          throw new Error("캐릭터 프레임 정보가 올바르지 않습니다.");
        return data;
      });
      const spritesPromise = dataPromise.then(async data => {
        const [atlas, silhouettes] = await Promise.all([
          loadImage(data.textures?.atlas || "fighters.png"),
          loadImage(data.textures?.silhouettes || "silhouettes.png"),
        ]);
        return { atlas, silhouettes, data };
      });
      const [sprites, stage, world, effects, weaponResponse] =
        await Promise.all([
          spritesPromise,
          loadImage("moonlit-riverside.png"),
          loadImage("unlimited-blade-works.png"),
          loadImage("effects.png"),
          fetch(new URL("./art/weapon-art.json", import.meta.url)),
        ]);
      const { atlas, silhouettes, data } = sprites;
      if (!weaponResponse.ok) throw new Error("무기 그래픽 정보를 불러오지 못했습니다.");
      const weaponMeta = await weaponResponse.json(), weapons = {};
      await Promise.all(Object.entries(weaponMeta).map(async ([key, entry]) => {
        weapons[key] = { ...entry, image: await loadImage(entry.file) };
      }));
      sharedAssets = { atlas, silhouettes, stage, world, effects, weapons, ...data };
      return sharedAssets;
    })().catch(error => {
      // A transient connection failure must not poison every later retry.
      loadPromise = null;
      throw error;
    });
  return loadPromise;
}
function sprite(
  g,
  art,
  id,
  x,
  y,
  face = 1,
  scale = 1,
  alpha = 1,
  white = false,
) {
  const f = art.frames[id];
  if (!f) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(Math.round(x), Math.round(y));
  g.scale(face * scale, scale);
  g.drawImage(
    white ? art.silhouettes : art.atlas,
    f.x,
    f.y,
    f.w,
    f.h,
    -f.pivot,
    -f.foot,
    f.w,
    f.h,
  );
  g.restore();
}
// The atlas is baked at one scale per character. Every draw uses its authored
// foot pivot unchanged, including crouches, jumps, and weapons above the head.
function excaliburPose(frame) {
  return frame < 17 ? 0 : frame < 35 ? 1 : frame < 63 ? 2
    : frame < 80 ? 3 : frame < 86 ? 4 : frame < 94 ? 5
    : frame < 119 ? 6 : 7;
}
function frameFor(art, p, gait = 0) {
  const bank = art.banks[p.char] || art.banks.saber,
    f = Math.max(0, p.actionFrame || 0),
    m = getMove(p);
  const pick = (name, i = 0) => {
    const frames = bank[name]?.length ? bank[name] : bank.idle;
    return frames[Math.min(frames.length - 1, Math.max(0, i))];
  };
  if (p.char === "acheron") {
    const white = !!p.empower || p.action === "finisher";
    const attack4 = name => pick(name, f < (m?.startup || 12) * .55 ? 0 : f < (m?.startup || 12) ? 1
      : f < (m?.startup || 12) + (m?.active || 5) + 5 ? 2 : 3);
    if (p.action === "empoweredLight" || (white && p.action === "light")) {
      const sequence = Math.min(2, Math.max(0, p.cast?.empoweredSequence || 0));
      if (f > (m?.startup || 12) + (m?.active || 5) + 10) return pick("empoweredIdle");
      return pick("empoweredAttack", sequence * 2 + (f >= (m?.startup || 12) ? 1 : 0));
    }
    if (p.action === "finisher") return pick("finisher", f < 12 ? 0 : f < 22 ? 1 : f < 28 ? 2 : f < 34 ? 3 : f < 54 ? 4 : 5);
    if (p.action === "ultimate") return f < 24 ? pick("guard", 0) : pick("empoweredIdle", 0);
    if (p.action === "heavy") return attack4("heavy"); // The technique briefly draws the crimson blade in either form.
    if (p.action === "skill") return attack4(white ? "empoweredSkill" : "skill");
    if (white) {
      if (["ko", "hurt"].includes(p.action)) return pick("empoweredHurt", f < 8 ? 0 : 1);
      if (p.action === "guard" || p.blockstun > 0) return pick("empoweredGuard", f < 5 ? 0 : 1);
      if (p.y > 0 || p.action === "jump") return pick("empoweredJump", p.vy >= 0 ? 0 : 1);
      if (["run", "dash"].includes(p.action)) return pick("empoweredRun", Math.floor(fract(gait) * (bank.empoweredRun?.length || 4)));
      return pick("empoweredIdle", Math.floor(f / 15) % (bank.empoweredIdle?.length || 1));
    }
  }
  if (p.char === "boothill") {
    if (p.action === "ultimate") return pick("release", f < 16 ? 0 : f < 30 ? 1 : f < 44 ? 2 : f < 56 ? 3 : f < 68 ? 4 : f < 72 ? 5 : f < 86 ? 6 : 7);
    if (["light", "fanning"].includes(p.action)) {
      const shots = m?.releases || [m?.release || m?.startup || 11], last = [...shots].reverse().find(shot => shot <= f);
      if (f < shots[0]) return pick("attack", f < shots[0] * .55 ? 0 : 1);
      if (f > shots[shots.length - 1] + 6) return pick("attack", 3);
      return pick("attack", f - last < 3 ? 2 : 1);
    }
    if (p.action === "skill") return pick("skill", f < 8 ? 0 : f < 20 ? 1 : f < 26 ? 2 : 3);
  }
  if (p.bike && bank.mountedRun?.length) {
    if (p.bike.age < 7) return pick("mountedIdle");
    if (p.bike.speed >= 18) return pick("mountedCharge", Math.floor(f / 5) % 2);
    return pick("mountedRun", Math.floor(f / 5) % bank.mountedRun.length);
  }
  if (p.mount && bank.mounted?.length) {
    const mounted = (name, i = 0, fallback = 0) => bank[name]?.length ? pick(name, i) : pick("mounted", fallback);
    if (p.action === "guard" || p.action === "hurt" || p.blockstun > 0) return mounted("mountedGuard", 0, 7);
    if (p.action === "charge") {
      if (f < (m?.startup || 14)) return mounted("mountedCharge", 0, 5);
      if (f < (m?.startup || 14) + (m?.active || 18)) return mounted("mountedCharge", 1, 6);
      return mounted("mountedGuard", 0, 7);
    }
    if (["light", "heavy"].includes(p.action)) return mounted("mountedAttack", f < (m?.startup || 8) ? 0 : 1, f < (m?.startup || 8) ? 5 : 6);
    if (p.y > 0 || p.action === "jump") return mounted("mountedJump", 0, 3);
    if (p.action === "run" || p.action === "dash") return mounted("mountedRun", Math.floor(fract(gait) * (bank.mountedRun?.length || 4)), 1 + Math.floor(fract(gait) * 4));
    return mounted("mountedIdle", 0, 0);
  }
  if (p.action === "ko") return pick("hurt", 1);
  if (p.action === "hurt") return pick("hurt", f < 8 ? 0 : 1);
  if (p.action === "ultimate") {
    if (p.char === "medusa" || p.char === "iskandar") return pick(bank.release?.length ? "release" : "guard", f < 18 ? 0 : 1);
    if (p.char === "saber") {
      const pose = attackGeometry(p)?.poseIndex ?? excaliburPose(f);
      if (bank.excalibur?.length) return pick("excalibur", pose);
      if (bank.release?.length >= 8) return pick("release", pose);
      // Compatibility while the new atlas is being installed.
      return f < 60
        ? pick("release", f < 15 ? 0 : f < 38 ? 1 : 3)
        : pick("attack", f < 80 ? 1 : f < 121 ? 2 : 3);
    }
    if (p.char === "gilgamesh") return pick("release", f < 26 ? 0 : f < 84 ? 1 : f < 132 ? 2 : 3);
    if (p.char === "lancer") return pick("release", f < 30 ? 0 : f < 72 ? 1 : f < 82 ? 2 : 3);
    if (p.char === "gojo") return pick("release", f < 40 ? 0 : f < 76 ? 1 : f < 96 ? 2 : 3);
    if (p.char === "heracles") {
      if (f < 44) return pick("release", 0);
      if (f < 74) return pick("release", 1);
      if (f < 129) return pick("release", f >= 124 || (f - 74) % 6 < 3 ? 2 : 1);
      return pick("release", 3);
    }
    if (p.char === "allmight") return pick("release", f < 40 ? 0 : f < 74 ? 1 : f < 105 ? 2 : 3);
    if (p.char === "katja") {
      const shots = m?.releases || [60, 81, 102];
      if (f < shots[0]) return pick("release", f < Math.min(24, shots[0] * .5) ? 0 : 1);
      if (f < shots[1]) return pick("release", f < shots[0] + 6 ? 2 : 3);
      if (f < shots[2]) return pick("release", f < shots[1] + 6 ? 4 : 5);
      return pick("release", f < shots[2] + 7 ? 6 : 7);
    }
    if (p.char === "magnus") {
      if (f >= 111) return pick("release", f < 120 ? 4 : f < 130 ? 5 : f < 140 ? 6 : 7);
      if (f >= 32 && bank.mount?.length) return pick("mount");
      return pick("release", f < 16 ? 0 : f < 32 ? 1 : f < 42 ? 2 : 3);
    }
    if (p.char === "ambessa") {
      const caught = p.cast?.grab, finish = caught?.finishFrame || 86;
      if (art.version >= 7 && bank.charge?.length) {
        if (caught) return pick("release", f < finish - 11 ? 0 : f < finish - 8 ? 1 : f < finish - 5 ? 2
          : f < finish ? 3 : f < finish + 4 ? 4 : f < finish + 12 ? 5 : f < finish + 25 ? 6 : 7);
        return f >= 82 ? pick("release", 7) : pick("charge", f < 52 ? 0 : f < 60 ? 1 : f < 64 ? 2 : 3);
      }
      if (caught) return pick("release", f < finish - 6 ? 4 : f < finish ? 5 : f < finish + 13 ? 6 : 7);
      return pick("release", f < 52 ? 0 : f < 60 ? 1 : f < 64 ? 2 : f < 82 ? 3 : 7);
    }
    return f < 60
      ? pick("release", f < 15 ? 0 : f < 30 ? 1 : f < 45 ? 2 : 3)
      : pick("release", f < 116 ? 3 : 0);
  }
  if (p.action === "skill" && (p.char === "medusa" || p.char === "iskandar") && bank.skill?.length) return pick("skill", f < (m?.startup || 18) ? 0 : 1);
  if (p.action === "skill" && p.char === "gilgamesh") return pick(bank.skill?.length ? "skill" : "attack", f < 12 ? 0 : f < 22 ? 1 : f < 40 ? 2 : 3);
  if (p.action === "skill" && p.char === "lancer") return pick(bank.skill?.length ? "skill" : "heavy", f < 10 ? 0 : f < 13 ? 1 : f < 26 ? 2 : 3);
  if (p.action === "skill" && ["gojo", "heracles", "allmight"].includes(p.char)) {
    const start = m?.startup || 22, active = m?.active || 1;
    return pick("skill", f < start * .5 ? 0 : f < start ? 1 : f < start + active + 7 ? 2 : 3);
  }
  if (p.action === "skill" && p.char === "archer") {
    if (bank.bow?.length >= 6) {
      const release = m?.release ?? 25;
      return pick("bow", f < 8 ? 0 : f < 16 ? 1 : f < release ? 2
        : f < release + 4 ? 3 : f < release + 12 ? 4 : 5);
    }
    return pick("bow", f < 8 ? 0 : f < 25 ? 1 : f < 36 ? 2 : 3);
  }
  if (p.char === "magnus" && p.action === "skill") {
    if (f < 18) return pick("skill", 0);
    if (f < 55) return pick("skill", 1 + (Math.floor((f - 18) / 4) % 2));
    return pick("skill", 3);
  }
  if (p.char === "ambessa" && p.action === "skill") {
    const start = m?.startup || 22;
    if (art.version >= 7) return pick("skill", f < start * .55 ? 0 : f < start ? 1 : f < start + (m?.active || 6) + 6 ? 2 : 3);
    if (f >= start && f < start + (m?.active || 6) + 6 && bank.skillImpact?.length) return pick("skillImpact");
    return pick("skill", f < 6 ? 0 : f < 12 ? 1 : f < start ? 2 : 3);
  }
  if (p.char === "ambessa" && p.action === "heavyFollow" && art.version >= 7) {
    const start = m?.startup || 12;
    return pick("heavyFollow", f < start * .5 ? 0 : f < start ? 1 : f < start + (m?.active || 5) + 5 ? 2 : 3);
  }
  // These authored banks have one windup, two striking poses, then recovery.
  if ((p.char === "magnus" && ["light", "heavy"].includes(p.action)) ||
      (p.char === "ambessa" && ["light", "heavyFollow"].includes(p.action))) {
    const start = m?.startup || 10, active = m?.active || 4,
      name = p.action === "heavyFollow" ? "heavyFollow" : p.action === "heavy" ? "heavy" : "attack";
    return pick(name, f < start ? 0 : f < start + Math.max(2, Math.floor(active / 2)) ? 1 : f < start + active + 5 ? 2 : 3);
  }
  if (p.char === "katja" && ["light", "heavy", "skill"].includes(p.action)) {
    const release = m?.release ?? m?.startup ?? 18,
      name = p.action === "skill" ? "skill" : p.action === "heavy" ? "heavy" : "attack";
    return pick(name, f < release * .6 ? 0 : f < release ? 1 : f < release + 6 ? 2 : 3);
  }
  if (["light", "heavy", "skill"].includes(p.action)) {
    const start = m?.startup ?? (p.action === "heavy" ? 17 : p.action === "skill" ? 22 : 7),
      active = m?.active ?? 5,
      recovery = m?.recovery ?? 20,
      name = p.action === "heavy" && bank.heavy?.length ? "heavy" : "attack";
    if (bank[name]?.length === 2) return f < start ? pick(name, 0) : f < start + active + Math.min(8, recovery / 2) ? pick(name, 1) : pick("idle", 0);
    if (bank[name]?.length === 3) return pick(name, f < start ? 0 : f < start + active ? 1 : 2);
    if (bank[name]?.length >= 6) {
      return pick(name, f < start * 0.5 ? 0 : f < start ? 1
        : f < start + Math.max(1, active * 0.5) ? 2
        : f < start + active ? 3
        : f < start + active + recovery * 0.55 ? 4 : 5);
    }
    return pick(name, f < start * 0.65 ? 0 : f < start ? 1 : f < start + active ? 2 : 3);
  }
  if (p.action === "dash") return pick("dash", f < 6 ? 0 : 1);
  if (p.action === "guard" || p.blockstun > 0) return pick("guard", f < 5 || p.blockstun > 0 ? 0 : 1);
  if (p.y > 0 || p.action === "jump") return pick("jump", p.vy >= 0 ? 0 : 1);
  if (p.action === "run") return pick("run", Math.floor(fract(gait) * (bank.run?.length || 1)));
  return pick("idle", Math.floor(f / 15) % bank.idle.length);
}

function pixelRing(
  g,
  x,
  y,
  rx,
  ry,
  color,
  alpha = 1,
  segments = 36,
  phase = 0,
) {
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = color;
  for (let n = 0; n < segments; n++) {
    const a = (n * Math.PI * 2) / segments + phase;
    g.fillRect(Math.round(x + Math.cos(a) * rx), Math.round(y + Math.sin(a) * ry), 2, 1);
  }
  g.restore();
}
function pixelLine(g, x1, y1, x2, y2, color, thickness = 2, spacing = 2) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / spacing)),
    size = Math.max(1, Math.round(thickness)), half = thickness / 2;
  g.fillStyle = color;
  for (let n = 0; n <= steps; n++) {
    const q = n / steps;
    g.fillRect(Math.round(x1 + (x2 - x1) * q - half),
      Math.round(y1 + (y2 - y1) * q - half), size, size);
  }
}
function pixelDisc(g, x, y, rx, ry, color) {
  // Two-pixel scan lines keep magical shapes on the same visible raster as art.
  g.fillStyle = color;
  for (let yy = -Math.floor(ry); yy <= ry; yy += 2) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - yy * yy / (ry * ry)))) / 2 | 0;
    g.fillRect(Math.round(x - half * 2), Math.round(y + yy), Math.max(2, half * 4), 2);
  }
}
function pixelCrosshair(g, x, y, span, color, alpha = 1) {
  g.save();g.globalAlpha *= alpha;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const xx = x + sx * span, yy = y + sy * span * .72;
    pixelLine(g, xx, yy, xx - sx * 5, yy, color, 1);
    pixelLine(g, xx, yy, xx, yy - sy * 5, color, 1);
  }
  rect(g, x - 2, y, 5, 1, color);rect(g, x, y - 2, 1, 5, color);
  g.restore();
}
function sword(
  g,
  x,
  y,
  length = 28,
  angle = 0.6,
  color = "#e6d1bb",
  alpha = 1,
) {
  // Raster steps preserve the pixel grid even for diagonal conjured blades.
  g.save();
  g.globalAlpha *= alpha;
  const dx = Math.sin(angle),
    dy = Math.cos(angle);
  for (let j = 0; j < length; j += 2) {
    const px = x + dx * j,
      py = y + dy * j;
    rect(g, px, py, j < 4 ? 2 : 3, j < 4 ? 2 : 3, color);
    if (j > 2) rect(g, px, py, 1, 1, "#fff0db");
  }
  const h = length * 0.78,
    px = x + dx * h,
    py = y + dy * h;
  for (let n = -4; n <= 4; n += 2)
    rect(g, px + dy * n, py - dx * n, 2, 2, "#aa7f63");
  rect(g, x + dx * (length + 2), y + dy * (length + 2), 3, 5, "#535064");
  g.restore();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.surface = document.createElement("canvas");
    this.surface.width = W;
    this.surface.height = H;
    this.g = this.surface.getContext("2d", { alpha: false });
    this.g.imageSmoothingEnabled = false;
    this.gaits = [0, 0];
    this.lastX = [null, null];
    this.lastTick = -1;
    this.sceneArt = Object.create(null);
    this.ready = false;
    this.reducedMotion =
      globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      false;
  }
  async load() {
    this.art = await loadAssets();
    this.ready = true;
    return this;
  }
  drawPortrait(canvas, char) {
    return drawPortrait(canvas, char, this.art);
  }
  draw(state, { time = 0, localSlot = 0, debug = false } = {}) {
    if (!this.ready || !state?.players) return;
    const g = this.g,
      art = this.art,
      tick = state.tick || 0,
      t = tick / 60;
    // Gait follows actual traveled distance; hitstop and idle never cycle the feet.
    state.players.forEach((p, i) => {
      if (
        this.lastX[i] != null &&
        tick !== this.lastTick &&
        (p.action === "run" || (p.mount && ["charge", "dash"].includes(p.action)))
      ) {
        const dx = p.x - this.lastX[i];
        if (Math.abs(dx) < 70) this.gaits[i] += Math.abs(dx) / (p.mount ? 210 : 160);
      }
      this.lastX[i] = p.x;
    });
    this.lastTick = tick;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#080e17";
    g.fillRect(0, 0, W, H);
    g.save();
    if (state.hitstop > 0 && !this.reducedMotion)
      g.translate((tick % 3) - 1, tick % 2);
    const scene = ultimateScene(state);
    // These two cached stages are fully opaque at the peak of their fade. The
    // underlying riverside, petals and water would be completely overdrawn.
    if (!(scene?.amount === 1 && ["acheron", "boothill"].includes(scene.type))) this.background(state, t);
    this.ultimateBackground(state, t, scene);
    if (!scene || scene.type === "gojo") this.domainField(state, t);
    // An ultimate changes lighting and effects, never the fighters' scale.
    for (let i = 0; i < state.players.length; i++)
      this.shadow(state.players[i], localSlot === i, t);
    for (let i = 0; i < state.players.length; i++)
      this.fighter(state.players[i], i, state, t);
    for (const projectile of state.projectiles || [])
      this.projectile(projectile, state, t);
    for (const effect of state.effects || []) this.effect(effect, state, t);
    this.ultimateForeground(state, t, scene);
    if (debug) this.debug(state);
    g.restore();
    // Native canvas is the only scene raster; presentation can scale to any display.
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(
      this.surface,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
  }
  background(state, t) {
    const g = this.g;
    g.drawImage(this.art.stage, 0, 0);
    // Moonlight on the far water, then restrained drifting petals.
    for (let i = 0; i < 18; i++) {
      const a = 0.08 + 0.2 * Math.max(0, Math.sin(t * 1.5 + i * 3));
      g.globalAlpha = a;
      rect(
        g,
        84 + i * 19 + (i % 3) * 2,
        145 + ((i * 7) % 32),
        3 + (i % 4),
        1,
        "#b2e2ee",
      );
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 11; i++) {
      const x = ((i * 47 + t * (2 + (i % 4))) % 510) - 15,
        y = 42 + ((i * 19 + t * (1 + (i % 3))) % 173);
      g.globalAlpha = 0.14 + (i % 3) * 0.07;
      rect(g, x, y, 2, 1, "#e9aed8");
    }
    g.globalAlpha = 1;
    // Darker near edge gives the existing floor a readable combat plane.
    rect(g, 0, 254, W, 16, "#080e17aa");
  }
  shadow(p, isLocal, t) {
    const g = this.g,
      x = p.x / 2,
      height = clamp(1 - p.y / 330, 0.4, 1);
    const span = p.mount || p.bike ? 49 : 23 * characterScale(p.char);
    pixelRing(g, x, FLOOR + 1, span * height, (p.mount ? 6 : 4) * height, "#020812", 0.75, 38);
    rect(g, x - (span - 3) * height, FLOOR - 1, (span - 3) * 2 * height, 4, "#050b1599");
    // Small ground marker remains legible while feet are in the air.
    if (isLocal) {
      rect(g, x - 8, FLOOR + 7, 16, 1, colors[p.char]);
      rect(g, x - 4, FLOOR + 9, 8, 1, colors[p.char]);
    }
  }
  fighter(p, index, state, t) {
    const g = this.g,
      art = this.art,
      x = p.x / 2,
      y = FLOOR - p.y / 2,
      face = visualFace(p, state),
      scale = characterScale(p.char),
      frame = frameFor(art, p, this.gaits[index]);
    const m = getMove(p),
      f = p.actionFrame || 0,
      accent = p.char === "saber" && p.action === "ultimate" ? "#f5d98d" : colors[p.char] || colors.saber;
    this.characterAura(p, state, t);
    if (p.action === "dash") {
      for (let n = 3; n > 0; n--)
        sprite(g, art, frame, x - face * n * 11, y, face, scale, 0.055 * (4 - n));
      for (let n = 0; n < 7; n++)
        rect(
          g,
          x - face * (20 + n * 7),
          y - 10 - (n % 3) * 15,
          8 + (n % 2) * 8,
          1,
          `${accent}60`,
        );
    }
    if (p.action === "ultimate" && f < 80 && !["katja", "magnus", "ambessa", "acheron", "boothill"].includes(p.char)) {
      const amount = clamp(f / 60);
      pixelRing(g, x, y, 16 + amount * 18, 5 + amount * 3, accent, 0.6, 40, t);
      for (let n = 0; n < 22; n++) {
        const a = n * 2.4 + t * 2,
          r = 15 + ((((n * 13 - f * 0.7) % 51) + 51) % 51);
        const px = x + Math.cos(a) * r,
          py = y - 35 + Math.sin(a) * r - (f % 7);
        rect(
          g,
          px,
          py,
          1 + (n % 2),
          2 + (n % 3),
          `${accent}${f < 15 ? "66" : "bb"}`,
        );
      }
    }
    if (p.action === "skill" && p.char === "archer" && f < 25) {
      const q = f / 25;
      pixelRing(
        g,
        x + face * 42,
        y - ARCHER_ARROW_HEIGHT / 2,
        15 * (1 - q) + 3,
        15 * (1 - q) + 3,
        "#f0b4a3",
        0.75,
        18,
        t,
      );
      rect(g, x + face * 43 - 2, y - ARCHER_ARROW_HEIGHT / 2, 3, 3, "#fff2d8");
    }
    if (p.action === "ko") {
      g.save();
      g.translate(Math.round(x), Math.round(y));
      g.rotate(((-face * Math.PI) / 2) * clamp(f / 24));
      sprite(g, art, frame, 0, 0, face, scale, 0.9);
      g.restore();
      return;
    }
    let opacity =
      p.invuln > 0 && p.action !== "ultimate"
        ? 0.7 + 0.2 * (Math.floor(t * 15) % 2)
        : 1;
    sprite(g, art, frame, x, y, face, scale, opacity);
    if (p.char === "gojo") this.gojoHands(p, state);
    if (p.char === "katja") this.katjaWeapon(p, state);
    if (p.char === "boothill") this.boothillWeapon(p, state);
    this.statusEffects(p, state);
    if (p.action === "hurt" && f < 4)
      sprite(g, art, frame, x, y, face, scale, 0.32, true);
    if (p.action === "guard" || p.blockstun > 0) {
      for (let n = 0; n < 17; n++) {
        const a = -1.25 + n * 0.156;
        rect(
          g,
          x + face * (16 + Math.cos(a) * 24) * scale,
          y + (-47 + Math.sin(a) * 44) * scale,
          2,
          p.blockstun ? 4 : 2,
          `${accent}${p.blockstun ? "ef" : "77"}`,
        );
      }
    }
    if (
      ["light", "heavy", "skill"].includes(p.action) &&
      !(p.action === "skill" && p.char === "archer") &&
      !["gilgamesh", "lancer", "gojo", "heracles", "allmight", "katja", "magnus", "ambessa", "acheron", "boothill"].includes(p.char) && !p.mount
    ) {
      const startup =
          m?.startup ??
          (p.action === "heavy" ? 17 : p.action === "skill" ? 22 : 7),
        active = m?.active ?? 5;
      const progress = (f - startup) / (active + 5);
      if (progress >= 0 && progress <= 1) {
        const radius =
          p.action === "heavy" ? 65 : p.action === "skill" ? 68 : 53;
        for (let n = 0; n < 32; n++) {
          const q = n / 31,
            a = -1.55 + q * 2.7,
            fade = (1 - progress) * Math.sin(q * Math.PI);
          if (fade < 0.13) continue;
          const px = x + face * (8 + Math.cos(a) * radius),
            py = y - 52 + Math.sin(a) * radius * 0.6;
          rect(
            g,
            px,
            py,
            Math.max(1, 4 * fade),
            2,
            fade > 0.55 ? "#f5f5df" : accent,
          );
          if (p.char === "archer")
            rect(g, px - face * 5, py - 9, 2, 1, "#eeb8bd");
        }
      }
    }
  }
  projectile(p, state, t) {
    const g = this.g,
      x = p.x / 2,
      y = FLOOR - p.y / 2,
      dir = Math.sign(p.vx) || state.players[p.owner]?.face || 1;
    const width = Math.max(4, (p.width || 40) / 2),
      height = Math.max(3, (p.height || 20) / 2);
    if (p.type.startsWith("boothill-")) {
      const big = p.type === "boothill-deadeye", body = big ? width * .78 : 13,
        slope = -(p.vy || 0) / Math.max(1, Math.abs(p.vx || 1));
      for (let n = big ? 6 : 3; n > 0; n--) {
        g.globalAlpha = .075 * ((big ? 7 : 4) - n);
        const behind = body * .45 + n * (big ? 8 : 5);
        rect(g, x - dir * behind, y - slope * behind - (big ? 4 : 1), big ? 12 : 5, big ? 8 : 2, "#dc8e47");
      }
      g.globalAlpha = 1;
      if (big) {
        pixelDisc(g, x, y, body * .51, height * .39, "#9d5a32");
        pixelDisc(g, x + dir * 2, y - 1, body * .44, height * .28, "#e4ae59");
        pixelLine(g, x - dir * body * .3, y - slope * body * .3 - 2, x + dir * body * .36, y + slope * body * .36 - 2, "#fff1ba", 3);
        pixelRing(g, x - dir * body * .30, y, 3, height * .35, "#fbd797", .9, 22);
      } else {
        pixelLine(g, x - dir * body, y - slope * body, x + dir * 4, y + slope * 4, "#d8a866", 2);
        rect(g, x + dir * 3 - 1, y + slope * 3 - 1, 3, 2, "#fff0c3");
      }
      return;
    }
    if (p.type.startsWith("katja-")) {
      if (p.type === "katja-cone") {
        for (let n = 0; n < 11; n++) {
          const yy = y + (n - 5) * 4, rear = x - dir * (8 + Math.abs(n - 5) * 3);
          pixelLine(g, rear, yy, x + dir * (8 - Math.abs(n - 5)), yy + (n - 5), n % 3 ? "#9fced2" : "#e5ede1", n % 2 ? 1 : 2);
        }
      } else {
        const precision = p.type === "katja-precision", dy = -(p.vy || 0) / Math.max(1, Math.abs(p.vx || 1)),
          len = precision ? 19 : p.type === "katja-aimed" ? 22 : 14;
        pixelLine(g, x - dir * len, y - dy * len, x + dir * 5, y + dy * 5, precision ? "#86bdc9" : "#a8bdc5", precision ? 3 : 2);
        pixelLine(g, x - dir * 6, y - dy * 6, x + dir * 5, y + dy * 5, "#f7edcf", 1);
        rect(g, x - dir * (len + 7), y - dy * (len + 7), 4, 1, "#98b7c577");
      }
      return;
    }
    if (p.type === "magnus-bike") {
      const bank = this.art.banks.magnus?.projectileBike;
      if (bank?.length) sprite(g, this.art, bank[Math.floor(state.tick / 3) % bank.length], x, FLOOR - (p.y - magnusBikeShape.projectileY) / 2, dir);
      else { rect(g, x - 29, y - 13, 52, 18, "#626975"); pixelRing(g, x - 22, y + 15, 13, 13, "#2c343e", 1, 30); pixelRing(g, x + 22, y + 15, 13, 13, "#2c343e", 1, 30); }
      for (let n = 0; n < 8; n++) rect(g, x - dir * (35 + n * 9), FLOOR - 3 - n % 3 * 8, 6 + n % 3 * 3, 1, "#d4b09388");
      return;
    }
    if (p.type === "void-domain") return; // The persistent field is drawn behind the fighters.
    if (["blue-orb", "red-orb", "blue-pull", "hollow-purple"].includes(p.type)) {
      const purple = p.type === "hollow-purple", red = p.type === "red-orb",
        radius = Math.min(width, height) * (purple ? .46 : .43),
        palette = purple ? ["#372052", "#704298", "#b086d6", "#eee1ff"]
          : red ? ["#63273c", "#bc4664", "#f5a1b4", "#fff1e9"]
          : ["#16395c", "#3c76be", "#83c9f0", "#e3f5ff"];
      for (let n = 5; n > 0; n--) {
        g.globalAlpha = .08 * (6 - n);
        pixelDisc(g, x - dir * n * radius * .64, y, radius * (1 - n * .12), radius * (1 - n * .12), palette[1]);
      }
      g.globalAlpha = 1;
      this.spatialOrb(x, y, radius, palette, state.tick, purple);
      if (p.type === "blue-pull") for (let n = 0; n < 14; n++) {
        const phase = fract(t * 2 + n * .173), a = n * 2.4 + phase * .7,
          r = radius + (1 - phase) * 24;
        pixelLine(g, x + Math.cos(a) * r, y + Math.sin(a) * r,
          x + Math.cos(a + .1) * (r - 6), y + Math.sin(a + .1) * (r - 6), "#97ccec", 2);
      }
      return;
    }
    if (p.type === "detroit-wave") {
      this.pressureWave(x, y, width * .42, height * .45, dir, state.tick, 1);
      return;
    }
    if (p.type === "enuma-beam") { this.enumaBeam(p, state); return; }
    if (p.type.startsWith("gold-")) {
      const key = p.type === "gold-axe" ? "treasuryAxe" : p.type === "gold-spear" ? "treasurySpear" : "treasurySword";
      const weapon = this.art.weapons[key];
      if (weapon) {
        const angle = Math.atan2(weapon.tip[1] - weapon.pivot[1], weapon.tip[0] - weapon.pivot[0]);
        this.drawWeapon(key, x, y, -angle, dir, p.type === "gold-axe" ? 0.66 : 0.60);
      }
      for(let n=0;n<5;n++)rect(g,x-dir*(n*10+12),y+(n%3-1)*3,5+n,1,n%2?"#e5c06c77":"#fff0bbaa");
      return;
    }
    if (p.type === "wave") {
      g.save();
      g.translate(Math.round(x), Math.round(y));
      g.scale(dir, 1);
      g.drawImage(
        this.art.effects,
        0,
        0,
        128,
        96,
        -Math.round(width * 0.64),
        -Math.round(height * 0.54),
        Math.round(width * 1.28),
        Math.round(height * 1.08),
      );
      g.restore();
      return;
    }
    if (p.type === "ult-arrow") {
      const angle = (-Math.PI / 2) * dir;
      for (let n = 0; n < 5; n++) {
        const yy = y - height * 0.45 + n * height * 0.225,
          start = x + dir * (width * 0.46 - (n % 2) * 5);
        sword(g, start, yy, width * 0.75, angle, n % 2 ? "#d58a90" : "#efd1be");
        rect(g, start - dir * 12, yy, 14, 1, "#e59ba255");
      }
      return;
    }
    if (p.type === "ult-finish") {
      for (let n = 0; n < 7; n++) {
        const yy = y - height * 0.47 + n * height * 0.15;
        sword(
          g,
          x + dir * width * 0.45,
          yy,
          width * 0.86,
          (-Math.PI / 2) * dir,
          "#fee1d1",
          0.9,
        );
      }
      pixelRing(g, x, y, width * 0.47, height * 0.48, "#e99b90", 0.55, 44);
      return;
    }
    // Caladbolg: coherent spiraling arrowhead with a narrow crimson trail.
    for (let n = 5; n > 0; n--)
      rect(
        g,
        x - dir * (n * 10),
        y - 1,
        9,
        3,
        `#d17e91${["00", "99", "77", "55", "33", "11"][n]}`,
      );
    rect(g, x - width / 2, y - 2, width, 4, "#ded8e2");
    rect(g, x - width / 2, y - 1, width, 1, "#fff0de");
    for (let n = 0; n < 9; n++) {
      const a = n * 0.7 + t * 18;
      rect(
        g,
        x - dir * n * 3,
        y + Math.sin(a) * (height * 0.3),
        3,
        2,
        n % 2 ? "#e99daa" : "#f2d1b5",
      );
    }
  }
  effect(e, state, t) {
    const g = this.g,
      x = e.x / 2,
      y = FLOOR - e.y / 2,
      q = 1 - clamp(e.life / (e.maxLife || e.life || 1));
    if (["katja-scan", "katja-muzzle", "ambessa-shield"].includes(e.type)) return; // Attached effects use the current authored body anchors.
    if (e.type.startsWith("boothill-")) { this.boothillEffect(e, state, q); return; }
    if (e.type.startsWith("acheron-")) { this.acheronEffect(e, state, q); return; }
    if (e.type.startsWith("magnus-")) { this.magnusEffect(e, state, q); return; }
    if (e.type.startsWith("ambessa-")) { this.ambessaEffect(e, state, q); return; }
    if (e.type === "void-domain") return; // Kept behind both fighters in ultimateBackground.
    if (["nine-lives", "heracles-slam"].includes(e.type)) {
      const owner = state.players[e.owner], face = owner?.face || 1,
        final = (e.maxLife || 10) >= 30, slam = e.type === "heracles-slam",
        phase = Math.floor(((owner?.actionFrame || 74) - 74) / 6),
        direction = [1, -1, .2, -.7][((phase % 4) + 4) % 4],
        span = final ? 96 : slam ? 76 : 68;
      g.globalAlpha = clamp((1 - q) * 1.2);
      for (let layer = 0; layer < 3; layer++) {
        const a = -1.2 + direction * .9, d = (q - .5) * 12 + layer * 2;
        pixelLine(g, x - face * span * .65, y - Math.sin(a) * span * .45 + d,
          x + face * span * .7, y + Math.sin(a) * span * .45 + d,
          layer === 1 ? "#fff0c2" : "#b78b60", layer === 1 ? 3 : 2);
      }
      g.globalAlpha = 1;
      if (final || slam) this.groundDebris(x + face * 30, q, "#ba9b79", final ? 64 : 42);
      return;
    }
    if (["detroit-smash", "united-states-smash"].includes(e.type)) {
      const face = state.players[e.owner]?.face || 1, final = e.type === "united-states-smash";
      this.pressureWave(x + face * q * (final ? 25 : 12), y,
        (final ? 31 : 17) + q * (final ? 64 : 29), (final ? 39 : 25) + q * 32,
        face, state.tick, (1 - q) * .85);
      if (final) {
        this.groundDebris(x + face * 18, q, "#d1b384", 80);
        g.globalAlpha = (1 - q) * .6;
        for (let n = 0; n < 14; n++) {
          const a = n * Math.PI / 7, r = 18 + q * 90;
          pixelLine(g, x + Math.cos(a) * r, y + Math.sin(a) * r * .7,
            x + Math.cos(a) * (r + 16), y + Math.sin(a) * (r + 16) * .7, n % 3 ? "#e4e2c3" : "#7499c8", 2);
        }
        g.globalAlpha = 1;
      }
      return;
    }
    if (["mount-on", "mount-off", "mount-charge"].includes(e.type)) {
      const pegasus=state.players[e.owner]?.char === "medusa", color=pegasus?"#e1d6ff":"#e8bd7b", alpha=(1-q)*.8;
      pixelRing(g,x,FLOOR,20+q*48,5+q*10,color,alpha,42);
      for(let n=0;n<24;n++){
        const a=n*2.4,travel=(10+noise(n+e.id)*45)*(e.type==="mount-on"?1-q:q),
          xx=x+Math.cos(a)*travel,yy=FLOOR-10-noise(n+7)*100-Math.sin(a)*travel*.4;
        g.globalAlpha=alpha;rect(g,xx,yy,pegasus?2:3,pegasus?4:2,color);
      }g.globalAlpha=1;return;
    }
    if (e.type === "gold-portal") {
      const amount=Math.sin(Math.PI * clamp(e.life/(e.maxLife||20)));
      pixelRing(g,x,y,8*amount,19*amount,"#f1cb70",.9,38,t*2);
      pixelRing(g,x,y,5*amount,14*amount,"#8e6327",.85,32,-t*3);
      return;
    }
    if (e.type === "gold-sweep" || e.type === "gaebolg") {
      const gold=e.type==="gold-sweep";
      pixelRing(g,x,FLOOR,9+q*39,2+q*5,gold?"#e8c56d":"#d55b7c",(1-q)*.65,34);
      return;
    }
    const excaliburBurst = e.type === "burst" && state.players[e.owner]?.char === "saber";
    const color = excaliburBurst ? "#f4da98" :
      e.type === "block"
        ? "#b1e8ee"
        : colors[state.players[e.owner]?.char] || "#f4d6a2";
    if (excaliburBurst) {
      // Ground pressure stays below the hands so the downward finish is readable.
      pixelRing(g, x, FLOOR, 12 + q * 46, 2 + q * 5, "#eaca7f", (1 - q) * 0.7, 38);
      for (let n = 0; n < 9; n++) {
        g.globalAlpha = (1 - q) * 0.6;
        rect(g, x + (n - 4) * (4 + q * 8), FLOOR - n % 3 * (1 + q * 5), 3, 1, "#f6dea0");
      }
      g.globalAlpha = 1;
    } else if (e.type === "burst") {
      g.save();
      g.globalAlpha = 1 - q;
      const scale = 0.6 + q * 0.45;
      g.drawImage(
        this.art.effects,
        0,
        108,
        144,
        104,
        Math.round(x - 72 * scale),
        Math.round(FLOOR - 104 * scale),
        Math.round(144 * scale),
        Math.round(104 * scale),
      );
      g.restore();
    }
    if (
      [
        "hit",
        "block",
        "impact",
        "heavy-hit",
        "ko",
        "burst",
        "arrow-hit",
      ].includes(e.type)
    ) {
      const heavy = e.type === "heavy-hit" || e.type === "ko",
        r = 3 + q * (heavy ? 44 : 27),
        alpha = 1 - q;
      pixelRing(g, x, y, r, r * 0.7, color, alpha, 24, q * 0.4);
      for (let n = 0; n < 14; n++) {
        const a = n * 2.399,
          travel = 6 + q * (12 + noise(n + e.id) * 35),
          xx = x + Math.cos(a) * travel,
          yy = y + Math.sin(a) * travel;
        g.globalAlpha = alpha;
        rect(
          g,
          xx,
          yy,
          n % 3 === 0 ? 4 : 2,
          (n % 2) + 1,
          n % 3 === 0 ? "#fff0c9" : color,
        );
      }
      g.globalAlpha = 1;
      if (q < 0.24) {
        rect(g, x - 2, y - 10, 4, 20, "#fff1d2");
        rect(g, x - 10, y - 2, 20, 4, "#fff1d2");
      }
    } else if (
      e.type === "dash" ||
      e.type === "land" ||
      e.type === "dust" ||
      e.type === "jump"
    ) {
      for (let n = 0; n < 6; n++) {
        g.globalAlpha = (1 - q) * 0.3;
        rect(
          g,
          x + (n - 3) * (3 + q * 7),
          FLOOR - (n % 2) * (2 + q * 5),
          3 + q * 3,
          2,
          "#ccd4d5",
        );
      }
      g.globalAlpha = 1;
    }
  }
  spatialOrb(x, y, radius, palette, tick, purple = false) {
    const g = this.g;
    pixelDisc(g, x, y, radius, radius, palette[0]);
    pixelDisc(g, x - radius * .08, y - radius * .1, radius * .75, radius * .75, palette[1]);
    pixelDisc(g, x + radius * .04, y, radius * .48, radius * .5, palette[2]);
    pixelDisc(g, x, y, radius * .22, radius * .25, palette[3]);
    for (let n = 0; n < (purple ? 32 : 18); n++) {
      const a = n * 2.4 + tick * .045, r = radius * (.67 + noise(n + 4) * .48);
      rect(g, x + Math.cos(a) * r, y + Math.sin(a) * r, n % 4 ? 2 : 4, 2, palette[n % 3 + 1]);
    }
    pixelRing(g, x, y, radius * 1.2, radius * .67, palette[2], .7, 34, tick * .04);
    if (purple) pixelRing(g, x, y, radius * .73, radius * 1.2, "#b879d6", .6, 32, -tick * .05);
  }
  pressureWave(x, y, rx, ry, face, tick, alpha) {
    const g = this.g;
    g.save();g.globalAlpha *= alpha;
    for (let band = 0; band < 3; band++) for (let n = 0; n < 29; n++) {
      const a = -1.35 + n * 2.7 / 28,
        px = x + face * (Math.cos(a) * (rx - band * 6) - rx * .25),
        py = y + Math.sin(a) * (ry - band * 4);
      rect(g, px, py, band === 0 ? 4 : 3, 3, band === 0 ? "#fff1c9" : band === 1 ? "#d9dcd4" : "#7ca5c6");
    }
    for (let n = 0; n < 7; n++) {
      const offset = (n % 2 ? 1 : -1) * (6 + n * 4);
      rect(g, x - face * (rx * .3 + n * 5 + tick % 3), y + offset, 7 + n * 2, 1, "#bbcbcb");
    }
    g.restore();
  }
  groundDebris(x, q, color, radius) {
    const g = this.g;
    pixelRing(g, x, FLOOR, 8 + q * radius, 2 + q * 9, color, (1 - q) * .7, 40);
    g.globalAlpha = 1 - q;
    for (let n = 0; n < 16; n++) {
      const travel = (noise(n + 19) - .5) * radius * q * 2,
        rise = Math.sin(q * Math.PI) * (9 + noise(n + 8) * 32);
      rect(g, x + travel, FLOOR - rise, 2 + n % 3, 2, n % 3 ? color : "#e9d3af");
    }
    g.globalAlpha = 1;
  }
  domainField(state, t) {
    const g = this.g;
    for (const [index, p] of state.players.entries()) {
      if (p.char !== "gojo") continue;
      const event = (state.effects || []).find(e => e.type === "void-domain" && e.owner === index),
        f = p.actionFrame || 0, casting = p.action === "ultimate";
      if ((!casting || f < 42 || f > 137) && !event) continue;
      const alpha = casting ? clamp((f - 42) / 18) * clamp((145 - f) / 18)
        : clamp(event.life / 18), cx = p.x / 2, cy = FLOOR - 68;
      rect(g, 0, 0, W, FLOOR + 2, `rgba(8,9,28,${alpha * .82})`);
      for (let n = 0; n < 8; n++) {
        const phase = fract(t * .18 + n / 8), rx = 19 + phase * 287, ry = 6 + phase * 119;
        pixelRing(g, cx, cy, rx, ry, n % 2 ? "#8171ae" : "#476b99", alpha * (1 - phase) * .52, 64, n * .23);
      }
      for (let n = 0; n < 64; n++) {
        const a = n * 2.399, phase = fract(t * .15 + noise(n + 32)),
          r = 26 + phase * 350, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * .65;
        g.globalAlpha = alpha * phase * .75;
        pixelLine(g, x, y, x + Math.cos(a) * (2 + phase * 8), y + Math.sin(a) * (2 + phase * 8), n % 3 ? "#b5bfe0" : "#d1a7db", 1);
      }
      g.globalAlpha = 1;
    }
  }
  cinematicArt(type) {
    if (this.sceneArt[type]) return this.sceneArt[type];
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    const g = canvas.getContext("2d", { alpha: false }); g.imageSmoothingEnabled = false;
    if (type === "acheron") {
      // Official Stygian Resurge: a black eclipse, achromatic reflective plane
      // and scarlet petals. These shapes are authored on the native pixel grid.
      rect(g, 0, 0, W, H, "#08080c");
      for (let n = 0; n < 8; n++) {
        const x = (n * 137 + 29) % W, y = 21 + n * 17;
        rect(g, x - 70, y, 100 + n % 3 * 22, 2, "#141319");
        rect(g, x - 36, y + 3, 73, 1, "#1c1b20");
      }
      pixelDisc(g, 240, 79, 79, 79, "#302e35");
      pixelDisc(g, 240, 79, 76, 76, "#b6b3bb");
      pixelDisc(g, 240, 79, 74, 74, "#e8e6e8");
      pixelDisc(g, 240, 79, 71, 71, "#08080b");
      for (let n = 0; n < 110; n++) {
        const a = n / 110 * Math.PI * 2, r = 77 + noise(n + 140) * 3;
        rect(g, 240 + Math.cos(a) * r, 79 + Math.sin(a) * r, 1 + n % 2, 1, "#8d8992");
      }
      rect(g, 0, 157, W, 3, "#57545a");
      rect(g, 0, 160, W, H - 160, "#19181e");
      rect(g, 0, 160, W, 2, "#a09ca4");
      // Broken eclipse reflection grows wider toward the camera.
      for (let y = 164; y < H; y += 3) {
        const depth = (y - 160) / 110, half = 6 + depth * 88, offset = noise(y + 9) * 8 - 4;
        rect(g, 240 - half + offset, y, 3 + depth * 7, 1, y % 2 ? "#625e68" : "#96919a");
        rect(g, 240 + half + offset, y, 3 + depth * 7, 1, y % 2 ? "#817b87" : "#bbb4c0");
      }
      for (let n = 0; n < 210; n++) {
        const y = 164 + Math.floor(noise(n + 31) * 106), depth = (y - 160) / 110;
        rect(g, noise(n + 318) * W, y, 2 + depth * (8 + n % 16), 1,
          ["#2e2b33", "#3b3740", "#242229", "#111116"][n % 4]);
      }
    } else {
      // Dust Devil's Sunset Rodeo: low mesas, an immense yellow setting sun,
      // cactus silhouettes and long shadows on a flat, dry duelling ground.
      const sky = ["#4d2425", "#793127", "#a84227", "#d55f29", "#ed8b35", "#f5b54e"];
      sky.forEach((color, i) => rect(g, 0, i * 27, W, 28, color));
      pixelDisc(g, 240, 127, 91, 86, "#e4a344");
      pixelDisc(g, 240, 127, 86, 81, "#ffd66a");
      pixelDisc(g, 240, 126, 76, 73, "#ffe988");
      for (let n = 0; n < 14; n++) {
        const x = (n * 131 + 12) % W, y = 20 + n * 9;
        rect(g, x - 20, y, 29 + n % 4 * 17, 2 + n % 2, n < 8 ? "#853b2d" : "#cf7737");
        rect(g, x - 6, y - 2, 22 + n % 3 * 11, 2, n < 8 ? "#923f2b" : "#d5853c");
      }
      // Distant rock shelves leave the center open for the sunset silhouette.
      for (const [x, width, height] of [[0, 78, 22], [52, 50, 12], [112, 29, 8], [351, 42, 12], [392, 88, 26]]) {
        rect(g, x, 160 - height, width, height + 2, "#8b5137");
        rect(g, x + 4, 158 - height, width - 10, 3, "#b67943");
        for (let n = 0; n < width; n += 12) rect(g, x + n, 162 - height, 3, height - 2, "#70402f");
      }
      ["#c18448", "#a96e40", "#855136", "#643b2d", "#472a27"].forEach((color, i) => rect(g, 0, 162 + i * 23, W, 24, color));
      rect(g, 0, 160, W, 2, "#ffd076");
      for (let n = 0; n < 290; n++) {
        const y = 165 + Math.floor(noise(n + 100) * 105), depth = (y - 160) / 110;
        rect(g, noise(n + 530) * W, y, 2 + depth * (5 + n % 12), 1,
          ["#422925", "#71452f", "#a56f40", "#c18b4d"][n % 4]);
      }
      const cactus = (x, y, height, width, color) => {
        rect(g, x, y - height, width, height, color);
        rect(g, x + 1, y - height - 2, Math.max(2, width - 2), 2, color);
        for (const side of [-1, 1]) {
          const armY = y - height * (side < 0 ? .36 : .54), span = width + height * .11;
          rect(g, x + (side < 0 ? -span : width - 1), armY, span + 1, width, color);
          rect(g, x + (side < 0 ? -span : width + span - width), armY - height * .2, width, height * .2 + width, color);
        }
        rect(g, x + width, y - height + 6, 1, height - 6, "#9c5a37");
      };
      cactus(67, 176, 37, 3, "#613c2e"); cactus(406, 178, 45, 3, "#59342b");
      cactus(21, 216, 99, 6, "#342225"); cactus(449, 222, 85, 6, "#352125");
      cactus(39, 214, 53, 4, "#422729"); cactus(470, 229, 59, 4, "#2c2023");
      for (const x of [0, 8, 43, 435, 461, 478]) {
        pixelLine(g, x, 244, x - 6, 224, "#2c2023", 2);
        pixelLine(g, x, 244, x + 7, 230, "#2c2023", 2);
      }
    }
    this.sceneArt[type] = canvas;
    return canvas;
  }
  acheronScene(p, state, amount) {
    const g = this.g, f = p.actionFrame || 0, tick = state.tick || 0;
    g.save(); g.globalAlpha *= amount;
    g.drawImage(this.cinematicArt("acheron"), 0, 0);
    // Ripples and reflected fighters share the existing world-space foot line.
    for (let n = 0; n < 17; n++) {
      const x = (n * 61 + tick * .22) % W, y = 167 + n * 6;
      rect(g, x, y, 8 + n % 4 * 7, 1, n % 3 ? "#50495266" : "#b6acb566");
    }
    g.save(); g.beginPath(); g.rect(0, FLOOR + 2, W, H - FLOOR); g.clip();
    g.translate(0, FLOOR + 2); g.scale(1, -.42);
    for (const [index, fighter] of state.players.entries())
      sprite(g, this.art, frameFor(this.art, fighter, this.gaits[index]), fighter.x / 2, -fighter.y / 2,
        visualFace(fighter, state), characterScale(fighter.char), .16);
    g.restore();
    // Three unobtrusive red cuts remain behind the fighters as Rainblade charges
    // are spent. Their diagonals follow the three authored striking poses.
    const cuts = Math.min(3, p.empower?.used || 0);
    for (let n = 0; n < cuts; n++) {
      const rise = [27, -24, 0][n], yy = 99 + n * 12;
      pixelLine(g, 125, yy - rise, 355, yy + rise, "#641d34", 2);
      pixelLine(g, 167, yy - rise * .64, 313, yy + rise * .64, "#bb3454", 1);
    }
    for (let n = 0; n < 21; n++) {
      const x = (n * 67 + tick * (n % 3 + 2) * .35) % (W + 20) - 10,
        y = 24 + (n * 31 + tick * .36) % 181, lean = n % 2 ? 1 : -1;
      rect(g, x, y, 4, 1, n % 3 ? "#922d46" : "#d15064");
      rect(g, x + lean, y + 1, 3, 2, "#701e35");
    }
    if (p.action === "finisher" && f >= 28 && f < 57) {
      const q = clamp((f - 28) / 29), fade = (1 - q), cy = 116;
      g.globalAlpha *= fade;
      pixelLine(g, 17, cy + 5, W - 17, cy - 3, "#9c2547", 6);
      pixelLine(g, 32, cy + 5, W - 32, cy - 3, "#f07c8a", 2);
      pixelLine(g, 80, cy + 4, W - 80, cy - 2, "#fff0e9", 1);
      // The final slash opens a scarlet flower of energy, matching the official
      // finishing motif. It is confined behind the readable fighter silhouettes.
      const victim = state.players[1 - state.players.indexOf(p)], cx = clamp((victim?.x || 480) / 2, 74, W - 74), radius = 17 + q * 65;
      for (let petal = 0; petal < 6; petal++) {
        const angle = petal * Math.PI / 3 + .2;
        for (const side of [-1, 1]) {
          const mx = cx + Math.cos(angle + side * .3) * radius * .54,
            my = cy + Math.sin(angle + side * .3) * radius * .54,
            tx = cx + Math.cos(angle) * radius, ty = cy + Math.sin(angle) * radius;
          pixelLine(g, cx, cy, mx, my, "#a82b4c", 3);
          pixelLine(g, mx, my, tx, ty, "#e1687c", 2);
        }
      }
      pixelDisc(g, cx, cy, 5, 5, "#f6d7d8");
    }
    g.restore();
  }
  boothillScene(p, state, amount) {
    const g = this.g, f = p.actionFrame || 0;
    g.save(); g.globalAlpha *= amount;
    g.drawImage(this.cinematicArt("boothill"), 0, 0);
    for (const fighter of state.players) {
      const x = fighter.x / 2;
      for (let depth = 0; depth < H - FLOOR; depth += 2)
        rect(g, x + (x - 240) * depth * .009 - 7 - depth * .14,
          FLOOR + depth, 14 + depth * .28, 2, "#2c202555");
    }
    for (let n = 0; n < 16; n++) {
      const x = ((n * 79 + f * 3.6) % (W + 90)) - 60, y = 173 + n % 7 * 11;
      rect(g, x, y, 13 + n % 5 * 7, 1, "#deaf6c55");
    }
    // One tumbleweed, requested by the user, rolls once through the standoff.
    // It has a hollow, tangled twig silhouette; it is never a solid wheel.
    if (f >= 10 && f < 70) {
      const progress = (f - 10) / 60, x = -18 + progress * (W + 36),
        bounce = this.reducedMotion ? 0 : Math.abs(Math.sin(progress * Math.PI * 4)) * 3,
        y = FLOOR - 10 - bounce, angle = progress * Math.PI * 7, radius = 10;
      pixelRing(g, x, FLOOR + 2, 12, 2, "#322323", .45, 28);
      for (let n = 0; n < 12; n++) {
        const a = n / 12 * Math.PI * 2 + angle, b = a + 2.1 + noise(n + 11) * .7,
          r = radius * (.72 + noise(n + 38) * .35), color = n % 3 ? "#b17d47" : "#ecd094";
        const ax = x + Math.cos(a) * r, ay = y + Math.sin(a) * r;
        pixelLine(g, ax, ay, x + Math.cos(b) * radius * .7, y + Math.sin(b) * radius * .7, color, 1, 1);
        pixelLine(g, ax, ay, ax + Math.cos(a - .5) * 3, ay + Math.sin(a - .5) * 3, "#704b32", 1, 1);
      }
    }
    // A single warm impact pulse follows the release frame, without repeated
    // full-screen flashes, artificial zooming, or a change to sprite scale.
    if (f >= 68 && f < 80) rect(g, 0, 0, W, H, `rgba(255,193,105,${(1 - (f - 68) / 12) * .13})`);
    g.restore();
  }
  ultimateBackground(state, t, scene = ultimateScene(state)) {
    if (!scene) return;
    const g = this.g, p = scene.player, f = p.actionFrame || 0, q = scene.amount;
    if (scene.type === "acheron") { this.acheronScene(p, state, q); return; }
    if (scene.type === "boothill") { this.boothillScene(p, state, q); return; }
    if (scene.type === "archer") {
      g.globalAlpha = q * 0.92;
      g.drawImage(this.art.world, 0, 0);
      g.globalAlpha = 1;
      for (let n = 0; n < 15; n++) {
        const x = (n * 71 + 19) % W,
          y = 70 + noise(n + 3) * 79;
        if (f > 20 + n * 2)
          sword(
            g,
            x,
            y,
            16 + (n % 3) * 6,
            0.1 + ((n % 3) - 1) * 0.35,
            "#beaaa9",
            q * 0.55,
          );
      }
    } else if (scene.type === "saber") {
      rect(g, 0, 0, W, H, `rgba(9,12,23,${q * 0.68})`);
    } else {
      rect(g, 0, 0, W, H, `rgba(${p.char === "gilgamesh" ? "35,4,17" : "5,11,34"},${q * 0.65})`);
      if (p.char === "gilgamesh") {
        for(let n=0;n<11;n++){
          const x=(n*59+13)%W, y=40+(n*37)%118;
          pixelRing(g,x,y,12+f%17,5,"#be697e",q*.12,24,f*.01);
        }
      }
    }
  }

  ultimateForeground(state, t, scene = ultimateScene(state)) {
    if (!scene) return;
    const g = this.g, active = state.players.filter(p => p.hp > 0 && p.action === "ultimate"),
      waiting = scene.type === "acheron" && !["ultimate", "finisher"].includes(scene.player.action),
      barHeight = (waiting ? 5 : 13) * scene.amount;
    g.save();g.setTransform(1,0,0,1,0,0);
    if (barHeight > 0) {
      rect(g, 0, 0, W, Math.round(barHeight), "#060c15");
      rect(g, 0, H - barHeight, W, barHeight, "#060c15");
    }
    g.restore();
    // Each caster owns their weapon and foreground effects, including simultaneous casts.
    for (const p of active) {
      const f = p.actionFrame;
      if (p.char === "saber") this.saberGiantSword(p, state);
      if (p.char === "archer" && f >= 60 && f < 127) {
        const dest = state.players[1 - state.players.indexOf(p)] || p;
        for (let n = 0; n < 8; n++) {
          const phase = (f - 60 + n * 8) % 48;
          const x = dest.x / 2 + (n - 3) * 17 + phase * 0.15, y = 15 + phase * 4.1;
          sword(g, x, y, 17 + (n % 3) * 4, 0.12, "#eebfae", 0.25);
        }
      }
    }
  }
  drawWeapon(key, x, y, angle = 0, face = 1, scale = 1, alpha = 1) {
    const asset = this.art.weapons[key];if (!asset) return;
    const g = this.g;g.save();g.globalAlpha *= alpha;
    g.translate(Math.round(x),Math.round(y));g.scale(face,1);g.rotate(angle);g.scale(scale,scale);
    g.drawImage(asset.image,-asset.pivot[0],-asset.pivot[1]);g.restore();
  }
  drawSaberBlade(x, y, angle, face, length, alpha = 1, withHandle = true) {
    const asset=this.art.weapons.saberBlade;if(!asset)return;
    const g=this.g,grip=asset.pivot,join=asset.bladeBase,tip=asset.tip,
      hiltScale=.33,joinX=(join[0]-grip[0])*hiltScale,
      bladeScaleX=Math.max(.05,(length-joinX)/(tip[0]-join[0])),
      bladeScaleY=.27+clamp((length-53)/137)*.40;
    g.save();g.globalAlpha*=alpha;
    // The floor occludes a downward cut; the weapon cannot draw through the stage.
    g.beginPath();g.rect(-W,-H,W*3,FLOOR+H+1);g.clip();
    g.translate(Math.round(x),Math.round(y));g.scale(face,1);g.rotate(angle);
    // Keep the grip and crossguard at hand scale. Only the blade materializes
    // into a larger weapon; its measured tip still matches the shared hitbox.
    if(withHandle)g.drawImage(asset.image,0,0,join[0],asset.size[1],
      -grip[0]*hiltScale,-grip[1]*hiltScale,join[0]*hiltScale,asset.size[1]*hiltScale);
    g.drawImage(asset.image,join[0],0,asset.size[0]-join[0],asset.size[1],
      joinX,-join[1]*bladeScaleY,(asset.size[0]-join[0])*bladeScaleX,asset.size[1]*bladeScaleY);
    g.restore();
  }
  saberGiantSword(p, state) {
    const g = this.g, geometry = attackGeometry(p), asset = this.art.weapons.saberBlade;
    if (!geometry || !asset) return;
    const f=p.actionFrame, face=p.face||1, x=geometry.base.x/2, y=FLOOR-geometry.base.y/2,
      length=Math.hypot(geometry.tip.x-geometry.base.x,geometry.tip.y-geometry.base.y)/2,
      angle=geometry.angle ?? Math.atan2(geometry.tip.y-geometry.base.y,Math.abs(geometry.tip.x-geometry.base.x));
    if(geometry.active){
      // Three translucent silhouettes show a swung physical blade, never a beam.
      for(let n=3;n>0;n--)this.drawSaberBlade(x,y,-angle-n*.15,face,length,.065*(4-n),false);
      for(let n=0;n<42;n++){
        const u=n/41,a=-angle-.72+u*.72,r=length*.96,px=x+face*Math.cos(a)*r,py=y+Math.sin(a)*r;
        if(py>FLOOR)continue;
        g.globalAlpha=u*.55;rect(g,px,py,3,2,n%3?"#e8c267":"#fff1c8");
      }g.globalAlpha=1;
    }
    this.drawSaberBlade(x,y,-angle,face,length,1);
    const downward=Math.sin(-angle),groundDistance=FLOOR-y;
    if(f>=86&&f<114&&downward>0&&length*downward>groundDistance){
      const hitX=x+face*Math.cos(-angle)*groundDistance/downward,fade=clamp((114-f)/20);
      pixelRing(g,hitX,FLOOR,10+(f-86)*.8,3,"#e8c978",fade*.7,24);
      for(let n=0;n<9;n++){
        const q=fract((f-86)*.09+n*.19);g.globalAlpha=(1-q)*fade;
        rect(g,hitX+(noise(n+4)-.5)*q*38,FLOOR-Math.sin(q*Math.PI)*(6+n%4*3),2,1,n%2?"#dbc080":"#fff0c3");
      }g.globalAlpha=1;
    }
    if(f>26&&f<80){
      for(let n=0;n<13;n++){
        const d=fract(n*.127+state.tick*.009)*length;
        const xx=x+face*Math.cos(-angle)*d,yy=y+Math.sin(-angle)*d;
        rect(g,xx+Math.sin(n*2)*5,yy+Math.cos(n*2)*5,1,2,n%2?"#fff0b6":"#c99835");
      }
    }
  }
  characterAura(p, state, t) {
    const g=this.g,x=p.x/2,y=FLOOR-p.y/2,face=p.face||1,f=p.actionFrame||0;
    if (p.char === "acheron") this.acheronAura(p, state);
    if (p.char === "boothill" && p.duel) this.boothillDuel(p, state);
    if (p.char === "magnus") this.magnusAura(p, state);
    if (p.char === "ambessa") this.ambessaAura(p, state);
    if(p.mount){
      const m=getMove(p),charge=p.action==="charge",active=charge&&f>=(m?.startup||0)&&f<(m?.startup||0)+(m?.active||0),
        color=p.char==="medusa"?"#d8d0ff":"#edc688";
      if(charge&&f<(m?.startup||14))pixelRing(g,x+face*48,y-55,8+f*.6,16+f*.3,color,.5,28);
      if(active){
        const frame=frameFor(this.art,p);
        for(let n=2;n>0;n--)sprite(g,this.art,frame,x-face*n*18,y,face,1,.07*(3-n));
        for(let n=0;n<18;n++){
          const xx=x-face*(n*9+30),yy=y-8-(n%5)*17;
          rect(g,xx,yy,4+n%8,1,n%3?`${color}88`:color);
        }
      }
      if(["run","dash","charge"].includes(p.action))for(let n=0;n<7;n++){
        const phase=fract(t*2+n*.17);g.globalAlpha=(1-phase)*.28;
        rect(g,x-face*(20+phase*64),FLOOR-1-phase*(n%3)*8,3+phase*3,2,color);
      }
      g.globalAlpha=1;return;
    }
    const special=getMove(p),specialStart=special?.startup||0,specialEnd=specialStart+(special?.active||1)+6;
    if (p.char === "heracles" && ["light", "heavy", "skill"].includes(p.action)
      && f >= specialStart && f < specialEnd) {
      const progress = (f - specialStart) / (specialEnd - specialStart),
        reach = p.action === "light" ? 65 : 84,
        pose = this.art.frames[frameFor(this.art, p)],
        base = pose?.weaponBase || [9, -61], tip = pose?.weaponTip,
        angle = tip ? Math.atan2(tip[1] - base[1], tip[0] - base[0]) : 1.1,
        radius = tip ? Math.hypot(tip[0] - base[0], tip[1] - base[1]) : reach;
      g.globalAlpha = 1 - progress;
      for (let n = 0; n < 29; n++) {
        const a = angle - (1 - n / 28) * 1.4, r = radius - (n % 3) * 2;
        rect(g, x + face * (base[0] + Math.cos(a) * r), y + base[1] + Math.sin(a) * r,
          3, 3, n % 4 ? "#ba946b" : "#f2dfb3");
      }
      g.globalAlpha = 1;
    }
    if (p.char === "allmight") {
      const ultimate = p.action === "ultimate", start = ultimate ? 74 : specialStart,
        striking = ["light", "heavy", "skill", "ultimate"].includes(p.action)
          && f >= start && f < start + (ultimate ? 20 : 9);
      if (striking) {
        const alpha = clamp(1 - (f - start) / (ultimate ? 20 : 9)),
          hand = this.art.frames[frameFor(this.art, p)]?.handAnchor || [38, -62];
        this.pressureWave(x + face * hand[0], y + hand[1], ultimate ? 52 : 25, ultimate ? 49 : 27, face, state.tick, alpha * .75);
      }
      if (ultimate && f >= 64 && f < 88) {
        const frame = frameFor(this.art, p);
        for (let n = 3; n > 0; n--) sprite(g, this.art, frame, x - face * n * 18, y, face, 1, .045 * (4 - n));
        for (let n = 0; n < 11; n++) rect(g, x - face * (19 + n * 8), y - 18 - n % 4 * 21, 8 + n % 3 * 4, 1, n % 2 ? "#d3ac6888" : "#95b5df88");
      }
    }
    if(p.char==="medusa"&&p.action==="skill"&&f>=specialStart&&f<specialEnd){
      const progress=(f-specialStart)/(specialEnd-specialStart);
      for(let n=0;n<25;n++){
        const q=n/24,xx=x+face*(18+q*120),yy=y-54+Math.sin(q*Math.PI*2-progress*4)*10;
        rect(g,xx,yy,2,2,n%3?"#bcb7d1":"#f3daff");
      }
    }
    if(p.char==="iskandar"&&p.action==="skill"&&f>=specialStart&&f<specialEnd){
      for(let n=0;n<23;n++){
        const a=-1.5+n*.115;g.globalAlpha=1-(f-specialStart)/(specialEnd-specialStart);
        rect(g,x+face*(15+Math.cos(a)*90),y-61+Math.sin(a)*57,4,2,n%2?"#e7b268":"#fff0c9");
      }g.globalAlpha=1;
    }
    if(p.char==="gilgamesh"){
      if(["light","heavy","skill"].includes(p.action)){
        const count=p.action==="skill"?3:1;
        for(let n=0;n<count;n++){
          const phase=clamp((f-n*5)/12)*clamp(((p.actionDuration||50)-f)/12),px=x-face*(24+n*20),py=y-74-n%2*28;
          if(phase<=0)continue;
          pixelRing(g,px,py,9*phase,19*phase,"#f1cc78",.85,40,t*(n%2?-1:1));
          pixelRing(g,px,py,6*phase,15*phase,"#ad873f",.6,32,-t);
          const key=p.action==="heavy"?"treasuryAxe":n===1?"treasurySpear":n===2?"treasuryAxe":"treasurySword";
          this.drawWeapon(key,px,py,0,face,.36,phase*.9);
        }
      }
      if(p.action==="ultimate"){
        const pose=this.art.frames[frameFor(this.art,p)],tip=pose?.weaponTip||[35,-76],
          charge=clamp(f/84),px=x+face*tip[0],py=y+tip[1];
        for(let j=0;j<3;j++)for(let n=0;n<26;n++){
          const a=n*Math.PI/13+t*(j%2?-9:9),r=(13+j*7)*charge;
          rect(g,px+face*j*5+Math.cos(a)*r,py+Math.sin(a)*r*.7,2,2,j===1?"#ef9d8e":"#b62853");
        }
      }
    }
    if(p.char==="lancer"&&["light","heavy","skill","ultimate"].includes(p.action)){
      const m=moves.lancer?.[p.action],start=m?.startup||5,active=m?.active||4;
      if(f>=start&&f<start+active+8){
        const alpha=clamp(1-(f-start-active)/8),reach=p.action==="ultimate"?155:p.action==="skill"?105:70;
        const geometry=p.action==="ultimate"?attackGeometry(p):null;
        for(let n=0;n<12;n++){
          const q=n/11,px=geometry?(geometry.base.x+(geometry.tip.x-geometry.base.x)*q)/2:x+face*(15+q*reach),
            py=geometry?FLOOR-(geometry.base.y+(geometry.tip.y-geometry.base.y)*q)/2:y-67;
          g.globalAlpha=alpha*(1-q*.65);rect(g,px,py,5,2,n%3?"#ed6175":"#ffe0c9");
        }g.globalAlpha=1;
      }
      if((p.action==="skill"&&f>=10&&f<26)||(p.action==="ultimate"&&f>=70&&f<90)){
        const frame=frameFor(this.art,p);
        for(let n=3;n>0;n--)sprite(g,this.art,frame,x-face*n*15,y,face,1,.06*(4-n));
      }
    }
  }
  boothillDuel(p, state) {
    const target = state.players[p.duel?.target]; if (!target) return;
    const g = this.g, x = target.x / 2, y = FLOOR - target.y / 2;
    for (let n = 0; n < 6; n++) {
      const a = n * Math.PI / 3 + Math.PI / 6, xx = x + Math.cos(a) * 18, yy = y - 7 + Math.sin(a) * 6;
      rect(g, xx, yy, 3, 2, "#ddb37899");
    }
    pixelCrosshair(g, x, y - 58, 19, "#ce985f", .36);
  }
  boothillWeapon(p, state) {
    if (!["light", "fanning", "ultimate"].includes(p.action)) return;
    const g = this.g, f = p.actionFrame || 0, face = p.face || 1, m = getMove(p),
      pose = this.art.frames[frameFor(this.art, p)], muzzle = pose?.gunMuzzle || [33, -67.5],
      x = p.x / 2 + face * muzzle[0], y = FLOOR - p.y / 2 + muzzle[1],
      shots = m?.releases || [m?.release || m?.startup || 11], shot = [...shots].reverse().find(at => at <= f), age = shot == null ? -1 : f - shot;
    if (age >= 0 && age < 3) {
      const big = p.action === "ultimate", span = big ? 17 : 8;
      pixelLine(g, x, y, x + face * span, y, "#fff1be", big ? 4 : 2);
      for (let side of [-1, 1]) pixelLine(g, x + face * 3, y, x + face * (span - 2), y + side * (big ? 7 : 4), "#d69b58", big ? 2 : 1);
    }
    if (p.action === "ultimate" && f >= 38 && f < 68) {
      const target = state.players.find(other => other !== p);
      if (target) pixelCrosshair(g, target.x / 2, FLOOR - (target.y + 112) / 2, 28 - (f - 38) * .45, "#edc17f", .65);
      for (let n = 0; n < 3; n++) rect(g, x + face * (5 + n * 4), y - 1, 2, 2, "#e6bd7877");
    }
  }
  boothillEffect(e, state, q) {
    if (["boothill-muzzle", "boothill-sight"].includes(e.type)) return;
    const g = this.g, x = e.x / 2, y = FLOOR - e.y / 2, face = state.players[e.owner]?.face || 1;
    g.globalAlpha = clamp((1 - q) * 1.2);
    if (e.type === "boothill-spur") {
      for (let n = 0; n < 18; n++) {
        const a = -.9 + n / 17 * 2.1;
        rect(g, x + face * Math.cos(a) * (18 + q * 12), y + Math.sin(a) * 18, 3, 2, n % 3 ? "#b2b9b9" : "#eed6a8");
      }
    } else if (e.type === "boothill-rodeo") {
      pixelRing(g, x, y, 11 + q * 39, 16 + q * 25, "#dfa561", 1 - q, 42);
      for (let n = 0; n < 16; n++) {
        const a = n * Math.PI / 8, r = 8 + q * (25 + n % 3 * 9);
        pixelLine(g, x + Math.cos(a) * r, y + Math.sin(a) * r * .7,
          x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8) * .7, n % 3 ? "#ddaa6d" : "#fff0c1", 2);
      }
    } else if (e.type === "boothill-standoff") pixelCrosshair(g, x, y, 30 - q * 12, "#e4b575", 1 - q);
    g.globalAlpha = 1;
  }
  acheronAura(p, state) {
    const g = this.g, f = p.actionFrame || 0, face = p.face || 1, x = p.x / 2, y = FLOOR - p.y / 2,
      action = p.action, m = getMove(p), start = m?.startup || 12,
      pose = this.art.frames[frameFor(this.art, p)], base = pose?.weaponBase || pose?.handAnchor || [12, -61],
      tip = pose?.weaponTip || [67, -45], red = ["heavy", "empoweredLight", "finisher"].includes(action);
    if (action === "heavy" && f >= 15 && f < 25) {
      const frame = frameFor(this.art, p);
      for (let n = 3; n > 0; n--) sprite(g, this.art, frame, x - face * n * 16, y, face, 1, .045 * (4 - n));
    }
    if (action === "skill" && f < start) {
      const frame = frameFor(this.art, p), amount = Math.sin(clamp(f / start) * Math.PI) * .13;
      sprite(g, this.art, frame, x - face * 20, y - 2, face, 1, amount);
      sprite(g, this.art, frame, x + face * 20, y + 1, face, 1, amount);
      for (let n = 0; n < 7; n++) rect(g, x + face * (base[0] + n % 3 * 4), y + base[1] - n * 4, 1, 3, "#bca0e099");
    }
    if (!["light", "heavy", "skill", "empoweredLight", "finisher"].includes(action) || f < start || f >= start + (m?.active || 5) + 6) return;
    const angle = Math.atan2(tip[1] - base[1], tip[0] - base[0]), radius = Math.hypot(tip[0] - base[0], tip[1] - base[1]),
      alpha = clamp(1 - (f - start) / ((m?.active || 5) + 6));
    g.globalAlpha = alpha;
    for (let n = 0; n < 29; n++) {
      const a = angle - 1.1 + n / 28 * 1.1;
      rect(g, x + face * (base[0] + Math.cos(a) * radius), Math.min(FLOOR, y + base[1] + Math.sin(a) * radius), 3, 2,
        n % 4 ? red ? "#c93665" : "#9c78c6" : red ? "#ffe0db" : "#ead6fb");
    }
    g.globalAlpha = 1;
  }
  acheronEffect(e, state, q) {
    const g = this.g, owner = state.players[e.owner], face = owner?.face || 1,
      x = e.x / 2, y = FLOOR - e.y / 2, red = ["acheron-rainblade", "acheron-stygian", "acheron-ascendance"].includes(e.type);
    if (["acheron-awaken", "acheron-finish-windup"].includes(e.type)) {
      const floorX = owner?.x / 2 || x;
      pixelRing(g, floorX, FLOOR, 16 + q * 36, 4 + q * 4, "#c6426b", (1 - q) * .8, 40);
      for (let n = 0; n < 18; n++) {
        const yy = FLOOR - q * (55 + n % 4 * 21), xx = floorX + (noise(n + 3) - .5) * (22 + q * 30);
        rect(g, xx, yy, 2, 3, n % 3 ? "#ce426b88" : "#ffe2e8aa");
      }
      return;
    }
    const final = e.type === "acheron-stygian", crossed = e.type === "acheron-octobolt",
      sequence = owner?.cast?.empoweredSequence || 0,
      angle = crossed ? -.7 : final ? -.1 : e.type === "acheron-ascendance" ? -.08
        : e.type === "acheron-rainblade" ? [.55, -.6, 0][sequence] : -.7,
      span = final ? 157 : crossed ? 92 : e.type === "acheron-rainblade" ? 106 : 70,
      cx = owner ? owner.x / 2 + face * span * .46 : x;
    g.globalAlpha = clamp((1 - q) * 1.35);
    for (const a of crossed ? [angle, -angle] : [angle]) {
      const dx = Math.cos(a) * span * .53, dy = Math.sin(a) * span * .53;
      pixelLine(g, cx - face * dx, Math.min(FLOOR, y - dy), cx + face * dx, Math.min(FLOOR, y + dy), red ? "#9b224e" : "#5d427f", final ? 7 : 4);
      pixelLine(g, cx - face * dx, Math.min(FLOOR, y - dy), cx + face * dx, Math.min(FLOOR, y + dy), red ? "#f8becd" : "#cfb3e9", final ? 2 : 1);
      for (let n = 0; n < 13; n++) {
        const u = n / 12, px = cx + face * (u - .5) * span, py = y + (u - .5) * Math.sin(a) * span;
        rect(g, px - face * q * 15, py - (n % 2 ? 1 : -1) * q * (8 + n % 3 * 5), 2, 2, red ? "#e77194" : "#a28bd0");
      }
    }
    if (final) {
      pixelRing(g, cx, y, 12 + q * 80, 7 + q * 36, "#cc4777", (1 - q) * .5, 55);
      this.groundDebris(cx, q, "#a27791", 72);
    }
    g.globalAlpha = 1;
  }
  statusEffects(p, state) {
    const g = this.g, x = p.x / 2, y = FLOOR - p.y / 2;
    if (p.slow) {
      for (let n = 0; n < 6; n++) {
        const phase = fract(state.tick * .013 + n / 6), xx = x - 16 + n * 6;
        rect(g, xx, y - 3 - phase * 15, 2, 3, phase < .6 ? "#8fbdc7aa" : "#69899466");
      }
      pixelRing(g, x, y + 1, 19, 3, "#86bdc1", .45, 22);
    }
    if (p.char === "acheron" && p.empower) {
      const height = this.art.characterHeights?.acheron || nativeHeights.acheron;
      for (let n = 0; n < 3; n++) {
        const sx = x + (n - 1) * 9, sy = y - height - 10, full = n < p.empower.charges;
        rect(g, sx - 1, sy - 3, 2, 6, full ? "#da4f75" : "#564451");
        rect(g, sx - 3, sy - 1, 6, 2, full ? "#da4f75" : "#564451");
        if (full) rect(g, sx - 1, sy - 1, 2, 2, "#fce3dc");
      }
    }
    if (p.shield) {
      const face = p.face || 1, sx = x + face * 19,
        charged = p.cast?.shieldCharged, color = charged ? "#f4be94" : "#b36e65";
      for (let n = 0; n < 18; n++) {
        const q = n / 17, yy = y - 94 + q * 80, xx = sx + face * (15 + Math.sin(q * Math.PI) * 11);
        rect(g, xx, yy, 3, 3, color);
        if (n % 3 === 0) rect(g, xx - face * 4, yy, 2, 2, "#e1a69a99");
      }
      pixelLine(g, sx + face * 16, y - 96, sx - face * 6, y - 102, color, 2);
      pixelLine(g, sx + face * 16, y - 13, sx - face * 6, y - 6, color, 2);
    }
  }
  katjaWeapon(p, state) {
    if (!["light", "heavy", "skill", "ultimate"].includes(p.action)) return;
    const g = this.g, f = p.actionFrame || 0, face = p.face || 1,
      pose = this.art.frames[frameFor(this.art, p)], muzzle = pose?.gunMuzzle || [60, -63.5],
      scale = characterScale(p.char),
      x = p.x / 2 + face * muzzle[0] * scale, y = FLOOR - p.y / 2 + muzzle[1] * scale, m = getMove(p),
      shots = p.action === "ultimate" ? m?.releases || [60, 81, 102] : [m?.release || 16],
      elapsed = shots.map((shot) => f - shot).filter((delta) => delta >= 0), age = elapsed.length ? elapsed[elapsed.length - 1] : -1;
    // Each shot has a two-frame muzzle flash, followed by separate cartridge and
    // smoke pixels. A sniper never turns into a continuously lit beam.
    if (age >= 0 && age < 3) {
      const span = p.action === "skill" ? 12 : p.action === "ultimate" ? 10 : 7;
      pixelLine(g, x, y, x + face * span, y, "#fff2d5", 2);
      pixelLine(g, x + face * 3, y, x + face * (span - 2), y - 4, "#dbb57d", 1);
      pixelLine(g, x + face * 3, y, x + face * (span - 2), y + 4, "#dbb57d", 1);
      rect(g, x - 1, y - 2, 3, 4, "#fff6e2");
    }
    if (age >= 2 && age < 8) {
      const hand = pose?.handAnchor || [14, -63];
      rect(g, p.x / 2 + face * (hand[0] * scale - age * 1.3), FLOOR - p.y / 2 + hand[1] * scale - 8 - Math.sin(age / 8 * Math.PI) * 5, 2, 1, "#c7b383");
      rect(g, x + face * age, y - 3 - age, 2, 1, "#a6b5bd66");
    }
    if (p.action !== "ultimate" || f < 36 || f >= 110) return;
    const target = state.players.find((v) => v !== p); if (!target) return;
    const dx = p.x / 2 - face * 15, dy = FLOOR - p.y / 2 - 117 * scale + Math.round(Math.sin(state.tick * .16));
    // A tiny rigid reconnaissance drone: four arms and alternating rotor pixels.
    pixelLine(g, dx - 9, dy - 3, dx + 9, dy + 3, "#556b79", 2);
    pixelLine(g, dx - 9, dy + 3, dx + 9, dy - 3, "#556b79", 2);
    rect(g, dx - 5, dy - 2, 10, 5, "#344654");
    rect(g, dx - 3, dy - 2, 6, 2, "#aab9bd");
    rect(g, dx + face * 3, dy + 2, 2, 2, "#99d4d5");
    for (let side of [-1, 1]) for (let top of [-1, 1]) rect(g, dx + side * 9 - 4, dy + top * 4, 8, 1, state.tick % 2 ? "#8c9da6" : "#586c7b");
    const tx = target.x / 2, ty = FLOOR - (target.y + 105) / 2,
      next = shots.find((shot) => shot >= f), tighten = next == null ? 1 : clamp(1 - (next - f) / 20),
      alpha = age >= 0 && age < 5 ? .32 : .6;
    pixelCrosshair(g, tx, ty, 18 - tighten * 6, "#91cad2", alpha);
    // The scan is a short segmented observation cue, leaving the line of fire clear.
    if (f < 56) {
      const sy = ty - 30 + (f - 36) * 3;
      for (let n = -3; n <= 3; n++) rect(g, tx + n * 9, sy, 5, 1, "#91cad277");
    }
  }
  magnusAura(p, state) {
    const g = this.g, f = p.actionFrame || 0, x = p.x / 2, y = FLOOR - p.y / 2, face = p.face || 1;
    if (p.bike) {
      const frame = frameFor(this.art, p);
      if (p.bike.speed > 14) sprite(g, this.art, frame, x - face * 16, y, face, 1, .11);
      for (let n = 0; n < 9; n++) {
        const q = fract(state.tick * .04 + n * .133);
        rect(g, x - face * (32 + q * 67), y - 2 - q * (n % 3) * 11, 3 + q * 4, 2, `#bbab96${q < .4 ? "aa" : "55"}`);
      }
      for (let n = 0; n < 5; n++) rect(g, x - face * (44 + n * 9), y - 28 - n % 3 * 17, 9, 1, "#d6c3a477");
      return;
    }
    if (!["light", "heavy"].includes(p.action)) return;
    const move = getMove(p), start = move?.startup || 10;
    if (f < start || f >= start + (move?.active || 4) + 5) return;
    const pose = this.art.frames[frameFor(this.art, p)], base = pose?.weaponBase || [13, -60], tip = pose?.weaponTip || [62, -38],
      angle = Math.atan2(tip[1] - base[1], tip[0] - base[0]), radius = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
    g.globalAlpha = clamp(1 - (f - start) / ((move?.active || 4) + 5));
    for (let n = 0; n < 24; n++) {
      const a = angle - 1.4 + n / 23 * 1.4;
      rect(g, x + face * (base[0] + Math.cos(a) * radius), y + base[1] + Math.sin(a) * radius, 3, 2, n % 4 ? "#bca789" : "#efe3c9");
    }
    g.globalAlpha = 1;
  }
  magnusEffect(e, state, q) {
    const g = this.g, p = state.players[e.owner], face = p?.face || 1,
      x = e.type === "magnus-spin" && p ? p.x / 2 : e.x / 2, y = FLOOR - e.y / 2;
    g.globalAlpha = clamp((1 - q) * 1.2);
    if (e.type === "magnus-spin") {
      for (let band = 0; band < 2; band++) for (let n = 0; n < 42; n++) {
        const a = n / 41 * Math.PI * 1.6 + q * Math.PI * 2 + band * Math.PI,
          radius = 65 - band * 7;
        rect(g, x + Math.cos(a) * radius, y + Math.sin(a) * 18 + band * 7, 4, 2, n % 4 ? "#b6aaa0" : "#eee1c8");
      }
    } else if (e.type === "magnus-crash") {
      for (let n = 0; n < 24; n++) {
        const a = n * 2.4, radius = 6 + q * (35 + n % 5 * 7);
        rect(g, x + Math.cos(a) * radius, y + Math.sin(a) * radius * .7, n % 2 ? 3 : 5, 2, n % 4 ? "#d6ac78" : "#f9e3b5");
      }
      this.groundDebris(x, q, "#ad9580", 55);
    } else {
      for (let n = 0; n < 12; n++) rect(g, x - face * (q * (30 + n * 3) + n), FLOOR - Math.sin(q * Math.PI) * (3 + n % 4 * 4), 4, 2, "#b4a590");
    }
    g.globalAlpha = 1;
  }
  ambessaAura(p, state) {
    const g = this.g, f = p.actionFrame || 0, x = p.x / 2, y = FLOOR - p.y / 2, face = visualFace(p, state),
      m = getMove(p), start = m?.startup || 8;
    if (p.action === "ultimate" && p.cast?.grab && f < p.cast.grab.finishFrame) {
      const victim = state.players[p.cast.grab.target], pose = this.art.frames[frameFor(this.art, p)];
      if (victim) for (const key of ["weaponBase", "offhandWeaponBase"]) {
        const hand = pose?.[key] || [18, -79], sx = x + face * hand[0], sy = y + hand[1],
          ex = victim.x / 2, ey = FLOOR - victim.y / 2 - 53, length = Math.hypot(ex - sx, ey - sy), steps = Math.max(2, Math.ceil(length / 5));
        pixelLine(g, sx, sy, ex, ey, "#6d3f4c", 1);
        for (let n = 0; n <= steps; n++) rect(g, sx + (ex - sx) * n / steps, sy + (ey - sy) * n / steps, 2, 2, n % 2 ? "#d1ad84" : "#a75664");
      }
    }
    if (p.action === "ultimate" && f >= 60 && f < 82 && !p.cast?.grab) {
      const frame = frameFor(this.art, p);
      for (let n = 2; n > 0; n--) sprite(g, this.art, frame, x - face * n * 18, y, face, 1, .07 * (3 - n));
    }
    if (!["light", "heavy", "heavyFollow"].includes(p.action) || f < start || f >= start + (m?.active || 5) + 4) return;
    const pose = this.art.frames[frameFor(this.art, p)], fade = clamp(1 - (f - start) / ((m?.active || 5) + 4));
    g.globalAlpha = fade;
    for (const [baseKey, tipKey, fallback] of [["weaponBase", "weaponTip", [57, -55]], ["offhandWeaponBase", "offhandWeaponTip", [42, -30]]]) {
      const base = pose?.[baseKey] || [12, -61], tip = pose?.[tipKey] || fallback;
      if (p.action === "heavyFollow") {
        for (let n = 0; n < 3; n++) pixelLine(g, x + face * (tip[0] - 7 + n * 2), y + tip[1] - 34, x + face * (tip[0] + n * 2), Math.min(FLOOR, y + tip[1] + 6), n === 1 ? "#f2c9ae" : "#bb776c", n === 1 ? 3 : 1);
      } else {
        const radius = Math.hypot(tip[0] - base[0], tip[1] - base[1]), angle = Math.atan2(tip[1] - base[1], tip[0] - base[0]);
        for (let n = 0; n < 22; n++) {
          const sweeping = p.action === "heavy" && this.art.version >= 7,
            a = sweeping ? -1.35 + n / 21 * 2.7 : angle - 1.2 + n / 21 * 1.2,
            py = sweeping ? y - 55 + Math.sin(a) * radius * .42 : y + base[1] + Math.sin(a) * radius;
          rect(g, x + face * (base[0] + Math.cos(a) * radius), Math.min(FLOOR, py), 3, 2, n % 4 ? "#b97d74" : "#f0c4ac");
        }
      }
    }
    if (p.action === "heavyFollow") {
      for (let n = 0; n < 29; n++) {
        const xx = x + face * (20 + n / 28 * ((m?.range || 270) / 2 - 20)), rise = Math.sin(n / 28 * Math.PI) * 4;
        rect(g, xx, FLOOR - rise, 3, 2, n % 4 ? "#b8575c" : "#e3b784");
      }
    }
    g.globalAlpha = 1;
  }
  ambessaEffect(e, state, q) {
    const g = this.g, x = e.x / 2, y = FLOOR - e.y / 2;
    g.globalAlpha = clamp((1 - q) * 1.25);
    if (e.type === "ambessa-rush") {
      if (q < .28) for (let n = 0; n < 17; n++) rect(g, x + (state.players[e.owner]?.face || 1) * n * 8, FLOOR - 2, 4, 1, "#cc8a7d");
    } else if (e.type === "ambessa-catch") {
      for (let n = 0; n < 4; n++) {
        const a = Math.PI / 4 + n * Math.PI / 2, r = 32 - q * 11;
        pixelLine(g, x + Math.cos(a) * r, y + Math.sin(a) * r, x + Math.cos(a) * (r + 12), y + Math.sin(a) * (r + 12), "#d89682", 3);
      }
    } else if (e.type === "ambessa-finish") {
      for (let side of [-1, 1]) {
        pixelLine(g, x + side * (23 + q * 7), y - 47, x + side * 4, Math.min(FLOOR, y + 38), "#b84155", 6);
        pixelLine(g, x + side * (21 + q * 7), y - 45, x + side * 4, Math.min(FLOOR, y + 36), "#f1c19c", 2);
      }
      this.groundDebris(x, q, "#bb9380", 42);
    } else if (e.type === "ambessa-slam") {
      pixelRing(g, x, FLOOR, 14 + q * 47, 3 + q * 9, "#cf9681", 1 - q, 48);
      this.groundDebris(x, q, "#b38b77", 45);
    }
    g.globalAlpha = 1;
  }
  gojoHands(p, state) {
    if (!["light", "heavy", "skill", "ultimate"].includes(p.action)) return;
    const g = this.g, f = p.actionFrame || 0, face = p.face || 1,
      pose = this.art.frames[frameFor(this.art, p)],
      hand = pose?.handAnchor || [26, -63], x = p.x / 2 + face * hand[0], y = FLOOR - p.y / 2 + hand[1],
      m = getMove(p), blue = ["#16395c", "#3c76be", "#83c9f0", "#e3f5ff"], red = ["#63273c", "#bc4664", "#f5a1b4", "#fff1e9"];
    if (p.action !== "ultimate") {
      if (f >= (m?.release || 24)) return;
      const palette = p.action === "heavy" ? red : blue, size = 2 + clamp(f / (m?.startup || 24)) * (p.action === "light" ? 3 : 5);
      this.spatialOrb(x, y, size, palette, state.tick);
      return;
    }
    if (f >= 76 && f < 96) {
      const converge = clamp((f - 76) / 20), gap = (1 - converge) * 20;
      this.spatialOrb(x - face * gap, y - gap * .55, 5 + converge * 2, blue, state.tick);
      this.spatialOrb(x + face * gap, y + gap * .55, 5 + converge * 2, red, state.tick);
      if (converge > .6) this.spatialOrb(x, y, (converge - .6) * 16, ["#372052", "#704298", "#b086d6", "#eee1ff"], state.tick, true);
    }
  }
  enumaBeam(projectile, state) {
    const g=this.g,p=state.players[projectile.owner];if(!p)return;
    const pose=this.art.frames[frameFor(this.art,p)],tip=pose?.weaponTip||[64,-74];
    const face=projectile.dir||p.face||1,originX=p.x/2+face*tip[0],originY=FLOOR-p.y/2+tip[1],
      limit=face>0?W+30:-30,length=Math.abs(limit-originX),tick=state.tick;
    // A continuous crimson body and white-pink core carry the sustained beam;
    // rotating ribbons stay visible outside it, all on the native pixel grid.
    for(let d=0;d<length;d+=4){
      const growth=clamp(d/28),x=originX+face*d,half=6+growth*9;
      rect(g,x,originY-half,5,half*2,"#801637");
      rect(g,x,originY-half*.76,5,half*1.52,"#c43859");
      rect(g,x,originY-half*.5,5,half,"#eb8295");
    }
    for(let band=0;band<5;band++)for(let d=0;d<length;d+=4){
      const growth=clamp(d/48),wave=Math.sin(d*.044-tick*.34+band*Math.PI*.4),
        yy=originY+wave*(9+growth*28),xx=originX+face*d;
      rect(g,xx,yy,5,band%2?4:6,band===2?"#f3b5a3":band%2?"#c54265":"#6b173b");
      if(band===2&&Math.floor(d/8)%3===0)rect(g,xx,yy,5,1,"#ffe3c7");
    }
    for(let d=0;d<length;d+=4){
      const half=4+clamp(d/35)*2;
      rect(g,originX+face*d,originY-half,5,half*2,"#ffc6d1");
      rect(g,originX+face*d,originY-2,5,4,"#fff4e9");
    }
    for(let n=0;n<7;n++)pixelRing(g,originX+face*(n*39+(tick*3)%39),originY,5,22+n%2*9,"#d26378",.55,28,tick*.1);
  }
  debug(state) {
    const g = this.g;
    g.save();
    g.lineWidth = 1;
    for (const p of state.players) {
      g.strokeStyle = "#9ef2b4";
      g.strokeRect(
        Math.round(p.x / 2 - 15),
        Math.round(FLOOR - p.y / 2 - 88),
        30,
        88,
      );
    }
    for (const p of state.projectiles || []) {
      g.strokeStyle = "#ed988f";
      g.strokeRect(
        Math.round((p.x - p.width / 2) / 2),
        Math.round(FLOOR - (p.y + p.height / 2) / 2),
        p.width / 2,
        p.height / 2,
      );
    }
    g.restore();
  }
}

export function drawPortrait(canvas, char, art = sharedAssets) {
  if (!art) return false;
  const g = canvas.getContext("2d"),
    w = canvas.width,
    h = canvas.height,
    accent = colors[char] || colors.saber;
  g.clearRect(0, 0, w, h);
  g.imageSmoothingEnabled = false;
  // Geometric backdrop keeps the character card crisp at any screen density.
  // Keep the surrounding CSS card visible through the portrait.
  const left = ["saber", "gilgamesh", "medusa", "gojo", "heracles", "katja", "ambessa"].includes(char),
    face = left ? 1 : -1;
  for (let n = 0; n < 8; n++)
    rect(
      g,
      w * 0.19 + n * 22,
      28 + n * 5,
      w * 0.52 - n * 14,
      h - 52 - n * 9,
      n % 2 ? "#13212b" : "#17262f",
    );
  rect(g, w * 0.5 - 1, 24, 2, h - 40, `${accent}22`);
  pixelRing(g, w * 0.5, h * 0.46, w * 0.29, h * 0.31, `${accent}44`, 1, 60);
  const frame = art.banks[char]?.idle[0] ?? art.banks.saber.idle[0],
    f = art.frames[frame],
    height = art.characterHeights?.[char] || nativeHeights[char] || 100,
    footprint = { lancer: 164, medusa: 138, iskandar: 146, heracles: 170, allmight: 140, katja: 165, magnus: 145, ambessa: 175, acheron: 163, boothill: 145 }[char] || 126,
    scale = Math.min(w / (footprint + 12), (h - 20) / (height + 8)),
    drawScale = scale * characterScale(char),
    centerOffset = (f.w / 2 - f.pivot) * face * drawScale;
  sprite(g, art, frame, w * .5 - centerOffset, h - 12, face, drawScale, 1);
  for (let n = 0; n < 10; n++)
    rect(
      g,
      23 + noise(n + 22) * w * 0.87,
      15 + noise(n + 38) * h * 0.7,
      2,
      2,
      `${accent}66`,
    );
  rect(g, 20, h - 9, w - 40, 1, `${accent}44`);
  return true;
}
