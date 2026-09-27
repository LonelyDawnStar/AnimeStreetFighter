import {
  INPUT,
  characters,
  moves,
  getMove,
  createMatch,
  step,
  aiInput,
} from "./engine.mjs";
import { Renderer } from "./renderer.mjs";
import { setPortrait, warmPortrait } from "./portraits.mjs";
import { BUILD_VERSION } from "./version.mjs";

const elements = new Map();
const $ = (id) => {
  if (!elements.has(id)) elements.set(id, document.getElementById(id));
  return elements.get(id);
};
$("buildVersion").textContent = `v${BUILD_VERSION}`;
const renderer = new Renderer($("gameCanvas"));
const NAMES = {
  saber: "SABER",
  archer: "ARCHER",
  gilgamesh: "GILGAMESH",
  lancer: "LANCER",
  medusa: "MEDUSA",
  iskandar: "ISKANDAR",
  gojo: "GOJO",
  heracles: "HERACLES",
  allmight: "ALL MIGHT",
  katja: "KATJA",
  magnus: "MAGNUS",
  ambessa: "AMBESSA",
  acheron: "ACHERON",
  boothill: "BOOTHILL",
};
const TITLES = {
  saber: "EXCALIBUR",
  archer: "UNLIMITED BLADE WORKS",
  gilgamesh: "ENUMA ELISH",
  lancer: "GÁE BOLG",
  medusa: "BELLEROPHON",
  iskandar: "BUCEPHALUS",
  gojo: "UNLIMITED VOID",
  heracles: "NINE LIVES",
  allmight: "UNITED STATES OF SMASH",
  katja: "IN A BLITZ",
  magnus: "BIKE FROM HELL",
  ambessa: "PUBLIC EXECUTION",
  acheron: "SLASHED DREAM",
  boothill: "SUNSET RODEO",
};
const PROFILES = {
  saber: { name: "알트리아 펜드래곤", class: "SABER" },
  archer: { name: "에미야", class: "ARCHER" },
  gilgamesh: { name: "길가메시", class: "ARCHER" },
  lancer: { name: "쿠 훌린", class: "LANCER" },
  medusa: { name: "메두사", class: "RIDER" },
  iskandar: { name: "이스칸다르", class: "RIDER" },
  gojo: { name: "고죠 사토루", class: "SORCERER" },
  heracles: { name: "헤라클레스", class: "BERSERKER" },
  allmight: { name: "올마이트", class: "HERO" },
  katja: { name: "카티야", class: "SNIPER" },
  magnus: { name: "매그너스", class: "BRAWLER" },
  ambessa: { name: "암베사", class: "T1 · WARRIOR" },
  acheron: { name: "아케론", class: "ASSASSIN" },
  boothill: { name: "부트힐", class: "GUNSLINGER" },
};
const SKILL_COPY = {
  saber: [
    "스트라이크 에어",
    "전방으로 바람의 참격을 날립니다.",
    "엑스칼리버",
    "거대한 황금빛 검으로 전방을 내려칩니다.",
  ],
  archer: [
    "칼라드볼그",
    "활을 당겨 강력한 투영검을 쏩니다.",
    "무한의 검제",
    "검의 세계를 펼쳐 투영검으로 몰아칩니다.",
  ],
  gilgamesh: [
    "왕의 재보",
    "세 개의 무작위 무기를 연속으로 사출합니다.",
    "에누마 엘리시",
    "에아를 개방해 전방으로 광선을 지속 발사합니다.",
  ],
  lancer: [
    "돌격 찌르기",
    "빠르게 거리를 좁히며 창으로 찌릅니다.",
    "게이 볼그",
    "깊게 파고드는 돌진 뒤 강력한 창격을 가합니다.",
  ],
  medusa: [
    "사슬 단검",
    "사슬을 뻗어 떨어진 상대를 견제합니다.",
    "벨레로폰",
    "8초 동안 페가수스 탑승. L / U로 반복 돌진합니다.",
  ],
  iskandar: [
    "전진 베기",
    "검을 크게 휘두르며 전방을 압박합니다.",
    "부케팔로스",
    "8초 동안 군마 탑승. L / U로 묵직하게 돌진합니다.",
  ],
  gojo: [
    "술식 순전 「창」",
    "푸른 투사체를 날려 적중한 상대를 당깁니다.",
    "무량공처 · 허식 「자」",
    "근처를 영역으로 묶은 뒤, 전방으로 허식 「자」를 쏩니다.",
  ],
  heracles: [
    "도끼검 강타",
    "버티며 전진해 무거운 도끼검을 내려칩니다.",
    "나인 라이브즈",
    "근거리에서 아홉 번의 연속 공격을 몰아칩니다.",
  ],
  allmight: [
    "디트로이트 스매시",
    "강한 펀치로 전방에 공기 충격파를 보냅니다.",
    "유나이티드 스테이츠 오브 스매시",
    "앞으로 파고들며 온 힘을 실은 한 방을 날립니다.",
  ],
  katja: [
    "접근 금지",
    "짧게 사격한 뒤 물러납니다. 적은 둔화되고 자신은 빨라집니다.",
    "정밀 조준",
    "전방을 조준해 세 발을 쏩니다. 뒤의 탄환이 더 강하고 적중 시 둔화시킵니다.",
  ],
  magnus: [
    "17대 1",
    "무기를 휘두르며 회전해 주변을 연속 공격합니다.",
    "폭주 바이크",
    "바이크로 돌진합니다. 주행 중 U를 다시 누르면 전방으로 발사합니다.",
  ],
  ambessa: [
    "배척",
    "보호막을 얻고 힘을 모아 주변을 강타합니다.",
    "공개 처형",
    "돌진해 상대를 들어 올린 뒤 바닥에 내려칩니다.",
  ],
  acheron: [
    "팔뢰비도",
    "준비 뒤 보라빛 교차 참격을 냅니다.",
    "단칼에 끊어낸 붉은 꿈 조각",
    "다음 J 세 번이 눈물 베기로 강화됩니다. 마지막에 황천의 귀환이 이어집니다.",
  ],
  boothill: [
    "뜨거운 자갈 위 탱고",
    "5초 동안 J가 3연발이 됩니다. 서로 받는 피해가 커집니다.",
    "더스트 데빌의 선셋 로데오",
    "강력한 한 발을 쏩니다. 막히지 않으면 잠시 둔화·취약을 겁니다.",
  ],
};
const HEAVY_COPY = {
  acheron: ["피상을 절단한 자아", "낮게 파고들며 전방으로 발도합니다."],
  boothill: ["두개골을 부수는 발굽", "뒤꿈치로 가까운 상대를 차고 밀어냅니다."],
  katja: ["조준 사격", "총구를 겨누고 강한 한 발을 쏩니다. J는 기본 사격입니다."],
  ambessa: ["교활한 휩쓸기 / 파멸의 일격", "첫 K가 적중하면 잠시 후속타를 쓸 수 있습니다. K를 다시 눌러 전방으로 내려치세요."],
};
const STEP = 1000 / 60;
let selected = "saber",
  mode = "ai",
  loaded = false,
  playing = false;
