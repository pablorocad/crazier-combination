// ===== Word lists — edit these to change the game =====
// sx / sy: how wide / how tall the animal is drawn (1 = fills the stage)
const SIZES = [
  { word: 'tiny',  sx: 0.28, sy: 0.28 },
  { word: 'small', sx: 0.48, sy: 0.48 },
  { word: 'big',   sx: 0.82, sy: 0.82 },
  { word: 'huge',  sx: 1.02, sy: 1.02 },
  { word: 'long',  sx: 1.3,  sy: 0.5 },
  { word: 'tall',  sx: 0.5,  sy: 1.05 },
  { word: 'short', sx: 0.8,  sy: 0.36 },
];

const COLORS = [
  { word: 'red',    hex: '#E53935' },
  { word: 'blue',   hex: '#1E6FE8' },
  { word: 'green',  hex: '#2DB24A' },
  { word: 'yellow', hex: '#FFD000' },
  { word: 'orange', hex: '#FF8A00' },
  { word: 'pink',   hex: '#FF6FB5' },
  { word: 'purple', hex: '#8E44EC' },
  { word: 'brown',  hex: '#8B5A2B' },
  { word: 'black',  hex: '#2A2A2A' },
  { word: 'white',  hex: '#FFFFFF' },
  { word: 'gray',   hex: '#9AA3AD' },
];

const ANIMALS = [
  { word: 'dog',      emoji: '🐕' },
  { word: 'cat',      emoji: '🐈' },
  { word: 'fish',     emoji: '🐟' },
  { word: 'bird',     emoji: '🐦' },
  { word: 'duck',     emoji: '🦆' },
  { word: 'chicken',  emoji: '🐔' },
  { word: 'cow',      emoji: '🐄' },
  { word: 'pig',      emoji: '🐖' },
  { word: 'horse',    emoji: '🐎' },
  { word: 'sheep',    emoji: '🐑' },
  { word: 'rabbit',   emoji: '🐇' },
  { word: 'mouse',    emoji: '🐁' },
  { word: 'frog',     emoji: '🐸' },
  { word: 'turtle',   emoji: '🐢' },
  { word: 'snake',    emoji: '🐍' },
  { word: 'lion',     emoji: '🦁' },
  { word: 'tiger',    emoji: '🐅' },
  { word: 'bear',     emoji: '🐻' },
  { word: 'monkey',   emoji: '🐒' },
  { word: 'elephant', emoji: '🐘' },
  { word: 'giraffe',  emoji: '🦒' },
  { word: 'zebra',    emoji: '🦓' },
  { word: 'penguin',  emoji: '🐧' },
  { word: 'owl',      emoji: '🦉' },
  { word: 'whale',    emoji: '🐋' },
  { word: 'octopus',  emoji: '🐙' },
];

const HINTS = {
  sentence: 'Press Spin! for a crazy sentence, then the whole class says it together.',
  words: 'Three students, three turns: one spins the size, one the color, one the animal. Use ‹ › to choose a word instead.',
};

// ===== Setup =====
const SLOTS = { size: SIZES, color: COLORS, animal: ANIMALS };
const ORDER = ['size', 'color', 'animal'];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Starts on the example sentence: "I see a big blue dog."
const state = { mode: 'sentence', size: 2, color: 1, animal: 0, spinning: false };
const history = [];

const $ = (id) => document.getElementById(id);
const els = {
  app: $('app'),
  article: $('article'),
  modeButtons: document.querySelectorAll('.mode'),
  spinAll: $('spin-all'),
  newRound: $('new-round'),
  speak: $('speak'),
  autoSpeak: $('auto-speak'),
  autoLabel: $('auto-label'),
  hint: $('hint'),
  stage: $('stage'),
  animalPos: $('animal-pos'),
  animal: $('animal'),
  mystery: $('mystery'),
  historyList: $('history-list'),
  historyEmpty: $('history-empty'),
};

const slotEls = {};
ORDER.forEach((slot) => {
  const root = document.querySelector(`.slot[data-slot="${slot}"]`);
  slotEls[slot] = {
    window: root.querySelector('.window'),
    word: root.querySelector('.word'),
    swatch: root.querySelector('.swatch'),
    spin: root.querySelector('.slot-spin'),
    nudges: root.querySelectorAll('.nudge'),
  };
});

// ===== Helpers =====
function articleFor(sizeIdx) {
  if (sizeIdx === null) return 'a';
  return /^[aeiou]/i.test(SIZES[sizeIdx].word) ? 'an' : 'a';
}

function isComplete(s = state) {
  return ORDER.every((slot) => s[slot] !== null);
}