let assetPromise = null, loadingBattle = false, startingBattle = false;
let frameRequest = null, lastHudState = null, lastHudKey = "";
let lastRenderedState = null, lastRenderedTick = -1, lastRenderedDebug = false;
let waitingView = null, waitingViewKey = "";
let state = null,
  authoritative = null,
  paused = false,
  networkPaused = false,
  debug = false,
  dummyGuard = false;
let socket = null,
  room = null,
  roomPlayers = [],
  generation = 0,
  reconnectTimer = null,
  pingTimer = null,
  openTimer = null;
let sequence = 0,
  pending = [],
  remoteInputs = [0, 0],
  lastServerAt = 0,
  lastServerTick = -1,
  networkRtt = 0;
let accumulator = 0,
  lastTime = performance.now(),
  drawPositions = [],
  frameCount = 0,
  fpsTime = lastTime,
  fps = 60;
let toastTimer,
  offlineSeed = 7,
  onlineBusy = false,
  reconnectDeadline = 0,
  endingShown = false;
const sources = new Map(),
  tapped = [0, 0];
const audioSeen = new Map();
const storage = {
  get(key) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch {}
  },
  remove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch {}
  },
};
function notify(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 4500);
}
function text(id, value) {
  const element = $(id),
    next = String(value);
  if (element.textContent !== next) element.textContent = next;
}
function hidden(element, value) {
  const next = Boolean(value);
  if (element.hidden !== next) element.hidden = next;
}
function classState(element, name, value) {
  const next = Boolean(value);
  if (element.classList.contains(name) !== next) element.classList.toggle(name, next);
}
function width(element, value) {
  if (element.style.width !== value) element.style.width = value;
}
function source(id, player, mask) {
  const old = sources.get(id)?.mask || 0;
  tapped[player] |= mask & ~old;
  if (mask) sources.set(id, { player, mask });
  else sources.delete(id);
}
function input(player) {
  let mask = tapped[player];
  for (const s of sources.values()) if (s.player === player) mask |= s.mask;
  tapped[player] = 0;
  return mask;
}
function clearInput() {
  sources.clear();
  tapped.fill(0);
  joystickPointer = null;
  document.querySelectorAll(".held").forEach((e) => e.classList.remove("held"));
  $("joystickKnob").style.transform = "";
  if (
    room &&
    authoritative &&
    !networkPaused &&
    socket?.readyState === WebSocket.OPEN
  )
    send({ type: "input", seq: ++sequence, mask: 0 });
}

class DuelAudio {
  enabled = false;
  context = null;
  bus = null;
  async toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        this.context ||= new Audio();
        this.bus ||= this.context.createGain();
        this.bus.gain.value = 0.12;
        this.bus.disconnect();
        this.bus.connect(this.context.destination);
        await this.context.resume();
        this.tone(440, 0.12, "sine", 220);
      } catch {
        this.enabled = false;
        notify("이 브라우저에서 사운드를 시작하지 못했어요.");
      }
    }
    text("soundToggle", this.enabled ? "사운드 ON" : "사운드 OFF");
    text("arenaSound", this.enabled ? "소리 ON" : "소리 OFF");
    $("soundToggle").setAttribute("aria-pressed", String(this.enabled));
    $("arenaSound").setAttribute("aria-pressed", String(this.enabled));
  }
  tone(frequency, duration = 0.1, type = "triangle", end = frequency / 2) {
    if (!this.enabled || !this.context || this.context.state !== "running")
      return;
    const t = this.context.currentTime,
      oscillator = this.context.createOscillator(),
      gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, end),
      t + duration,
    );
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.65, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    oscillator.connect(gain);
    gain.connect(this.bus);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  event(e) {
    if (e.type === "hit") {
      this.tone(e.heavy ? 125 : 200, e.heavy ? 0.2 : 0.11, "triangle", 36);
      this.tone(750, 0.055, "sawtooth", 160);
    } else if (e.type === "block") this.tone(570, 0.12, "square", 210);
    else if (e.type === "swing")
      this.tone(e.heavy ? 260 : 430, 0.09, "triangle", 100);
    else if (e.type === "projectile") this.tone(680, 0.17, "sawtooth", 170);
    else if (e.type === "ultimate") {
      this.tone(110, 0.65, "sawtooth", 330);
      this.tone(440, 0.7, "sine", 660);
    } else if (e.type === "ko") this.tone(280, 0.5, "triangle", 45);
  }
}
const sound = new DuelAudio();
$("soundToggle").onclick = () => sound.toggle();
$("arenaSound").onclick = () => sound.toggle();
function hearEvents(s) {
  const now = performance.now();
  for (const e of s.events || []) {
    const key = `${s.round}:${s.tick}:${e.type}:${e.owner}:${e.target}`;
    if (!audioSeen.has(key)) {
      audioSeen.set(key, now);
      sound.event(e);
    }
  }
  for (const [key, stamp] of audioSeen)
    if (now - stamp > 3000) audioSeen.delete(key);
}
function chooseCharacter(char) {
  if (!Object.hasOwn(NAMES, char)) return;
  selected = char;
  document.querySelectorAll("[data-char]").forEach((b) => {
    const chosen = b.dataset.char === char;
    b.classList.toggle("selected", chosen);
    b.setAttribute("aria-pressed", String(chosen));
  });
  text("selectionHint", `SELECTED / ${NAMES[char]}`);
  const character = characters[char];
  const profile = PROFILES[char];
  text("selectedName", profile.name);
  text("selectedClass", profile.class);
  text("selectedEnglish", NAMES[char]);
  text("selectedTitle", character?.title || profile.class);
  text("selectedRole", character?.role || "");
  text("selectedIndex", `${String(Object.keys(NAMES).indexOf(char) + 1).padStart(2, "0")} / ${Object.keys(NAMES).length}`);
  setPortrait($("selectedPortrait"), char, { large: true, label: `${profile.name} 상반신 초상화` });
  $("fighterShowcase").dataset.fighter = char;
  $("fighterShowcase").style.setProperty("--fighter", character?.color || "#96cbd8");
  const stats = [
    ["Hp", character?.maxHp, Math.max(...Object.values(characters).map(c => c.maxHp))],
    ["Speed", character?.speed, Math.max(...Object.values(characters).map(c => c.speed))],
    ["Power", moves[char]?.heavy.damage, Math.max(...Object.values(moves).map(m => m.heavy.damage))],
  ];
  for (const [id, value, maximum] of stats) {
    text(`stat${id}`, value ?? "—");
    $(`stat${id}Bar`).style.width = `${value ? value / maximum * 100 : 0}%`;
  }
  ["skillName", "skillDescription", "ultimateName", "ultimateDescription"].forEach(
    (id, i) => text(id, SKILL_COPY[char][i]),
  );
  $("heavyBrief").hidden = !HEAVY_COPY[char];
  if (HEAVY_COPY[char]) {
    text("heavyName", HEAVY_COPY[char][0]);
    text("heavyDescription", HEAVY_COPY[char][1]);
  }
}
for (const b of document.querySelectorAll("[data-char]")) {
  b.onclick = () => chooseCharacter(b.dataset.char);
  b.addEventListener("pointerenter", () => warmPortrait(b.dataset.char), { once: true });
  b.addEventListener("focus", () => warmPortrait(b.dataset.char), { once: true });
}
$("opponent").addEventListener("change", () => setPortrait($("opponentPortrait"), $("opponent").value));
function chooseMode(next) {
  mode = next;
  document.querySelectorAll("[data-mode]").forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", String(active));
  });
  $("offlineOptions").hidden = mode === "online";
  $("onlineOptions").hidden = mode !== "online";
  $("difficultyField").hidden = mode !== "ai";
  text(
    "opponentLabel",
    mode === "local" ? "2P 파이터" : mode === "training" ? "훈련 상대" : "상대 파이터",
  );
  const copy = {
    ai: [
      "SOLO CHALLENGE",
      "AI와 맞붙어라.",
      "상대의 빈틈을 읽고, 나만의 공방을 완성해 보세요.",
      "AI 대전 시작",
      "3판 2선승 · 90초",
    ],
    training: [
      "TRAINING GROUND",
      "한 수씩, 정확하게.",
      "체력과 궁극기 제한 없이 기술의 거리와 타이밍을 익혀 보세요.",
      "훈련장 입장",
      "무제한 체력 · 궁극기",
    ],
    local: [
      "SIDE BY SIDE",
      "나란히 앉아, 정면 승부.",
      "1P는 WASD·JKL, 2P는 방향키·숫자패드. 같은 키보드로 대전하세요.",
      "로컬 대전 시작",
      "3판 2선승 · 같은 기기",
    ],
  }[mode];
  if (copy)
    [
      "modeKicker",
      "modeHeading",
      "modeDescription",
      "startText",
      "formatLabel",
    ].forEach((id, i) =>
      text(id, startingBattle && i === 3 ? "대전 준비 중…" : copy[i]),
    );
}
for (const b of document.querySelectorAll("[data-mode]"))
  b.onclick = () => chooseMode(b.dataset.mode);
function updateAvailability() {
  $("startButton").disabled = startingBattle;
  $("createRoom").disabled = startingBattle || onlineBusy;
  $("joinRoom").disabled = startingBattle || onlineBusy;
  document.querySelectorAll("[data-mode]").forEach(button => { button.disabled = startingBattle; });
}
async function ensureBattleAssets() {
  if (loaded) return;
  if (!assetPromise) {
    loadingBattle = true;
    text("assetStatus", "PREPARING THE ARENA");
    assetPromise = renderer.load().then(() => {
      loaded = true;
      text("assetStatus", "READY FOR THE NEXT DUEL");
    }).catch(error => {
      assetPromise = null;
      text("assetStatus", "시작을 누르면 전투 화면을 다시 준비합니다.");
      throw error;
    }).finally(() => { loadingBattle = false; });
  }
  return assetPromise;
}
async function prepareBattle() {
  startingBattle = true;
  updateAvailability();
  chooseMode(mode);
  try {
    await ensureBattleAssets();
    return true;
  } catch (error) {
    notify(error.message || "전투 화면을 불러오지 못했어요. 다시 시작해 주세요.");
    return false;
  } finally {
    startingBattle = false;
    updateAvailability();
    chooseMode(mode);
  }
}
let preloadTimer = null;
function scheduleBattlePreload() {
  if (loaded || loadingBattle || preloadTimer !== null || document.hidden) return;
  preloadTimer = setTimeout(() => {
    preloadTimer = null;
    const preload = () => {
      if (!document.hidden) ensureBattleAssets().catch(() => {});
    };
    if (window.requestIdleCallback) requestIdleCallback(preload, { timeout: 2000 });
    else preload();
  }, 2500);
}
function enterArena() {
  playing = true;
  endingShown = false;
  $("lobby").hidden = true;
  $("arena").hidden = false;
  document.body.classList.add("in-arena");
  $("trainingBar").hidden = mode !== "training";
  $("pauseButton").hidden = mode === "online";
  text(
    "controlHint",
    mode === "local"
      ? "1P WASD · JKL / 2P 방향키 · 숫자패드 123"
      : "A D 이동 · W 점프 · S 가드 · SPACE 회피",
  );
  accumulator = 0;
  lastTime = performance.now();
  fpsTime = lastTime;
  frameCount = 0;
  lastRenderedState = null;
  drawPositions = [];
  clearInput();
  window.scrollTo(0, 0);
  requestFrame();
}
function resetLocal() {
  state = createMatch({
    chars: [selected, $("opponent").value],
    training: mode === "training",
    seed: offlineSeed++,
  });
  authoritative = null;
  paused = false;
  networkPaused = false;
  endingShown = false;
  drawPositions = [];
  audioSeen.clear();
  $("arenaOverlay").hidden = true;
  $("rematchButton").disabled = false;
  text("rematchButton", "다시 대전 →");
  if (mode === "training") {
    state.phase = "fight";
    state.phaseFrame = 0;
  }
}
$("startButton").onclick = async () => {
  if (startingBattle) return;
  if (!(await prepareBattle())) return;
  disconnect();
  resetLocal();
  enterArena();
  if (sound.enabled) sound.context.resume();
};
function disconnect() {
  generation++;
  clearTimeout(reconnectTimer);
  clearTimeout(openTimer);
  clearInterval(pingTimer);
  reconnectDeadline = 0;
  if (socket) {
    socket.onclose = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.close();
    socket = null;
  }
  room = null;
  pending = [];
  remoteInputs = [0, 0];
  storage.remove("rebirth-room");
  onlineBusy = false;
}
function backToLobby() {
  if (room) send({ type: "leave" });
  disconnect();
  playing = false;
  cancelAnimationFrame(frameRequest);
  frameRequest = null;
  state = null;
  authoritative = null;
  paused = false;
  networkPaused = false;
  $("lobby").hidden = false;
  $("arena").hidden = true;
  $("arenaOverlay").hidden = true;
  document.body.classList.remove("in-arena");
  clearInput();
  updateAvailability();
  const url = new URL(location.href);
  url.searchParams.delete("room");
  history.replaceState(null, "", url);
  window.scrollTo(0, 0);
}
$("backButton").onclick = backToLobby;
$("resultBack").onclick = backToLobby;
$("pauseBack").onclick = backToLobby;
$("roomLeave").onclick = backToLobby;
function showOverlay({ kicker, title, description, actions = "none" }) {
  text("overlayKicker", kicker);
  text("overlayTitle", title);
  text("overlayDescription", description);
  $("arenaOverlay").hidden = false;
  $("arenaOverlay").dataset.kind = actions;
  $("roomActions").hidden = actions !== "room";
  $("resultActions").hidden = actions !== "result";
  $("pauseActions").hidden = actions !== "pause";
  $("roomSlots").hidden = actions !== "room";
  $("roomLeave").hidden = actions !== "room";
  $("resultSummary").hidden = actions !== "result";
}
function togglePause(force) {
  if (!playing || mode === "online" || state?.phase === "ended") return;
  paused = typeof force === "boolean" ? force : !paused;
  clearInput();
  accumulator = 0;
  if (paused)
    showOverlay({
      kicker: "TAKE A BREATH",
      title: "잠시, 숨을 고르세요.",
      description: "준비되면 대전을 이어갈 수 있어요.",
      actions: "pause",
    });
  else $("arenaOverlay").hidden = true;
}
$("pauseButton").onclick = () => togglePause();
$("resumeButton").onclick = () => togglePause(false);
$("rematchButton").onclick = () => {
  if (mode === "online") {
    if (send({ type: "rematch" })) {
      $("rematchButton").disabled = true;
      text("rematchButton", "상대의 재대결을 기다리는 중");
    }
  } else resetLocal();
};
$("trainingReset").onclick = resetLocal;
$("dummyToggle").onclick = () => {
  dummyGuard = !dummyGuard;
  text("dummyToggle", dummyGuard ? "더미: 가드" : "더미: 대기");
};
$("hitboxToggle").onclick = () => {
  debug = !debug;
  $("hitboxToggle").setAttribute("aria-pressed", String(debug));
  text("hitboxToggle", debug ? "판정 숨기기" : "판정 보기");
};
$("fullscreenButton").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await $("arena").requestFullscreen();
  } catch {
    notify(
      "이 브라우저는 전체 화면을 지원하지 않아요. 가로 화면으로 플레이해 주세요.",
    );
  }
};
let pausedForHelp = false;
for (const b of document.querySelectorAll("[data-help]"))
  b.onclick = () => {
    clearInput();
    pausedForHelp = playing && mode !== "online" && !paused;
    if (pausedForHelp) togglePause(true);
    $("helpDialog").showModal();
  };