function sentenceFor(s) {
  return `I see ${articleFor(s.size)} ${SIZES[s.size].word} ${COLORS[s.color].word} ${ANIMALS[s.animal].word}.`;
}

function randomOther(length, current) {
  if (length < 2) return 0;
  let i;
  do { i = Math.floor(Math.random() * length); } while (i === current);
  return i;
}

function restartAnimation(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

// ===== Speech =====
const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
let voice = null;

function pickVoice() {
  const voices = synth.getVoices();
  voice =
    voices.find((v) => /^en[-_]US/i.test(v.lang) && /aria|jenny|zira|samantha|google us/i.test(v.name)) ||
    voices.find((v) => /^en[-_]US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    null;
}

function say(text, interrupt = false) {
  if (!synth) return;
  if (interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  if (voice) u.voice = voice;
  u.rate = 0.85;
  u.onstart = () => els.speak.classList.add('talking');
  u.onend = u.onerror = () => { if (!synth.speaking) els.speak.classList.remove('talking'); };
  synth.speak(u);
}

function stopSpeech() {
  if (synth) synth.cancel();
  els.speak.classList.remove('talking');
}

// ===== Rendering =====
function paintAnimal(el, s) {
  const emoji = s.animal !== null ? ANIMALS[s.animal].emoji : '';
  el.querySelectorAll('.glyph').forEach((g) => { g.textContent = emoji; });
  if (s.color !== null) {
    el.style.setProperty('--tint', COLORS[s.color].hex);
    el.classList.remove('no-tint');
  } else {
    el.classList.add('no-tint');
  }
}

function showWord(slot, idx) {
  const { word, swatch } = slotEls[slot];
  const item = idx === null ? null : SLOTS[slot][idx];
  word.textContent = item ? item.word : '?';
  word.classList.toggle('empty', !item);
  if (swatch) {
    swatch.style.setProperty('--tint', item ? item.hex : 'transparent');
    swatch.classList.toggle('empty', !item);
  }
  if (slot === 'size') els.article.textContent = articleFor(idx);
}

function renderReels() {
  ORDER.forEach((slot) => showWord(slot, state[slot]));
}

function renderStage({ hide = false, effect = null } = {}) {
  const visible = !hide && state.animal !== null;
  els.mystery.hidden = visible;
  els.animalPos.hidden = !visible;
  if (!visible) {
    els.stage.setAttribute('aria-label', 'A mystery animal');
    return;
  }
  paintAnimal(els.animal, state);
  const size = state.size !== null ? SIZES[state.size] : { sx: 0.6, sy: 0.6 };
  els.animal.style.setProperty('--sx', size.sx);
  els.animal.style.setProperty('--sy', size.sy);
  const words = ORDER.map((slot) => (state[slot] !== null ? SLOTS[slot][state[slot]].word : '')).filter(Boolean);
  els.stage.setAttribute('aria-label', `${articleFor(state.size)} ${words.join(' ')}`);
  if (effect) restartAnimation(els.animalPos, effect);
}

function renderControls() {
  const words = state.mode === 'words';
  const busy = state.spinning;
  els.spinAll.hidden = words;
  els.newRound.hidden = !words;
  els.spinAll.disabled = busy;
  els.newRound.disabled = busy;
  ORDER.forEach((slot) => {
    const e = slotEls[slot];
    e.spin.hidden = !words;
    e.spin.disabled = busy;
    e.nudges.forEach((n) => { n.hidden = !words; n.disabled = busy; });
  });
  els.speak.disabled = busy || !isComplete();
  els.hint.textContent = HINTS[state.mode];
}

function renderHistory() {
  els.historyList.replaceChildren(...history.map((entry) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'history-item';
    btn.innerHTML =
      '<span class="animal" aria-hidden="true"><span class="glyph base"></span><span class="glyph tint"></span></span><span class="text"></span>';
    paintAnimal(btn.querySelector('.animal'), entry);
    btn.querySelector('.text').textContent = sentenceFor(entry);
    btn.addEventListener('click', () => restore(entry));
    li.append(btn);
    return li;
  }));
  els.historyEmpty.hidden = history.length > 0;
}

function addHistory() {
  if (!isComplete()) return;
  const entry = { size: state.size, color: state.color, animal: state.animal };
  const last = history[0];
  if (last && ORDER.every((slot) => last[slot] === entry[slot])) return;
  history.unshift(entry);
  if (history.length > 12) history.pop();
  renderHistory();
}

// Keep each reel as wide as its longest word, so nothing jumps while spinning
function fitReels() {
  ORDER.forEach((slot) => {
    const win = slotEls[slot].window;
    const probe = document.createElement('span');
    probe.className = 'word';
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
    win.append(probe);
    let max = 0;
    SLOTS[slot].forEach((item) => {
      probe.textContent = item.word;
      max = Math.max(max, probe.getBoundingClientRect().width);
    });
    probe.remove();
    const fontSize = parseFloat(getComputedStyle(win).fontSize);
    win.style.setProperty('--w', `${(max / fontSize + 0.15).toFixed(2)}em`);
  });
}

// ===== Spinning =====
function spinReel(slot, duration) {
  return new Promise((resolve) => {
    const list = SLOTS[slot];
    const e = slotEls[slot];
    const finalIdx = randomOther(list.length, state[slot]);

    if (reduceMotion || duration === 0) {
      showWord(slot, finalIdx);
      resolve(finalIdx);
      return;
    }

    e.window.classList.remove('land');
    e.window.classList.add('spinning');
    const start = performance.now();
    let shown = state[slot];

    const tick = () => {
      const elapsed = performance.now() - start;
      if (elapsed >= duration) {
        showWord(slot, finalIdx);
        e.window.classList.remove('spinning');
        restartAnimation(e.window, 'land');
        resolve(finalIdx);
        return;
      }
      shown = randomOther(list.length, shown);
      showWord(slot, shown);
      restartAnimation(e.word, 'roll');
      const p = elapsed / duration;
      setTimeout(tick, 50 + 230 * p * p); // slows down near the end
    };
    tick();
  });
}

function finishSentence() {
  addHistory();
  if (els.autoSpeak.checked) say(sentenceFor(state));
}

async function spinAll() {
  if (state.spinning) return;
  stopSpeech();
  state.spinning = true;
  renderControls();
  els.stage.classList.add('spinning');
  renderStage({ hide: true });

  const durations = [900, 1500, 2100];
  await Promise.all(ORDER.map((slot, i) =>
    spinReel(slot, durations[i]).then((idx) => { state[slot] = idx; })
  ));

  state.spinning = false;
  els.stage.classList.remove('spinning');
  renderStage({ effect: 'pop' });
  renderControls();
  finishSentence();
}

async function spinOne(slot) {
  if (state.spinning) return;
  state.spinning = true;
  renderControls();

  const idx = await spinReel(slot, 1200);
  state[slot] = idx;
  state.spinning = false;

  renderStage({ effect: slot === 'animal' ? 'pop' : 'wiggle' });
  renderControls();
  if (els.autoSpeak.checked) say(SLOTS[slot][idx].word, true);
  if (isComplete()) finishSentence();
}

function nudge(slot, dir) {
  if (state.spinning) return;
  const length = SLOTS[slot].length;
  const current = state[slot];
  const idx = current === null ? (dir > 0 ? 0 : length - 1) : (current + dir + length) % length;
  state[slot] = idx;
  showWord(slot, idx);
  restartAnimation(slotEls[slot].window, 'land');
  renderStage({ effect: slot === 'animal' && current === null ? 'pop' : null });
  renderControls();
  if (els.autoSpeak.checked) say(SLOTS[slot][idx].word, true);
}

function newRound() {
  stopSpeech();
  ORDER.forEach((slot) => { state[slot] = null; });
  renderReels();
  renderStage();
  renderControls();
}

function restore(entry) {
  if (state.spinning) return;
  ORDER.forEach((slot) => { state[slot] = entry[slot]; });
  renderReels();
  renderStage({ effect: 'pop' });
  renderControls();
  say(sentenceFor(entry), true);
}

function setMode(mode) {
  if (state.spinning || mode === state.mode) return;
  state.mode = mode;
  els.app.dataset.mode = mode;
  els.modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  if (mode === 'words') {
    newRound();
  } else {
    ORDER.forEach((slot) => {
      if (state[slot] === null) state[slot] = randomOther(SLOTS[slot].length, null);
    });
    renderReels();
    renderStage({ effect: 'pop' });
    renderControls();
  }
}

// ===== Events =====
els.modeButtons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
els.spinAll.addEventListener('click', spinAll);
els.newRound.addEventListener('click', newRound);
els.speak.addEventListener('click', () => {
  if (!isComplete()) return;
  addHistory();
  say(sentenceFor(state), true);
});
ORDER.forEach((slot) => {
  slotEls[slot].spin.addEventListener('click', () => spinOne(slot));
  slotEls[slot].nudges.forEach((n) => n.addEventListener('click', () => nudge(slot, Number(n.dataset.dir))));
});

// ===== Start =====
if (synth) {
  pickVoice();
  synth.onvoiceschanged = pickVoice;
} else {
  els.speak.hidden = true;
  els.autoLabel.hidden = true;
}

renderReels();
renderStage();
renderControls();
addHistory();
fitReels();
if (document.fonts) document.fonts.ready.then(fitReels);