$("closeHelp").onclick = () => $("helpDialog").close();
$("helpDialog").addEventListener("close", () => {
  if (pausedForHelp) togglePause(false);
  pausedForHelp = false;
});

function send(packet) {
  if (socket?.readyState !== WebSocket.OPEN || socket.bufferedAmount > 32768)
    return false;
  socket.send(JSON.stringify(packet));
  return true;
}
function roomUI() {
  if (!room) return;
  if (state && state.phase !== "ended") return;
  if (state?.phase === "ended") {
    const yours = roomPlayers[room.slot];
    if (yours?.rematch) {
      $("rematchButton").disabled = true;
      text("rematchButton", "상대의 재대결을 기다리는 중");
    }
    return;
  }
  $("roomSlots").replaceChildren();
  for (let i = 0; i < 2; i++) {
    const player = roomPlayers[i],
      slot = document.createElement("div");
    slot.className = "room-slot";
    slot.classList.toggle("ready", !!player?.ready);
    const name = document.createElement("strong"),
      detail = document.createElement("small"),
      number = document.createElement("span");
    number.className = "room-slot-number";
    number.textContent = `PLAYER 0${i + 1}`;
    name.textContent = player
      ? NAMES[player.char]
      : "상대 대기 중";
    detail.textContent = player
      ? `${i === room.slot ? "나 · " : ""}${!player.connected ? "연결 복구 중" : player.ready ? "준비 완료" : "준비 전"}`
      : "초대 링크를 보내 주세요";
    slot.append(number);
    if (player) {
      const portrait = document.createElement("img");
      portrait.className = "room-portrait";
      portrait.width = portrait.height = 256;
      portrait.decoding = "async";
      setPortrait(portrait, player.char);
      slot.append(portrait);
    }
    slot.append(name, detail);
    $("roomSlots").append(slot);
  }
  $("readyButton").disabled = !!roomPlayers[room.slot]?.ready;
  text(
    "readyButton",
    roomPlayers[room.slot]?.ready ? "준비 완료 ✓" : "준비 완료",
  );
  showOverlay({
    kicker: `ROOM / ${room.code}`,
    title:
      roomPlayers.filter(Boolean).length === 2
        ? "두 명의 파이터가 모였어."
        : "다음 도전자를 기다리는 중.",
    description: "두 사람이 준비를 완료하면 대전이 시작됩니다.",
    actions: "room",
  });
}
function applySnapshot(packet) {
  const incoming = packet.state;
  if (!incoming || !room) return;
  // Room notices have no input acknowledgements. Only a state packet may reconcile combat.
  // A lower tick within the same match is stale, never a reason to restart the sequence.
  if (
    authoritative &&
    incoming.seed === authoritative.seed &&
    incoming.tick < lastServerTick
  )
    return;
  lastServerAt = performance.now();
  const newMatch = !authoritative || incoming.seed !== authoritative.seed;
  if (newMatch) {
    pending = [];
    sequence = Math.max(0, packet.ack?.[room.slot] ?? 0);
    accumulator = 0;
    endingShown = false;
    drawPositions = [];
    audioSeen.clear();
    $("rematchButton").disabled = false;
    text("rematchButton", "다시 대전 →");
  }
  if (typeof packet.paused === "boolean") networkPaused = packet.paused;
  lastServerTick = incoming.tick;
  authoritative = incoming;
  const ack = packet.ack?.[room.slot] ?? -1;
  sequence = Math.max(sequence, ack);
  pending = pending.filter((p) => p.seq > ack).slice(-120);
  remoteInputs = packet.inputs || [0, 0];
  state = structuredClone(incoming);
  if (!networkPaused && state.phase !== "ended")
    for (const item of pending) {
      const masks = remoteInputs.slice();
      masks[room.slot] = item.mask;
      step(state, masks);
    }
  if (!networkPaused && incoming.phase !== "ended")
    $("arenaOverlay").hidden = true;
  if (incoming.phase !== "ended") endingShown = false;
}
function connect(packet, reconnecting = false) {
  const gen = ++generation;
  clearTimeout(reconnectTimer);
  clearTimeout(openTimer);
  clearInterval(pingTimer);
  if (socket) {
    socket.onclose = null;
    socket.close();
  }
  onlineBusy = true;
  updateAvailability();
  const ws = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/rebirth/ws`,
  );
  socket = ws;
  openTimer = setTimeout(() => {
    if (socket === ws && !room) {
      notify("서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      disconnect();
      updateAvailability();
    } else if (socket === ws) ws.close();
  }, 7000);
  ws.onopen = () => {
    if (generation !== gen) return ws.close();
    send(packet);
    lastServerAt = performance.now();
    pingTimer = setInterval(() => {
      if (socket !== ws) return;
      const now = performance.now();
      send({ type: "ping", stamp: now });
      if (room && now - lastServerAt > 4500) ws.close();
    }, 1000);
  };
  ws.onmessage = (event) => {
    if (generation !== gen) return;
    let msg;
    try {
      msg = JSON.parse(event.data);
    } catch {
      return;
    }
    lastServerAt = performance.now();
    if (msg.type === "joined") {
      clearTimeout(openTimer);
      onlineBusy = false;
      updateAvailability();
      reconnectDeadline = 0;
      room = { code: msg.code, token: msg.token, slot: msg.slot };
      roomPlayers = msg.players;
      storage.set("rebirth-room", JSON.stringify(room));
      // A restored room can already be paused. Wait for its first real ack before sending input.
      mode = "online";
      networkPaused = !!msg.paused;
      pending = [];
      remoteInputs = [0, 0];
      state = msg.state ? structuredClone(msg.state) : null;
      authoritative = null;
      lastServerTick = -1;
      endingShown = false;
      if (!reconnecting) sequence = 0;
      enterArena();
      roomUI();
    } else if (msg.type === "room") {
      if (!room || msg.code !== room.code) return;
      roomPlayers = msg.players;
      roomUI();
    } else if (msg.type === "state" && room) applySnapshot(msg);
    else if (msg.type === "pong")
      networkRtt = Math.max(0, Math.round(performance.now() - msg.stamp));
    else if (msg.type === "paused") {
      networkPaused = true;
      clearInput();
      pending = [];
      accumulator = 0;
      if (authoritative) state = structuredClone(authoritative);
      showOverlay({
        kicker: "CONNECTION",
        title: "연결을 기다리고 있어요.",
        description:
          msg.message || "상대가 30초 안에 돌아오면 대전을 이어갑니다.",
      });
    } else if (msg.type === "resumed") {
      networkPaused = false;
      pending = [];
      remoteInputs = [0, 0];
      accumulator = 0;
      if (authoritative) state = structuredClone(authoritative);
      if (state) $("arenaOverlay").hidden = true;
      else roomUI();
    } else if (msg.type === "error") {
      onlineBusy = false;
      updateAvailability();
      notify(msg.message);
      if (msg.fatal) backToLobby();
      else if (!room) {
        clearTimeout(openTimer);
        disconnect();
        updateAvailability();
      }
    }
  };
  ws.onclose = (event) => {
    if (generation !== gen) return;
    clearTimeout(openTimer);
    clearInterval(pingTimer);
    onlineBusy = false;
    updateAvailability();
    if (!room) {
      notify(
        "온라인 서버에 연결하지 못했어요. AI 대전과 훈련장은 바로 플레이할 수 있어요.",
      );
      return;
    }
    if (event.code === 4001) {
      backToLobby();
      notify("다른 창에서 이 플레이어로 접속했어요.");
      return;
    }
    networkPaused = true;
    clearInput();
    pending = [];
    reconnectDeadline ||= performance.now() + 29000;
    if (performance.now() > reconnectDeadline) {
      backToLobby();
      notify("재접속 시간이 지났어요. 새 대전방으로 입장해 주세요.");
      return;
    }
    showOverlay({
      kicker: "RECONNECTING",
      title: "연결을 복구하는 중.",
      description: "대전이 일시 정지됐어요. 연결되면 이어집니다.",
    });
    reconnectTimer = setTimeout(() => {
      if (room)
        connect({ type: "resume", code: room.code, token: room.token }, true);
    }, 900);
  };
  ws.onerror = () => {
    if (socket === ws) ws.close();
  };
}
$("createRoom").onclick = async () => {
  if (!onlineBusy && !startingBattle && await prepareBattle()) connect({ type: "create", char: selected });
};
$("joinForm").onsubmit = async (e) => {
  e.preventDefault();
  const code = $("roomCode").value.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code))
    return notify("방 코드 6자리를 입력해 주세요.");
  if (!onlineBusy && !startingBattle && await prepareBattle()) connect({ type: "join", code, char: selected });
};
$("readyButton").onclick = () => {
  if (send({ type: "ready" })) {
    $("readyButton").disabled = true;
    text("readyButton", "준비 중…");
  }
};
$("copyInvite").onclick = async () => {
  if (!room) return;
  const url = new URL(location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("room", room.code);
  try {
    await navigator.clipboard.writeText(url.href);
    notify("초대 링크를 복사했어요. 친구에게 보내 주세요.");
  } catch {
    window.prompt("이 초대 링크를 복사해 주세요.", url.href);
  }
};
const invited = new URL(location.href).searchParams.get("room");
if (/^[A-Z0-9]{6}$/i.test(invited || "")) {
  $("roomCode").value = invited.toUpperCase();
  chooseMode("online");
}

const p1Keys = {
  KeyA: INPUT.LEFT,
  KeyD: INPUT.RIGHT,
  KeyW: INPUT.JUMP,
  KeyS: INPUT.GUARD,
  KeyJ: INPUT.LIGHT,
  KeyK: INPUT.HEAVY,
  KeyL: INPUT.SKILL,
  Space: INPUT.DASH,
  KeyU: INPUT.ULT,
};
const p2Keys = {
  ArrowLeft: INPUT.LEFT,
  ArrowRight: INPUT.RIGHT,
  ArrowUp: INPUT.JUMP,
  ArrowDown: INPUT.GUARD,
  Numpad1: INPUT.LIGHT,
  Numpad2: INPUT.HEAVY,
  Numpad3: INPUT.SKILL,
  Numpad0: INPUT.DASH,
  Numpad5: INPUT.ULT,
  Digit7: INPUT.LIGHT,
  Digit8: INPUT.HEAVY,
  Digit9: INPUT.SKILL,
  Digit0: INPUT.DASH,
  Minus: INPUT.ULT,
};
window.addEventListener("keydown", (e) => {
  if (
    !playing ||
    $("helpDialog").open ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
  )
    return;
  if (e.code === "Escape") {
    e.preventDefault();
    togglePause();
    return;
  }
  const bit = p1Keys[e.code] || p2Keys[e.code];
  if (!bit) return;
  e.preventDefault();
  if (paused || networkPaused) return;
  const player = mode === "local" && !p1Keys[e.code] ? 1 : room?.slot || 0;
  source(`key:${e.code}`, player, bit);
});
window.addEventListener("keyup", (e) => {
  source(`key:${e.code}`, 0, 0);
});
window.addEventListener("blur", () => {
  clearInput();
  if (playing && mode !== "online") togglePause(true);
});
document.addEventListener("visibilitychange", () => {
  clearInput();
  if (document.hidden && playing && mode !== "online") togglePause(true);
  accumulator = 0;
  lastTime = performance.now();
  frameCount = 0;
  fpsTime = lastTime;
  if (document.hidden) {
    cancelAnimationFrame(frameRequest);
    frameRequest = null;
  } else {
    requestFrame();
    scheduleBattlePreload();
  }
});
for (const button of document.querySelectorAll("[data-input]")) {
  const release = (e) => {
    source(`touch:${e.pointerId}`, 0, 0);
    button.classList.remove("held");
  };
  button.onpointerdown = (e) => {
    e.preventDefault();
    if (!playing || paused || networkPaused || !$("arenaOverlay").hidden)
      return;
    button.setPointerCapture(e.pointerId);
    source(
      `touch:${e.pointerId}`,
      room?.slot || 0,
      INPUT[button.dataset.input],
    );
    button.classList.add("held");
  };
  button.onpointerup = release;
  button.onpointercancel = release;
  button.onlostpointercapture = release;
}
let joystickPointer = null;
const stick = $("joystick");
function moveStick(e) {
  if (e.pointerId !== joystickPointer) return;
  const rect = stick.getBoundingClientRect();
  let x = e.clientX - rect.left - rect.width / 2,
    y = e.clientY - rect.top - rect.height / 2;
  const length = Math.hypot(x, y),
    radius = rect.width * 0.32;
  if (length > radius) {
    x *= radius / length;
    y *= radius / length;
  }
  $("joystickKnob").style.transform = `translate(${x}px,${y}px)`;
  source(
    "joystick",
    room?.slot || 0,
    Math.abs(x) > 12 ? (x < 0 ? INPUT.LEFT : INPUT.RIGHT) : 0,
  );
}
stick.onpointerdown = (e) => {
  e.preventDefault();
  if (
    joystickPointer !== null ||
    !playing ||
    paused ||
    networkPaused ||
    !$("arenaOverlay").hidden
  )
    return;
  joystickPointer = e.pointerId;
  stick.setPointerCapture(e.pointerId);
  moveStick(e);
};
stick.onpointermove = moveStick;
function releaseStick(e) {
  if (e.pointerId !== joystickPointer) return;
  joystickPointer = null;
  source("joystick", 0, 0);
  $("joystickKnob").style.transform = "";
}
stick.onpointerup = releaseStick;
stick.onpointercancel = releaseStick;
stick.onlostpointercapture = releaseStick;

function simulate() {
  if (
    !state ||
    paused ||
    networkPaused ||
    !playing ||
    state.phase === "ended" ||
    (mode === "online" && socket?.readyState !== WebSocket.OPEN)
  )
    return;
  let masks;
  if (mode === "online") {
    if (!authoritative) return;
    const mask = input(room.slot),
      seq = ++sequence;
    masks = remoteInputs.slice();
    masks[room.slot] = mask;
    if (!send({ type: "input", seq, mask })) return;
    pending.push({ seq, mask });
    if (pending.length > 120) {
      pending = [];
      socket.close();
      return;
    }
  } else
    masks = [
      input(0),
      mode === "local"
        ? input(1)
        : mode === "training"
          ? dummyGuard
            ? INPUT.GUARD
            : 0
          : aiInput(state, 1, $("difficulty").value),
    ];
  step(state, masks);
  hearEvents(state);
}
const touchHud = {
  ult: document.querySelector(".touch-ultimate"),
  light: document.querySelector('[data-input="LIGHT"]'),
  heavy: document.querySelector('[data-input="HEAVY"]'),
  skill: document.querySelector('[data-input="SKILL"]'),
};
const hudSides = [$("meter0").closest(".hud-side"), $("meter1").closest(".hud-side")];
const empowerPips = [0, 1].map(i => Array.from($("empower" + i).querySelectorAll(".empower-pips i")));
const cooldownSeconds = (frames) => `${(Math.ceil(Math.max(0, frames || 0) / 6) / 10).toFixed(1)}초`;
function updateCombatStatus(p, i) {
  const status = {
    shield: p.shield ? `보호막 ${Math.ceil(p.shield.hp)}` : null,
    slow: p.slow ? `둔화 ${cooldownSeconds(p.slow.remaining)}` : null,
    haste: p.haste ? `가속 ${cooldownSeconds(p.haste.remaining)}` : null,
    followup: p.recast?.action === "heavyFollow" ? `후속타 ${cooldownSeconds(p.recast.remaining)}` : null,
    bike: p.bike ? (p.actionFrame >= 58 ? "바이크 발사 준비" : "바이크 출발") : null,
    suppressed: p.suppressed ? `제압 ${cooldownSeconds(p.suppressed.remaining)}` : null,
    duel: p.duel ? `대치 ${cooldownSeconds(p.duel.remaining)}` : null,
    exposed: p.exposed ? `취약 ${cooldownSeconds(p.exposed.remaining)}` : null,
  };
  for (const [kind, value] of Object.entries(status)) {
    const node = $(`${kind}State${i}`);
    hidden(node, !value);
    if (value) text(node.id, value);
  }
  hidden($("combatState" + i), !Object.values(status).some(Boolean));
}
function updateEmpowerStatus(p, i) {
  const active = p.empower?.type === "acheron";
  const finishing = p.char === "acheron" && p.action === "finisher";
  const panel = $("empower" + i);
  hidden(panel, !active && !finishing);
  if (panel.hidden) return;
  const charges = Math.max(0, p.empower?.charges || 0);
  const pending = finishing || (p.empower?.finisherPending && charges === 0);
  classState(panel, "finisher", pending);
  text("empowerLabel" + i, pending ? "황천의 귀환" : "눈물 베기");
  text("empowerCount" + i, pending ? "연계 중" : `${charges} / 3`);
  empowerPips[i].forEach((pip, n) => classState(pip, "available", n < charges));
}
function updateHUD(s) {
  hidden($("hud"), !s);
  if (!s) return;
  const slot = room?.slot || 0;
  const key = `${s.tick}:${paused}:${networkPaused}:${mode}:${slot}`;
  if (s === lastHudState && key === lastHudKey) return;
  lastHudState = s;
  lastHudKey = key;
  for (let i = 0; i < 2; i++) {
    const p = s.players[i];
    text(`name${i}`, NAMES[p.char]);
    text(
      `role${i}`,
      mode === "local"
        ? `PLAYER ${i + 1}`
        : i === slot
          ? "YOU"
          : mode === "ai"
            ? "CPU"
            : mode === "training"
              ? "DUMMY"
              : "OPPONENT",
    );
    width($("health" + i), `${Math.max(0, p.hp / p.maxHp) * 100}%`);
    text("hp" + i, Math.ceil(p.hp));
    width($("meter" + i), `${Math.min(100, p.meter)}%`);
    const ultimateReady = p.meter >= 100 && !(p.cooldowns?.ultimate > 0) && !p.empower;
    classState(hudSides[i], "ultimate-ready", ultimateReady);
    text(
      "status" + i,
      p.mount ? "◆ MOUNTED"
        : p.bike ? "◆ RECKLESS BIKE"
        : p.empower ? "◆ EMPOWERED"
        : ultimateReady ? "◆ ULTIMATE READY"
        : p.cooldowns?.ultimate > 0 ? `U · ${cooldownSeconds(p.cooldowns.ultimate)}`
        : TITLES[p.char],
    );
    updateCombatStatus(p, i);
    updateEmpowerStatus(p, i);
    const mount = $("mount" + i);
    hidden(mount, !p.mount);
    if (p.mount) {
      const remaining = Math.max(0, p.mount.remaining);
      const cooldown = Math.max(0, p.mount.chargeCooldown);
      if (mount.dataset.mount !== p.mount.type) mount.dataset.mount = p.mount.type;
      classState(mount, "charge-ready", cooldown === 0 && p.y === 0);
      text("mountName" + i, p.mount.type === "pegasus" ? "PEGASUS" : "BUCEPHALUS");
      text("mountTime" + i, `${(Math.ceil(remaining / 6) / 10).toFixed(1)}초`);
      width($("mountBar" + i), `${Math.min(100, remaining / Math.max(1, p.mount.duration) * 100)}%`);
      text(
        "mountCharge" + i,
        cooldown > 0
          ? `L / U · 돌진 ${(Math.ceil(cooldown / 6) / 10).toFixed(1)}초`
          : p.y > 0
            ? "L / U · 착지 후 돌진"
            : "L / U · 돌진 준비",
      );
    }
    text(
      "wins" + i,
      Array.from({ length: 2 }, (_, n) => (n < s.score[i] ? "◆" : "◇")).join(
        " ",
      ),
    );
  }
  text(
    "timer",
    s.training ? "∞" : String(Math.ceil(s.timer / 60)).padStart(2, "0"),
  );
  text("roundLabel", "ROUND " + String(s.round).padStart(2, "0"));
  const player = s.players[slot];
  const ult = touchHud.ult;
  const skill = touchHud.skill;
  const heavy = touchHud.heavy;
  const light = touchHud.light;
  const empowered = player.empower?.type === "acheron";
  const dueling = !!player.duel;
  const finishing = player.char === "acheron" && player.action === "finisher";
  const mounted = !!player.mount;
  const chargeReady = mounted && player.mount.chargeCooldown === 0 && player.y === 0;
  const followup = player.recast?.action === "heavyFollow";
  const bikeReady = !!player.bike && player.actionFrame >= 58;
  const heavyCooldown = followup ? 0 : player.cooldowns?.heavy || 0;
  const skillCooldown = player.cooldowns?.skill || 0;
  const ultimateCooldown = player.cooldowns?.ultimate || 0;
  classState(ult, "ready", mounted ? chargeReady : player.bike ? bikeReady : player.meter >= 100 && !ultimateCooldown && !empowered);
  classState(ult, "mounted", mounted);
  classState(ult, "empowered", empowered);
  classState(light, "empowered", empowered || finishing);
  classState(light, "dueling", dueling);
  classState(skill, "dueling", dueling);
  text("touchLightLabel", empowered ? player.empower.charges > 0 ? "눈물 베기" : "마무리" : finishing ? "마무리" : dueling ? "패닝" : player.char === "boothill" ? "사격" : "약공격");
  text("touchLightHint", empowered ? player.empower.charges > 0 ? `J · ${player.empower.charges}회` : "자동 연계" : finishing ? "자동 연계" : dueling ? "J · 3연발" : "J");
  classState(ult, "cooling", !mounted && !player.bike && ultimateCooldown > 0);
  classState(skill, "charge-ready", chargeReady);
  classState(skill, "mounted", mounted);
  classState(skill, "cooling", !mounted && skillCooldown > 0);
  classState(heavy, "followup-ready", followup);
  classState(heavy, "cooling", heavyCooldown > 0);
  text("touchHeavyLabel", player.char === "katja" ? "조준 사격" : player.char === "ambessa" ? followup ? "내려치기" : "휩쓸기" : player.char === "boothill" ? "발차기" : player.char === "acheron" ? "발도" : "강공격");
  text("touchHeavyHint", followup ? `K · 2타 ${cooldownSeconds(player.recast.remaining)}` : heavyCooldown ? `K · ${cooldownSeconds(heavyCooldown)}` : "K");
  text("touchSkillLabel", mounted ? "돌진" : dueling ? "대치 중" : player.char === "boothill" ? "대치" : "스킬");
  text("touchUltimateLabel", mounted ? "돌진" : player.bike ? "바이크 발사" : empowered ? player.empower.charges > 0 ? "강화 중" : "마무리" : "궁극기");
  const chargeHint = mounted
    ? player.mount.chargeCooldown > 0
      ? cooldownSeconds(player.mount.chargeCooldown)
      : player.y > 0 ? "착지 후" : "준비"
    : "";
  text("touchSkillHint", mounted ? `L · ${chargeHint}` : dueling ? `L · ${cooldownSeconds(player.duel.remaining)}` : skillCooldown ? `L · ${cooldownSeconds(skillCooldown)}` : "L");
  text("touchUltimateHint", mounted ? `U · ${chargeHint}` : player.bike ? bikeReady ? "U · 발사 준비" : "U · 출발 중" : empowered ? player.empower.charges > 0 ? "J로 사용" : "자동 연계" : ultimateCooldown ? `U · ${cooldownSeconds(ultimateCooldown)}` : "U · 100%");
  if (mode !== "local")
    text(
      "controlHint",
      mounted
        ? "탑승 중 · L / U 돌진 · J / K 공격 · 이동·가드·회피 가능"
        : empowered ? player.empower.charges > 0 ? `J 눈물 베기 ${player.empower.charges}회 · 마지막에 황천의 귀환` : "황천의 귀환 · 자동 마무리 연계"
        : followup ? `K · 후속타 전방 내려치기 ${cooldownSeconds(player.recast.remaining)}`
        : player.bike ? "바이크 주행 중 · U 재입력으로 발사"
        : dueling ? `대치 ${cooldownSeconds(player.duel.remaining)} · J 리볼버 패닝 · 서로 받는 피해 증가`
        : "A D 이동 · W 점프 · S 가드 · SPACE 회피",
    );
  const shown = mode === "online" && authoritative ? authoritative : s;
  hidden($("phaseBanner"), !["countdown", "roundover"].includes(shown.phase) || networkPaused || paused);
  if (shown.phase === "countdown") {
    text("phaseEyebrow", `ROUND ${shown.round}`);
    text(
      "phaseText",
      shown.phaseFrame < 120
        ? Math.ceil((120 - shown.phaseFrame) / 40)
        : "FIGHT",
    );
  }
  if (shown.phase === "roundover") {
    text("phaseEyebrow", `ROUND ${shown.round} COMPLETE`);
    text(
      "phaseText",
      shown.winner === null
        ? "DRAW"
        : `${NAMES[shown.players[shown.winner].char]} WINS`,
    );
  }
  if (shown.phase === "ended" && !endingShown) {
    endingShown = true;
    clearInput();
    const won = shown.winner === slot;
    for (let i = 0; i < 2; i++) {
      text(`resultName${i}`, NAMES[shown.players[i].char]);
      text(`resultScore${i}`, shown.score[i]);
    }
    showOverlay({
      kicker: "DUEL COMPLETE",
      title:
        mode === "local"
          ? `PLAYER ${shown.winner + 1} WINS`
          : won
            ? "VICTORY"
            : "DEFEAT",
      description: won ? "당신의 한 수가 대전을 마무리했어요." : "다음 대전에서는 다른 수를 노려 보세요.",
      actions: "result",
    });
  }
  if (s.training) {
    const p = s.players[0],
      m = getMove(p);
    const timing = m
      ? `${p.actionFrame < m.startup ? "준비" : p.actionFrame < m.startup + m.active ? "판정" : "후딜"} ${Math.max(0, p.actionFrame)}F`
      : "대기";
    text("trainingReadout", `누적 ${p.damageDealt || 0} · ${timing}`);
  }
}
function requestFrame() {
  if (frameRequest === null && playing && !document.hidden)
    frameRequest = requestAnimationFrame(frame);
}
function frame(now) {
  frameRequest = null;
  if (document.hidden || !playing) {
    accumulator = 0;
    lastTime = now;
    return;
  }
  const elapsed = Math.min(100, Math.max(0, now - lastTime));
  lastTime = now;
  if (!paused && !networkPaused) {
    accumulator += elapsed;
    let ticks = 0;
    while (accumulator >= STEP && ticks++ < 6) {
      simulate();
      accumulator -= STEP;
    }
  } else accumulator = 0;
  if (loaded) {
    if (!state) {
      const chars = [roomPlayers[0]?.char || selected, roomPlayers[1]?.char || "archer"];
      const key = chars.join(":");
      if (!waitingView || waitingViewKey !== key) {
        waitingView = createMatch({ chars });
        waitingViewKey = key;
      }
    }
    const viewState = state || waitingView;
    const frozen = paused || networkPaused || !state || state.phase === "ended";
    if (!frozen || lastRenderedState !== viewState || lastRenderedTick !== viewState.tick || lastRenderedDebug !== debug) {
      const display = {
        ...viewState,
        players: viewState.players.map((p, i) => {
          const old = drawPositions[i];
          const ease = i === (room?.slot || 0) ? 0.85 : 0.65;
          const x = !old || old.char !== p.char || Math.abs(old.x - p.x) > 100
            ? p.x : old.x + (p.x - old.x) * ease;
          drawPositions[i] = { x, char: p.char };
          return { ...p, x };
        }),
      };
      renderer.draw(display, { time: now / 1000, localSlot: room?.slot || 0, debug });
      lastRenderedState = viewState;
      lastRenderedTick = viewState.tick;
      lastRenderedDebug = debug;
    }
    updateHUD(state);
    text("networkStatus", mode === "online"
      ? networkPaused ? "RECONNECTING" : `${networkRtt} ms · ONLINE`
      : mode === "training" ? "TRAINING · LOCAL" : "OFFLINE · LOCAL");
  }
  frameCount++;
  if (now - fpsTime >= 1000) {
    fps = Math.round((frameCount * 1000) / (now - fpsTime));
    frameCount = 0;
    fpsTime = now;
    text("frameStatus", fps + " FPS");
  }
  requestFrame();
}

chooseCharacter(selected);
chooseMode(mode);
updateAvailability();
scheduleBattlePreload();
async function restoreSavedRoom() {
  const savedText = storage.get("rebirth-room");
  if (!savedText) return;
  let saved;
  try {
    saved = JSON.parse(savedText);
  } catch {
    storage.remove("rebirth-room");
    return;
  }
  if (!saved?.code || !saved?.token || (invited && invited.toUpperCase() !== saved.code)) return;
  if (!(await prepareBattle())) return;
  room = saved;
  mode = "online";
  enterArena();
  showOverlay({
    kicker: "RECONNECTING",
    title: "대전방으로 돌아가는 중.",
    description: "이전 대전 연결을 확인하고 있어요.",
  });
  connect({ type: "resume", code: saved.code, token: saved.token }, true);
}
restoreSavedRoom();

// Read-only diagnostics support repeatable browser smoke checks without adding debug controls to the game.
Object.defineProperty(window, "rebirthStatus", {
  get: () => ({
    build: BUILD_VERSION,
    fighterCount: Object.keys(characters).length,
    loaded,
    loadingBattle,
    selected,
    portraitsReady: [...document.querySelectorAll(".fighter-portrait")].every(image => image.complete && image.naturalWidth > 0),
    mode,
    playing,
    paused,
    networkPaused,
    room: room ? { code: room.code, slot: room.slot } : null,
    state: state ? structuredClone(state) : null,
    serverTick: lastServerTick,
    pendingInputs: pending.length,
    fps,
  }),
});
