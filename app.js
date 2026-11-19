'use strict';

const STORE_KEY = 'nauka-sw-v1';
const BOX_DAYS = [0, 0, 1, 3, 7, 14]; // po ilu dniach karta wraca; indeks = pudełko 1–5
const MASTERED_BOX = 4;               // „opanowana” = pudełko 4 lub 5
const FLASH_SESSION = 20;
const SIZES = [30, 40, 50];          // do wyboru w Teście i Egzaminie próbnym
const MINUTES_PER_QUESTION = 1;       // limit czasu egzaminu: 1 minuta na pytanie
const examSize = () => (SIZES.includes(state.settings.examSize) ? state.settings.examSize : 30);
const examMinutes = () => examSize() * MINUTES_PER_QUESTION;
const testSize = () => (SIZES.includes(state.settings.testSize) || state.settings.testSize === 0 ? state.settings.testSize : 30);
const DOCS = [
  { file: 'skrypt_unitarna.md', name: 'Część unitarna' },
  { file: 'skrypt_psycholog.md', name: 'Psycholog' },
  { file: 'instrukcje_stanowiskowe.md', name: 'Stanowiska' },
  { file: 'glock17.md', name: 'GLOCK 17' },
  { file: 'skrypt_penitencjarny.md', name: 'Penitencjarny' },
];

const $app = document.getElementById('app');
const $title = document.getElementById('title');
const $back = document.getElementById('back');
const $timer = document.getElementById('timer');

let DATA = null;
let deckById = {};
let docs = [];
let state;
let storageOk = true;
let exam = null;
let timerId = null;
let currentRoute = '';

/* ---------- Pamięć (localStorage) ---------- */

function defaultState() {
  return {
    boxes: {},   // id -> { box: 1–5, due: znacznik czasu }
    hist: {},    // id -> { last: 'ok'|'almost'|'bad', n, bad, ts }
    settings: { decks: null, onlyMem: false, examDecks: null, doc: 0, readPos: {} },
    exams: [],
  };
}

function loadState() {
  const s = defaultState();
  let raw = null;
  try {
    raw = localStorage.getItem(STORE_KEY);
    localStorage.setItem(STORE_KEY + '-test', '1');
    localStorage.removeItem(STORE_KEY + '-test');
  } catch (e) {
    storageOk = false;
  }
  if (raw) {
    try {
      const p = JSON.parse(raw);
      Object.assign(s, p);
      s.settings = { ...defaultState().settings, ...(p.settings || {}) };
    } catch (e) { /* uszkodzony zapis – zaczynamy od nowa */ }
  }
  return s;
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    storageOk = false;
  }
  document.getElementById('storage-warning').hidden = storageOk;
}

/* ---------- Narzędzia ---------- */

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}

function btn(label, cls, onclick, extra) {
  return h('button', { type: 'button', class: 'btn ' + (cls || ''), onclick, ...extra }, label);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const norm = s => s.toLocaleLowerCase('pl').replace(/\s+/g, ' ').trim();
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const mmss = ms => {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

function dueAfter(days) {
  if (!days) return Date.now();
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

function screen(title, back) {
  if (typeof closeGapMenu === 'function') closeGapMenu();
  $title.textContent = title;
  $back.hidden = !back;
  $app.replaceChildren();
  window.scrollTo(0, 0);
  return $app;
}

function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

/* ---------- Dane i filtry ---------- */

function selectedDecks() {
  return state.settings.decks || DATA.decks.map(d => d.id);
}

function pool(types, opts = {}) {
  const decks = new Set(opts.decks || selectedDecks());
  return pickVariants(DATA.items.filter(it =>
    types.includes(it.type) && decks.has(it.deck) &&
    (opts.ignoreMem || !state.settings.onlyMem || it.naPamiec)));
}

// Pytania z tym samym polem „grupa” to różne formy tej samej treści – losujemy jedną.
function pickVariants(list, rnd = Math.random) {
  const chosen = {};
  for (const it of list) {
    if (!it.grupa) continue;
    const c = chosen[it.grupa] || (chosen[it.grupa] = { n: 0, it: null });
    c.n++;
    if (rnd() * c.n < 1) c.it = it; // losowanie równomierne
  }
  return list.filter(it => !it.grupa || chosen[it.grupa].it === it);
}

// Test i egzamin: najpierw pytania pokazywane najrzadziej, wśród równych – losowo.
// Dzięki temu kolejne testy przechodzą przez całą pulę, zanim pytania zaczną się powtarzać.
const rotKey = it => it.grupa || it.id;
function freshFirst(list, n) {
  const seen = state.testSeen || {};
  const out = shuffle(list).sort((a, b) => (seen[rotKey(a)] || 0) - (seen[rotKey(b)] || 0));
  return n ? out.slice(0, n) : out;
}
function markTestSeen(it) {
  const seen = state.testSeen || (state.testSeen = {});
  seen[rotKey(it)] = (seen[rotKey(it)] || 0) + 1;
}

function hardItems() {
  return DATA.items.filter(it => state.hist[it.id] && state.hist[it.id].last === 'bad');
}

function boxOf(id) {
  return (state.boxes[id] && state.boxes[id].box) || 0;
}

function isDue(id) {
  const b = state.boxes[id];
  return !b || b.due <= Date.now();
}

function record(item, result, pts) {
  const prev = state.hist[item.id] ? { ...state.hist[item.id] } : null;
  const r = state.hist[item.id] || { n: 0, bad: 0 };
  r.last = result;
  r.n++;
  if (result === 'bad') r.bad++;
  r.ts = Date.now();
  state.hist[item.id] = r;
  onAnswer(item, result, prev, pts);
  save();
}

// g: 0 = Nie wiem, 1 = Prawie, 2 = Wiem
function grade(item, g) {
  const cur = boxOf(item.id);
  const box = g === 0 ? 1 : g === 1 ? Math.max(1, cur) : Math.min(5, Math.max(1, cur) + 1);
  state.boxes[item.id] = { box, due: dueAfter(BOX_DAYS[box]) };
  record(item, g === 0 ? 'bad' : g === 1 ? 'almost' : 'ok');
}

function itemLabel(item) {
  const t = item.question || item.front || item.prompt || (item.title && (item.type === 'case' ? 'Kazus: ' : 'Pary: ') + item.title) ||
    String(item.text || '').replace(/\[\[[^\]]*\]\]/g, '___');
  return t.length > 160 ? t.slice(0, 157) + '…' : t;
}

function tags(item) {
  const box = boxOf(item.id);
  return h('div', { class: 'tags-row' },
    h('span', { class: 'tag' }, deckById[item.deck] ? deckById[item.deck].name : item.deck),
    item.naPamiec && h('span', { class: 'tag mem' }, 'Na pamięć'),
    item.type === 'flashcard' && h('span', { class: 'tag' }, box ? `Pudełko ${box}` : 'Nowa'),
    HAS_SERVER && h('button', { type: 'button', class: 'report-btn', title: 'Zgłoś błąd w tym pytaniu', 'aria-label': 'Zgłoś błąd w tym pytaniu',
      onclick: e => { e.stopPropagation(); showReport(item); } }, '⚑ Zgłoś błąd'));
}

// Rysunek do pytania (pole „img” w bazie), np. numeracja części broni.
function qImg(item) {
  return item.img ? h('img', { class: 'q-img', src: item.img, alt: item.imgAlt || 'Rysunek do pytania', loading: 'lazy' }) : null;
}

function sourceEl(item) {
  return item.source ? h('div', { class: 'source' }, h('b', {}, 'Podstawa: '), item.source) : null;
}

/* ---------- Routing ---------- */

const routes = {
  '': renderHome,
  fiszki: () => startFlash(false),
  test: startTest,
  pamiec: startMemory,
  egzamin: renderExam,
  trudne: startHard,
  czytaj: renderRead,
  teczka: renderTeczka,
  wyzwanie: startChallenge,
  kazusy: startCases,
  pary: startPairs,
  sprint: renderSprint,
  sluchaj: renderListen,
};

function route() {
  if (OLD_SITE) return; // stara strona: tylko ekran przeprowadzki
  stopSprint();
  stopListening();
  clearTimeout(bielikIdleT); clearTimeout(bielikFlashT);
  const prevRoute = currentRoute;
  currentRoute = location.hash.replace(/^#\/?/, '');
  if ((currentRoute === '' || !(currentRoute in routes)) && prevRoute) {
    if (sessAnswers >= 1 && sessAnswers <= 3) shortSession = true;
    sessAnswers = 0;
  }
  if (!(currentRoute in routes)) currentRoute = '';
  if (currentRoute === 'czytaj' && !docs.length) currentRoute = '';
  pointsMult = 1;
  const tab = currentRoute === 'czytaj' || currentRoute === 'teczka' ? currentRoute : 'nauka';
  document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === tab));
  routes[currentRoute]();
  updateTimer();
}

window.addEventListener('hashchange', route);
$back.addEventListener('click', () => {
  if (location.hash === '#/' || location.hash === '') route();
  else location.hash = '#/';
});

/* ---------- Ekran startowy ---------- */

function renderHome(keepScroll) {
  const y = window.scrollY;
  screen('Nauka SW', false);
  const flash = pool(['flashcard']);
  const due = flash.filter(i => isDue(i.id)).length;
  const mcq = pool(['mcq']).length;
  const mem = pool(['cloze', 'order']).length;
  const hard = hardItems().length;
  const examRunning = exam && !exam.finished;

  const mode = (name, sub, href, count, primary) =>
    h('a', { class: 'btn mode' + (primary ? ' primary' : ''), href: count ? href : null, 'aria-disabled': count ? null : 'true', style: count ? null : 'opacity:.45' },
      h('span', { class: 'mode-name' }, name), h('span', { class: 'mode-sub' }, sub));

  const nCase = pool(['case']).length, nPairs = pool(['pairs']).length;
  $app.append(heroCard());
  $app.append(h('a', { class: 'cta', href: '#/egzamin' },
    h('span', { class: 'cta-ic' }, icon('clock', 26)),
    h('span', { class: 'cta-text' }, h('strong', {}, 'Egzamin próbny'),
      h('span', {}, examRunning ? `Trwa – zostało ${mmss(exam.end - Date.now())}` : `${examSize()} pytań · ${examMinutes()} minut · jak na prawdziwym`)),
    icon('chev', 22)));
  const tile = (ic, cls, name, sub, href, count) => h('a', { class: 'tile ' + cls, href: count ? href : null, 'aria-disabled': count ? null : 'true' },
    h('span', { class: 'tile-ic' }, icon(ic, 22)), h('span', { class: 'tile-name' }, name), h('span', { class: 'tile-sub' }, sub));
  $app.append(h('div', { class: 'tiles' },
    tile('cards', 't-olive', 'Fiszki', due ? `${due} do powtórki` : `${flash.length} w wybranych tematach`, '#/fiszki', flash.length),
    tile('check', 't-blue', 'Test', `${mcq} ${plural(mcq, 'pytanie', 'pytania', 'pytań')} w puli`, '#/test', mcq),
    tile('pen', 't-purple', 'Na pamięć', `${mem} ${plural(mem, 'ćwiczenie', 'ćwiczenia', 'ćwiczeń')}`, '#/pamiec', mem),
    tile('alert', 't-red', 'Trudne', hard ? `${hard} do poprawy` : 'brak błędów', '#/trudne', hard)));
  $app.append(gameTile());
  $app.append(rozkazyCard());
  const more = (ic, cls, name, sub, href, count) => h('a', { class: 'more-item ' + cls, href: count ? href : null, 'aria-disabled': count ? null : 'true', title: sub },
    h('span', { class: 'more-ic' }, icon(ic, 24)), h('span', { class: 'more-name' }, name));
  $app.append(h('section', { class: 'more' }, h('h2', { class: 'sec-h' }, 'Więcej trybów'),
    h('div', { class: 'more-row' },
      more('coins', 'm-gold', 'Milionerzy', state.settings.milionBest != null ? `Rekord: ${MILION_KWOTY[state.settings.milionBest]}` : '12 pytań, 3 koła ratunkowe', '#/milionerzy', mcq),
      more('swipe', 'm-blue', 'Prawda czy fałsz', 'przesuwaj karty', '#/prawda', mcq),
      more('landmark', 'm-olive', 'Kto co robi', 'kompetencje organów', '#/kto', 1),
      more('scale', 'm-purple', 'Kazusy', `${nCase} ${plural(nCase, 'sytuacja', 'sytuacje', 'sytuacji')}`, '#/kazusy', nCase),
      more('puzzle', 'm-teal', 'Pary', `${nPairs} ${plural(nPairs, 'zestaw', 'zestawy', 'zestawów')}`, '#/pary', nPairs),
      more('timer', 'm-fire', 'Sprint 60 s', state.settings.sprintBest ? `Rekord: ${state.settings.sprintBest}` : 'ile zdążysz w minutę?', '#/sprint', mcq),
      more('phones', 'm-slate', 'Słuchaj', 'fiszki czytane na głos', '#/sluchaj', flash.length),
      more('search', 'm-slate', 'Szukaj', 'we wszystkich pytaniach', '#/szukaj', 1))));
  const c = challengeToday();
  if (c) {
    const g = game(), cDone = g.challenge[c.day] != null;
    $app.append(h('a', { class: 'challenge-bar' + (cDone ? ' done' : ''), href: '#/wyzwanie' },
      h('span', { class: 'ch-ic' }, icon('star', 22)),
      h('span', { class: 'cta-text' }, h('strong', {}, cDone ? `Wyzwanie dnia zaliczone · ${g.challenge[c.day]}%` : 'Wyzwanie dnia · punkty ×2'),
        h('span', {}, `${c.deck.name} · ${CHALLENGE_SIZE} pytań` + (cDone ? ' · powtórz' : ''))),
      icon('chev', 20)));
  }

  // Tematy (rozwijane)
  const sel = new Set(selectedDecks());
  const setDecks = () => {
    state.settings.decks = DATA.decks.map(x => x.id).filter(id => sel.has(id));
    state.settings.decksOpen = true;
    save();
    renderHome(true);
  };
  const deckRow = d => {
    const n = DATA.items.filter(i => i.deck === d.id && (!state.settings.onlyMem || i.naPamiec)).length;
    return h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: sel.has(d.id), onchange: e => {
        if (e.target.checked) sel.add(d.id); else sel.delete(d.id);
        setDecks();
      } }),
      h('span', {}, d.name),
      h('span', { class: 'count' }, n));
  };
  const groupBtns = (ids, label) => h('div', { class: 'row deck-all' },
    btn('☑️ Zaznacz ' + label, 'ghost small-btn', () => { ids.forEach(id => sel.add(id)); setDecks(); }),
    btn('⬜ Odznacz ' + label, 'ghost small-btn', () => { ids.forEach(id => sel.delete(id)); setDecks(); }));
  const allIds = DATA.decks.map(d => d.id);
  const filters = h('details', { class: 'card topics', open: state.settings.decksOpen ? '' : null,
    ontoggle: e => { state.settings.decksOpen = e.target.open; save(); } },
    h('summary', {}, h('span', { class: 'sum-l' }, icon('target', 20), 'Tematy'), h('span', { class: 'count' }, `${sel.size} z ${allIds.length} wybranych`)),
    groupBtns(allIds, 'wszystkie'));
  for (const [czesc, label] of [['unitarna', 'Część unitarna'], ['specjalistyczna', 'Część specjalistyczna (psycholog)']]) {
    const decks = DATA.decks.filter(d => (d.czesc || 'unitarna') === czesc);
    if (!decks.length) continue;
    const ids = decks.map(d => d.id);
    const on = ids.filter(id => sel.has(id)).length;
    filters.append(h('div', { class: 'topic-group' },
      h('h3', {}, label, h('button', { type: 'button', class: 'link-btn', onclick: () => {
        if (on === ids.length) ids.forEach(id => sel.delete(id)); else ids.forEach(id => sel.add(id));
        setDecks();
      } }, on === ids.length ? 'odznacz' : 'zaznacz')),
      decks.map(deckRow)));
  }
  filters.append(h('label', { class: 'switch' },
    h('span', {}, 'Tylko „na pamięć”'),
    h('input', { type: 'checkbox', role: 'switch', checked: state.settings.onlyMem, onchange: e => {
      state.settings.onlyMem = e.target.checked;
      state.settings.decksOpen = true;
      save();
      renderHome(true);
    } })));
  $app.append(filters);

  // Postęp (3 tematy z największą liczbą fiszek, reszta po rozwinięciu)
  const prog = h('section', { class: 'card' }, h('h2', { class: 'card-h' }, icon('cards', 20), 'Postęp fiszek'));
  const restProg = h('details', { class: 'prog-more' }, h('summary', {}, 'Pokaż wszystkie tematy'));
  let allM = 0, allN = 0, shown = 0;
  const flashDecks = DATA.decks.map(d => [d, DATA.items.filter(i => i.deck === d.id && i.type === 'flashcard')]).filter(([, c]) => c.length)
    .sort((a, b) => b[1].length - a[1].length);
  for (const [d, cards] of flashDecks) {
    const counts = [0, 0, 0, 0, 0, 0];
    cards.forEach(c => counts[boxOf(c.id)]++);
    const m = counts[4] + counts[5];
    allM += m; allN += cards.length;
    (shown++ < 3 ? prog : restProg).append(h('div', { class: 'deck-progress' },
      h('div', { class: 'label' }, h('span', {}, d.name), h('span', { class: 'muted' }, `${m} / ${cards.length}`)),
      h('div', { class: 'bar', role: 'img', 'aria-label': `${m} z ${cards.length} opanowanych` },
        [1, 2, 3, 4, 5].map(b => h('i', { class: 'b' + b, style: `width:${(counts[b] / cards.length) * 100}%` })))));
  }
  if (shown > 3) prog.append(restProg);
  prog.append(h('p', { class: 'small muted', style: 'margin:12px 0 0' },
    `Opanowane (pudełko ${MASTERED_BOX}–5): ${allM} z ${allN} fiszek.`));
  prog.append(h('div', { class: 'legend' },
    h('span', { style: '--c:var(--surface-2)' }, 'nowe'),
    [1, 2, 3, 4, 5].map(b => h('span', { style: `--c:var(--b${b})`, class: 'lg' + b }, `P${b}`))));
  $app.append(prog);

  if (state.exams.length) {
    $app.append(h('section', { class: 'card' },
      h('h2', { class: 'card-h' }, icon('clock', 20), 'Ostatnie egzaminy'),
      state.exams.slice(0, 5).map(e => h('div', { class: 'label', style: 'display:flex;justify-content:space-between;padding:4px 0' },
        h('span', {}, new Date(e.date).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })),
        h('strong', {}, `${e.pct}% (${e.ok}/${e.n})`)))));
  }

  $app.append(btn('Resetuj postęp', 'danger', () => {
    if (!confirm('Na pewno usunąć cały postęp (pudełka, historię odpowiedzi i wyniki egzaminów)? Tego nie da się cofnąć.')) return;
    state = { ...defaultState(), settings: state.settings };
    exam = null;
    save();
    renderHome();
  }));

  if (keepScroll) window.scrollTo(0, y);
}

/* ---------- Widoki ćwiczeń ---------- */

// Każdy widok zwraca listę węzłów. onResult(ok) – po odpowiedzi, onNext() – przejście dalej.
function exerciseView(item, onResult, onNext, nextLabel) {
  switch (item.type) {
    case 'flashcard': return flashView(item, g => { onResult(g > 0); onNext(); });
    case 'mcq': return mcqView(item, onResult, onNext, nextLabel);
    case 'cloze': return clozeView(item, onResult, onNext, nextLabel);
    case 'order': return orderView(item, onResult, onNext, nextLabel);
    case 'case': return caseView(item, onResult, onNext, nextLabel);
    case 'pairs': return pairsView(item, onResult, onNext, nextLabel);
  }
  return [];
}

function nextButton(actions, onNext, label) {
  const b = btn(label || 'Dalej', 'primary', onNext);
  actions.replaceChildren(b);
  b.focus({ preventScroll: true });
}

function flashView(item, onGrade) {
  let flipped = false, done = false;
  const back = h('div', { class: 'fc-back', hidden: true }, item.back);
  const src = sourceEl(item);
  if (src) src.hidden = true;
  const hint = h('div', { class: 'hint' }, 'Dotknij karty, aby zobaczyć odpowiedź');
  const showBtn = btn('Pokaż odpowiedź', 'primary', () => flip());
  const choose = g => { if (done) return; done = true; clearTimeout(bielikFlashT); grade(item, g); onGrade(g); };
  clearTimeout(bielikFlashT);
  bielikFlashT = setTimeout(() => { if (!flipped && !done && back.isConnected) bielikPop('nudny.fiszka', {}, { force: true }); }, 60000);
  const grades = h('div', { class: 'row', hidden: true },
    btn('Nie wiem', 'bad', () => choose(0)),
    btn('Prawie', 'warn', () => choose(1)),
    btn('Wiem', 'ok', () => choose(2)));
  function flip() {
    if (flipped) return;
    flipped = true;
    back.hidden = false;
    if (src) src.hidden = false;
    hint.hidden = true;
    showBtn.hidden = true;
    grades.hidden = false;
  }
  const card = h('div', { class: 'card flash', role: 'button', tabindex: '0', 'aria-label': 'Karta – dotknij, aby odwrócić',
    onclick: flip, onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } } },
    tags(item), h('div', { class: 'fc-front' }, item.front), qImg(item), back, src, hint);
  return [card, h('div', { class: 'actions' }, showBtn, grades)];
}

function feedback(ok, title, ...body) {
  return h('div', { class: 'feedback ' + (ok ? 'ok' : 'bad') }, h('strong', {}, title), ...body);
}

function mcqView(item, onResult, onNext, nextLabel) {
  let done = false;
  qShownAt = Date.now();
  const order = shuffle(item.options.map((_, i) => i));
  const fb = h('div');
  const actions = h('div', { class: 'actions' });
  const LET = 'ABCDEF';
  const buttons = order.map((oi, k) => h('button', { type: 'button', class: 'btn option', onclick: () => choose(oi) },
    h('span', { class: 'opt-l', 'aria-hidden': 'true' }, LET[k]), h('span', { class: 'opt-t' }, item.options[oi])));
  function choose(oi) {
    if (done) return;
    done = true;
    const ok = oi === item.answer;
    buttons.forEach((b, k) => {
      b.disabled = true;
      if (order[k] === item.answer) b.classList.add('correct');
      else if (order[k] === oi) b.classList.add('wrong');
    });
    fb.replaceWith(feedback(ok, ok ? 'Dobrze!' : 'Źle. Poprawna odpowiedź: ' + item.options[item.answer],
      item.explanation ? h('div', {}, item.explanation) : null, sourceEl(item)));
    lastChoice = { id: item.id, text: item.options[oi] };
    record(item, ok ? 'ok' : 'bad');
    onResult(ok);
    nextButton(actions, onNext, nextLabel);
  }
  return [h('div', { class: 'card' }, tags(item), h('div', { class: 'question' }, item.question), qImg(item), h('div', { class: 'options' }, buttons), fb), actions];
}

function clozeView(item, onResult, onNext, nextLabel) {
  const wrap = h('div');
  const build = () => wrap.replaceChildren(...clozeBody(item, onResult, onNext, nextLabel, () => build()));
  build();
  return [wrap];
}

// Mylące odpowiedzi do trybu „Wybierz”: inne luki z tego ćwiczenia, potem z tej samej talii, potem z reszty.
function clozeDistractors(answer, item) {
  const gapsOf = it => [...it.text.matchAll(/\[\[([^\[\]]*)\]\]/g)].map(m => m[1]);
  const seen = new Set([norm(answer)]);
  const out = [];
  const take = list => {
    for (const a of shuffle(list)) {
      if (out.length >= 3) return;
      const k = norm(a);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(a);
    }
  };
  const cloze = DATA.items.filter(i => i.type === 'cloze' && i !== item);
  take(gapsOf(item));
  take(cloze.filter(i => i.deck === item.deck).flatMap(gapsOf));
  take(cloze.flatMap(gapsOf));
  return out;
}

// Rozwijana lista słów pod luką (tryb „Wybierz”).
let gapMenu = null;
function closeGapMenu() {
  if (gapMenu) { gapMenu.remove(); gapMenu = null; }
}
function openGapMenu(inp, options, onPick) {
  const same = gapMenu && gapMenu.owner === inp;
  closeGapMenu();
  if (same) return; // drugie kliknięcie zamyka listę
  const r = inp.getBoundingClientRect();
  const menu = h('div', { class: 'gap-menu', role: 'listbox' }, options.map(o =>
    h('button', { type: 'button', role: 'option', class: inp.value === o ? 'on' : '', onclick: e => { e.stopPropagation(); onPick(o); closeGapMenu(); } }, o)));
  menu.owner = inp;
  document.body.append(menu);
  const left = Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8));
  menu.style.left = left + window.scrollX + 'px';
  menu.style.top = r.bottom + window.scrollY + 4 + 'px';
  gapMenu = menu;
}
document.addEventListener('click', e => { if (gapMenu && !gapMenu.contains(e.target)) closeGapMenu(); });

function clozeBody(item, onResult, onNext, nextLabel, rebuild) {
  let done = false;
  const pick = state.settings.memMode === 'pick';
  const picker = h('div', { class: 'pickers' });
  const parts = item.text.split(/\[\[([^\[\]]*)\]\]/);
  const inputs = [];
  const text = h('div', { class: 'cloze' });
  parts.forEach((p, i) => {
    if (i % 2 === 0) { text.append(p); return; }
    const inp = h('input', {
      class: 'gap', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off',
      spellcheck: 'false', enterkeyhint: 'next', 'aria-label': `Luka ${inputs.length + 1}`,
    });
    inp.dataset.answer = p;
    inp.style.width = `calc(${Math.max(4, p.length + 1)}ch + 14px)`;
    if (pick) {
      inp.readOnly = true;
      inp.placeholder = String(inputs.length + 1);
      const chips = shuffle([p, ...clozeDistractors(p, item)]);
      const setGap = c => {
        if (done) return;
        inp.value = c;
        row.querySelectorAll('.chip').forEach(b => b.classList.toggle('on', b.textContent === c));
      };
      const row = h('div', { class: 'pick-row' }, h('span', { class: 'pick-n' }, `${inputs.length + 1}.`),
        chips.map(c => h('button', { type: 'button', class: 'chip', onclick: () => setGap(c) }, c)));
      picker.append(row);
      inp.classList.add('gap-pick');
      inp.addEventListener('click', e => { e.stopPropagation(); if (!done) openGapMenu(inp, chips, setGap); });
    }
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const k = inputs.indexOf(inp);
      if (k < inputs.length - 1) inputs[k + 1].focus(); else check();
    });
    inputs.push(inp);
    text.append(inp);
  });
  const fb = h('div');
  const actions = h('div', { class: 'actions stack' },
    btn('Sprawdź', 'primary', () => check()),
    btn('Pokaż odpowiedź', '', () => check(true)));

  function check(reveal) {
    if (done) return;
    done = true;
    let good = 0;
    for (const inp of inputs) {
      const ok = !reveal && norm(inp.value) === norm(inp.dataset.answer);
      inp.readOnly = true;
      inp.classList.add(ok ? 'correct' : 'wrong');
      if (ok) good++;
      else if (reveal) inp.value = inp.dataset.answer;
      else inp.after(h('span', { class: 'fix' }, ' → ' + inp.dataset.answer));
    }
    const ok = good === inputs.length;
    fb.replaceWith(feedback(ok,
      reveal ? 'Odpowiedź pokazana – spróbuj następnym razem z pamięci.' : ok ? 'Wszystkie luki poprawnie!' : `Poprawnie ${good} z ${inputs.length} luk.`,
      sourceEl(item)));
    record(item, ok ? 'ok' : 'bad');
    onResult(ok);
    nextButton(actions, onNext, nextLabel);
  }
  const modeSwitch = h('div', { class: 'seg seg-sm', role: 'radiogroup', 'aria-label': 'Sposób uzupełniania' },
    [['type', '✍️ Wpisz'], ['pick', '👆 Wybierz']].map(([v, label]) => {
      const on = (state.settings.memMode || 'type') === v;
      return h('button', { type: 'button', role: 'radio', class: on ? 'on' : '', 'aria-checked': String(on), onclick: () => {
        if (on || done) return;
        state.settings.memMode = v;
        save();
        rebuild();
      } }, label);
    }));
  return [h('div', { class: 'card' }, tags(item), modeSwitch,
    h('p', { class: 'small muted', style: 'margin:0 0 6px' }, pick ? 'Wybierz słowo do każdej luki:' : 'Uzupełnij luki:'), text, pick ? picker : null, fb), actions];
}

function orderView(item, onResult, onNext, nextLabel) {
  let done = false;
  const n = item.steps.length;
  let idx;
  do { idx = shuffle([...Array(n).keys()]); } while (n > 1 && idx.every((v, k) => v === k));

  const list = h('ol', { class: 'order-list' });
  const refresh = () => {
    const rows = [...list.children];
    rows.forEach((li, k) => {
      li.querySelector('.up').disabled = done || k === 0;
      li.querySelector('.down').disabled = done || k === rows.length - 1;
    });
  };
  for (const i of idx) {
    const li = h('li', { class: 'order-item' });
    li.dataset.i = i;
    const handle = h('span', { class: 'handle', 'aria-hidden': 'true', title: 'Przeciągnij' }, '⠿');
    li.append(handle, h('span', { class: 'txt' }, item.steps[i]),
      h('button', { type: 'button', class: 'mv up', 'aria-label': 'Przesuń w górę', onclick: () => {
        if (li.previousElementSibling) list.insertBefore(li, li.previousElementSibling);
        refresh();
      } }, '▲'),
      h('button', { type: 'button', class: 'mv down', 'aria-label': 'Przesuń w dół', onclick: () => {
        if (li.nextElementSibling) list.insertBefore(li.nextElementSibling, li);
        refresh();
      } }, '▼'));
    enableDrag(handle, li, list, refresh, () => done);
    list.append(li);
  }
  refresh();

  const fb = h('div');
  const actions = h('div', { class: 'actions' }, btn('Sprawdź', 'primary', () => check()));
  function check() {
    if (done) return;
    done = true;
    const rows = [...list.children];
    let good = 0;
    rows.forEach((li, k) => {
      const ok = +li.dataset.i === k;
      if (ok) good++;
      li.classList.add(ok ? 'correct' : 'wrong');
    });
    refresh();
    const ok = good === n;
    fb.replaceWith(feedback(ok, ok ? 'Kolejność poprawna!' : `Na właściwym miejscu: ${good} z ${n}. Poprawna kolejność:`,
      ok ? null : h('ol', { class: 'solution' }, item.steps.map(s => h('li', {}, s))),
      sourceEl(item)));
    record(item, ok ? 'ok' : 'bad');
    onResult(ok);
    nextButton(actions, onNext, nextLabel);
  }
  return [h('div', { class: 'card' }, tags(item), h('div', { class: 'question' }, item.prompt || 'Ułóż w poprawnej kolejności'),
    h('p', { class: 'small muted', style: 'margin:-6px 0 10px' }, 'Przeciągnij za uchwyt ⠿ albo użyj strzałek.'), list, fb), actions];
}

// Przeciąganie wiersza za uchwyt – działa myszą i palcem (Pointer Events).
function enableDrag(handle, li, list, refresh, isLocked) {
  handle.addEventListener('pointerdown', e => {
    if (isLocked()) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    li.classList.add('dragging');
    const move = ev => {
      const y = ev.clientY;
      let before = null;
      for (const s of list.children) {
        if (s === li) continue;
        const r = s.getBoundingClientRect();
        if (y < r.top + r.height / 2) { before = s; break; }
      }
      if (before !== li.nextElementSibling) list.insertBefore(li, before);
      if (y < 70) window.scrollBy(0, -8);
      else if (y > window.innerHeight - 90) window.scrollBy(0, 8);
    };
    const up = () => {
      li.classList.remove('dragging');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      refresh();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  });
}

/* ---------- Sesje ---------- */

function emptyScreen(title, icon, message, ...buttons) {
  screen(title, true);
  $app.append(h('div', { class: 'card empty' }, h('div', { class: 'big' }, icon), h('p', {}, message)),
    h('div', { class: 'stack' }, ...buttons, btn('Wróć do startu', '', () => { location.hash = '#/'; })));
}

// Wspólny przebieg dla testu, trybu „na pamięć” i „trudnych”.
function runSequence(title, items, restart, opts = {}) {
  if (!items.length) return emptyScreen(title, '📭', 'Brak pozycji dla wybranych talii i filtrów.');
  const s = { i: 0, ok: 0, wrong: [] };
  const step = () => {
    if (s.i >= items.length) return sequenceSummary(title, items, s, restart, opts);
    const item = items[s.i];
    if (opts.onShow) opts.onShow(item);
    screen(title, true);
    $app.append(h('div', { class: 'progress-line' },
      h('span', {}, `${s.i + 1} / ${items.length}`),
      h('span', { class: 'pl-ok' }, `Dobrze: ${s.ok}`)),
      h('div', { class: 'seq-bar' }, h('i', { style: `width:${Math.round(s.i / items.length * 100)}%` })));
    $app.append(...exerciseView(item,
      ok => { if (ok) s.ok++; else s.wrong.push(item); },
      () => { s.i++; step(); },
      s.i + 1 === items.length ? 'Zobacz wynik' : 'Dalej'));
  };
  step();
}

function sequenceSummary(title, items, s, restart, opts = {}) {
  screen(title, true);
  const n = items.length;
  const p = pct(s.ok, n);
  if (opts.onFinish) opts.onFinish(s);
  if (opts.celebrate) onTestDone();
  $app.append(opts.celebrate ? verdictCard(p, `${s.ok} z ${n} poprawnie`, worstDeck(s.wrong)) : h('div', { class: 'card' },
    h('div', { class: 'score' }, p + '%'),
    h('div', { class: 'score-sub' }, `${s.ok} z ${n} poprawnie`)));
  const buttons = h('div', { class: 'stack' });
  if (s.wrong.length) buttons.append(btn(`Powtórz błędne (${s.wrong.length})`, 'primary', () => runSequence(title, shuffle(s.wrong), restart)));
  buttons.append(btn('Jeszcze raz', s.wrong.length ? '' : 'primary', restart), btn('Wróć do startu', '', () => { location.hash = '#/'; }));
  $app.append(buttons);
  if (s.wrong.length) {
    $app.append(h('h2', {}, 'Do powtórki'));
    for (const it of s.wrong) {
      $app.append(h('div', { class: 'card mistake' },
        h('div', { class: 'q' }, itemLabel(it)),
        it.type === 'mcq' ? h('div', { class: 'good' }, '✓ ' + it.options[it.answer]) : null,
        it.type === 'flashcard' ? h('div', { class: 'good' }, it.back) : null,
        sourceEl(it)));
    }
  }
}

function startFlash(cram) {
  const all = pool(['flashcard']);
  const rank = b => (b === 0 ? 1.5 : b); // nowe karty zaraz po pudełku 1
  let queue = shuffle(cram ? all : all.filter(i => isDue(i.id)))
    .sort((a, b) => rank(boxOf(a.id)) - rank(boxOf(b.id)))
    .slice(0, FLASH_SESSION);
  if (!all.length) return emptyScreen('Fiszki', '📭', 'Brak fiszek dla wybranych talii i filtrów.');
  if (!queue.length) {
    const next = Math.min(...all.map(i => state.boxes[i.id].due));
    return emptyScreen('Fiszki', '🎉',
      `Na teraz wszystko powtórzone. Następne karty wrócą ${new Date(next).toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}.`,
      btn('Powtarzaj mimo to', 'primary', () => startFlash(true)));
  }
  const s = { queue, stats: [0, 0, 0], seen: new Set() };
  flashStep(s, cram);
}

function flashStep(s, cram) {
  if (!s.queue.length) return flashSummary(s, cram);
  const item = s.queue.shift();
  s.seen.add(item.id);
  screen('Fiszki', true);
  $app.append(h('div', { class: 'progress-line' },
    h('span', {}, `Zostało: ${s.queue.length + 1}`),
    h('span', {}, `✓ ${s.stats[2]} · ~ ${s.stats[1]} · ✗ ${s.stats[0]}`)));
  $app.append(...flashView(item, g => {
    s.stats[g]++;
    // Karty z pudełka 1 wracają jeszcze w tej sesji.
    if (g === 0) s.queue.splice(Math.min(3, s.queue.length), 0, item);
    else if (g === 1 && boxOf(item.id) === 1) s.queue.push(item);
    flashStep(s, cram);
  }));
}

function flashSummary(s, cram) {
  screen('Fiszki', true);
  const moreDue = pool(['flashcard']).filter(i => isDue(i.id)).length;
  $app.append(h('div', { class: 'card' },
    h('div', { class: 'score' }, '✓'),
    h('div', { class: 'score-sub' }, `Przerobione karty: ${s.seen.size}`),
    h('p', { style: 'text-align:center;margin:0' }, `Wiem: ${s.stats[2]} · Prawie: ${s.stats[1]} · Nie wiem: ${s.stats[0]}`)));
  $app.append(h('div', { class: 'stack' },
    moreDue ? btn(`Kolejna porcja (${moreDue} do powtórki)`, 'primary', () => startFlash(false))
      : btn('Powtarzaj mimo to', 'primary', () => startFlash(true)),
    btn('Wróć do startu', '', () => { location.hash = '#/'; })));
}

// Test: najpierw wybór części egzaminu – unitarna (wiedza ogólna) albo specjalistyczna (psycholog).
// Część bierze wszystkie talie o danym polu „czesc” w pytania_sw.json, niezależnie od zaznaczeń na ekranie startowym.
function startTest() {
  screen('Test', true);
  const partDecks = c => DATA.decks.filter(d => d.czesc === c).map(d => d.id);
  const option = (name, sub, decks, primary) => {
    const n = testItems(decks).length;
    return h('button', { type: 'button', class: 'btn mode' + (primary ? ' primary' : ''), disabled: !n, style: n ? null : 'opacity:.45',
      onclick: () => runTest(name, decks) },
      h('span', { class: 'mode-name' }, name),
      h('span', { class: 'mode-sub' }, `${n} ${plural(n, 'pytanie', 'pytania', 'pytań')} w puli · ${sub}`));
  };
  $app.append(h('p', { class: 'small muted', style: 'margin-top:0' }, 'Ile pytań?'),
    sizePicker([...SIZES, 0], testSize(), v => { state.settings.testSize = v; save(); startTest(); }),
    h('p', { class: 'small muted' }, 'Wybierz część egzaminu:'),
    h('div', { class: 'modes' },
      option('Unitarny', 'wiedza ogólna: KKW, ochrona, ŚPB, broń, pragmatyka, pierwsza pomoc', partDecks('unitarna'), true),
      option('Specjalistyczny', 'tylko psychologia', partDecks('specjalistyczna'), true),
      option('Wybrane talie', 'talie zaznaczone na ekranie startowym', null)));
}

function testItems(decks) {
  return decks ? pool(['mcq'], { decks, ignoreMem: true }) : pool(['mcq']);
}

function runTest(name, decks) {
  const items = shuffle(freshFirst(testItems(decks), testSize()));
  runSequence(`Test – ${name.toLowerCase()}`, items, () => runTest(name, decks), { celebrate: true, onShow: markTestSeen });
}

// Przełącznik liczby pytań (0 = wszystkie).
function sizePicker(values, current, onPick) {
  return h('div', { class: 'seg', role: 'radiogroup' }, values.map(v =>
    h('button', { type: 'button', role: 'radio', class: v === current ? 'on' : '', 'aria-checked': String(v === current),
      onclick: () => onPick(v) }, v ? String(v) : 'Wszystkie')));
}

function startMemory() {
  runSequence('Na pamięć', shuffle(pool(['cloze', 'order'])), startMemory);
}

function startHard() {
  const items = hardItems();
  if (!items.length) return emptyScreen('Trudne', '🎉', 'Nie masz pozycji z błędną ostatnią odpowiedzią.');
  runSequence('Trudne', shuffle(items), startHard);
}

/* ---------- Kazusy ---------- */

const CASE_SESSION = 5;

function startCases() {
  runSequence('Kazusy', shuffle(pool(['case'])).slice(0, CASE_SESSION), startCases, { celebrate: false });
}

function caseView(item, onResult, onNext, nextLabel) {
  let k = 0, good = 0;
  const steps = item.steps;
  const stepBox = h('div');
  const actions = h('div', { class: 'actions' });
  const progress = h('span', { class: 'case-step' });
  const card = h('div', { class: 'card case' }, tags(item),
    h('h3', { class: 'case-title' }, '⚖️ ' + item.title),
    h('div', { class: 'case-scenario' }, item.scenario),
    progress, stepBox);
  function show() {
    const st = steps[k];
    progress.textContent = `Krok ${k + 1} z ${steps.length}`;
    actions.replaceChildren();
    let done = false;
    const order = shuffle(st.options.map((_, i) => i));
    const fb = h('div');
    const buttons = order.map(oi => h('button', { type: 'button', class: 'btn option', onclick: () => choose(oi) }, st.options[oi]));
    function choose(oi) {
      if (done) return;
      done = true;
      const ok = oi === st.answer;
      if (ok) good++;
      buttons.forEach((b, j) => {
        b.disabled = true;
        if (order[j] === st.answer) b.classList.add('correct');
        else if (order[j] === oi) b.classList.add('wrong');
      });
      fb.replaceWith(feedback(ok, ok ? 'Dobrze!' : 'Źle. Poprawnie: ' + st.options[st.answer], st.explanation ? h('div', {}, st.explanation) : null));
      if (k + 1 < steps.length) {
        nextButton(actions, () => { k++; show(); }, 'Co dalej? ›');
      } else {
        const res = good === steps.length ? 'ok' : good * 2 >= steps.length ? 'almost' : 'bad';
        record(item, res, POINTS.caseStep * good);
        onResult(res === 'ok');
        card.append(h('div', { class: 'case-sum' }, `Wynik kazusu: ${good} z ${steps.length} · +${POINTS.caseStep * good} pkt`), sourceEl(item) || '',
          bielikComment(good === steps.length ? 'kazus.ok' : 'kazus.blad') || '');
        nextButton(actions, onNext, nextLabel);
      }
    }
    stepBox.replaceChildren(h('div', { class: 'question' }, st.question), h('div', { class: 'options' }, buttons), fb);
  }
  show();
  return [card, actions];
}

/* ---------- Dopasuj pary ---------- */

const PAIRS_ROUND = 5;

function startPairs() {
  runSequence('Dopasuj pary', shuffle(pool(['pairs'])).slice(0, 5), startPairs);
}

function pairsView(item, onResult, onNext, nextLabel) {
  const chosen = shuffle(item.pairs.slice()).slice(0, PAIRS_ROUND);
  const left = shuffle(chosen.map((p, i) => ({ i, t: p[0] })));
  const right = shuffle(chosen.map((p, i) => ({ i, t: p[1] })));
  let pick = null, matched = 0, mistakes = 0, busy = false;
  const info = h('div', { class: 'pairs-info' }, 'Dotknij pozycji po lewej, potem pasującej po prawej.');
  const actions = h('div', { class: 'actions' });
  const mk = (x, side) => {
    const b = h('button', { type: 'button', class: 'btn pair-btn', onclick: () => tap(b, x, side) }, x.t);
    return b;
  };
  const L = left.map(x => mk(x, 'L')), R = right.map(x => mk(x, 'R'));
  function tap(b, x, side) {
    if (busy || b.disabled) return;
    if (!pick || pick.side === side) {
      if (pick) pick.b.classList.remove('selected');
      pick = { b, x, side };
      b.classList.add('selected');
      return;
    }
    const a = pick; pick = null;
    a.b.classList.remove('selected');
    if (a.x.i === x.i) {
      [a.b, b].forEach(el => { el.disabled = true; el.classList.add('correct'); });
      matched++;
      if (matched === chosen.length) finish();
    } else {
      mistakes++;
      busy = true;
      [a.b, b].forEach(el => el.classList.add('wrong'));
      try { if (navigator.vibrate) navigator.vibrate(120); } catch (e) {}
      setTimeout(() => { [a.b, b].forEach(el => el.classList.remove('wrong')); busy = false; }, 650);
    }
    info.textContent = `Dopasowane: ${matched} z ${chosen.length} · błędy: ${mistakes}`;
  }
  function finish() {
    const res = mistakes === 0 ? 'ok' : mistakes <= 2 ? 'almost' : 'bad';
    const pp = POINTS.pair * Math.max(0, chosen.length - mistakes);
    record(item, res, pp);
    onResult(res === 'ok');
    info.replaceWith(feedback(mistakes <= 2, (mistakes === 0 ? 'Bezbłędnie!' : `Ułożone – błędy: ${mistakes}`) + ` · +${pp} pkt`), sourceEl(item) || h('span'),
      (mistakes === 0 && bielikComment('pary.ok')) || h('span'));
    nextButton(actions, onNext, nextLabel);
  }
  return [h('div', { class: 'card' }, tags(item), h('h3', { class: 'case-title' }, '🧩 ' + item.title), qImg(item),
    h('div', { class: 'pairs' }, h('div', { class: 'pairs-col' }, L), h('div', { class: 'pairs-col' }, R)), info), actions];
}

/* ---------- Sprint 60 s ---------- */

const SPRINT_MS = 60000;
let sprint = null;

function stopSprint() {
  if (sprint && sprint.timer) clearInterval(sprint.timer);
  sprint = null;
}

function renderSprint() {
  screen('Sprint 60 s', true);
  const n = pool(['mcq']).length;
  if (!n) return emptyScreen('Sprint 60 s', '📭', 'Brak pytań testowych dla wybranych tematów.');
  const best = state.settings.sprintBest || 0;
  $app.append(h('div', { class: 'card empty' },
    h('div', { class: 'big' }, '⏱️'),
    h('p', {}, `Masz 60 sekund. Odpowiadaj jak najszybciej – bez wyjaśnień, od razu następne pytanie. Pytania z wybranych tematów (${n}).`),
    h('p', { class: 'small muted' }, best ? `Twój rekord: ${best} poprawnych` : 'Pierwsze podejście – ustanów rekord!')),
    h('div', { class: 'stack' }, btn('Start!', 'primary', runSprint), btn('Wróć do startu', '', () => { location.hash = '#/'; })));
}

function runSprint() {
  stopSprint();
  const items = shuffle(pool(['mcq']).filter(it => !it.img));
  const s = sprint = { i: 0, ok: 0, bad: [], end: Date.now() + SPRINT_MS, timer: null, lock: false };
  screen('Sprint 60 s', true);
  const bar = h('div', { class: 'sprint-bar' }, h('div', { class: 'sprint-fill' }));
  const head = h('div', { class: 'progress-line' }, h('span', { class: 'sprint-time' }, '60 s'), h('span', { class: 'sprint-score' }, 'Dobrze: 0'));
  const body = h('div');
  $app.append(bar, head, body);
  const tickS = () => {
    if (sprint !== s) return;
    const left = Math.max(0, s.end - Date.now());
    head.querySelector('.sprint-time').textContent = Math.ceil(left / 1000) + ' s';
    bar.firstChild.style.width = (left / SPRINT_MS * 100) + '%';
    if (left <= 0) finishSprint(s);
  };
  s.timer = setInterval(tickS, 200);
  const next = () => {
    if (sprint !== s) return;
    if (s.i >= items.length) { s.i = 0; shuffle(items); }
    const item = items[s.i++];
    const order = shuffle(item.options.map((_, i) => i));
    const buttons = order.map(oi => h('button', { type: 'button', class: 'btn option', onclick: () => {
      if (s.lock || sprint !== s) return;
      s.lock = true;
      const ok = oi === item.answer;
      buttons.forEach((b, k) => { if (order[k] === item.answer) b.classList.add('correct'); else if (order[k] === oi) b.classList.add('wrong'); });
      if (ok) s.ok++; else s.bad.push(item);
      pointsMult = 0.6; // szybkie odpowiedzi – mniej punktów niż w teście
      lastChoice = { id: item.id, text: item.options[oi] };
      record(item, ok ? 'ok' : 'bad');
      pointsMult = 1;
      head.querySelector('.sprint-score').textContent = `Dobrze: ${s.ok}`;
      setTimeout(() => { s.lock = false; next(); }, ok ? 250 : 650);
    } }, item.options[oi]));
    body.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'question' }, item.question), h('div', { class: 'options' }, buttons)));
  };
  next();
  tickS();
}

function finishSprint(s) {
  clearInterval(s.timer);
  sprint = null;
  const best = state.settings.sprintBest || 0;
  const isRecord = s.ok > best;
  if (isRecord) state.settings.sprintBest = s.ok;
  const dd = ensureDaily();
  dd.sprintMax = Math.max(dd.sprintMax || 0, s.ok);
  checkRozkazy();
  save();
  screen('Sprint 60 s', true);
  $app.append(h('div', { class: 'card verdict ' + (isRecord ? 'v-gold' : 'v-green') },
    h('div', { class: 'verdict-icon', 'aria-hidden': 'true' }, isRecord ? '🏆' : '⏱️'),
    h('div', { class: 'score' }, String(s.ok)),
    h('div', { class: 'score-sub' }, `poprawnych w 60 s · błędów: ${s.bad.length}`),
    h('div', { class: 'verdict-head' }, isRecord ? 'Nowy rekord!' : `Rekord: ${best}`),
    bielikComment(isRecord ? 'sprint.rekord' : 'sprint.brak', { rekord: s.ok })));
  if (isRecord && best) confetti();
  $app.append(h('div', { class: 'stack' }, btn('Jeszcze raz', 'primary', runSprint), btn('Wróć do startu', '', () => { location.hash = '#/'; })));
  if (s.bad.length) {
    $app.append(h('h2', {}, 'Pomyłki'));
    for (const it of s.bad) $app.append(h('div', { class: 'card mistake' }, h('div', { class: 'q' }, it.question), h('div', { class: 'good' }, '✓ ' + it.options[it.answer])));
  }
}

/* ---------- Słuchaj (fiszki czytane na głos) ---------- */

let listen = null;

function stopListening() {
  if (!listen) return;
  listen.on = false;
  clearTimeout(listen.wait);
  try { speechSynthesis.cancel(); } catch (e) {}
  try { if (listen.lock) listen.lock.release(); } catch (e) {}
  listen = null;
}

// Tekst do czytania: skróty prawnicze na pełne słowa, bez znaków, które lektor czyta dziwnie.
function speakable(t) {
  return String(t || '')
    .replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/[„”"*_#>|]/g, '')
    .replace(/§\s*/g, 'paragraf ')
    .replace(/\bart\.\s*/gi, 'artykuł ')
    .replace(/\bust\.\s*/g, 'ustęp ')
    .replace(/\bpkt\s*/g, 'punkt ')
    .replace(/\blit\.\s*/g, 'litera ')
    .replace(/\bŚPB\b/g, 'środki przymusu bezpośredniego')
    .replace(/\bKKW\b/g, 'kodeks karny wykonawczy')
    .replace(/\bKK\b/g, 'kodeks karny')
    .replace(/\bDGSW\b|\bDG SW\b/g, 'Dyrektor Generalny Służby Więziennej')
    .replace(/\bSW\b/g, 'Służba Więzienna')
    .replace(/\bZK\b/g, 'zakład karny')
    .replace(/\bAŚ\b/g, 'areszt śledczy')
    .replace(/\bTA\b/g, 'tymczasowo aresztowany')
    .replace(/(\d)\s*h\b/g, '$1 godzin')
    .replace(/\bnp\./g, 'na przykład')
    .replace(/\bm\.in\./g, 'między innymi')
    .replace(/\bitp\./g, 'i tak dalej')
    .replace(/\s*→\s*/g, ', ')
    .replace(/\s*[–—]\s*/g, ', ')
    .replace(/[^\p{L}\p{N}\s.,;:!?()%/-]/gu, ' ')
    .replace(/\s+/g, ' ').trim();
}

function plVoice() {
  try { return speechSynthesis.getVoices().find(v => /^pl/i.test(v.lang)) || null; } catch (e) { return null; }
}

function renderListen() {
  screen('Słuchaj', true);
  if (!('speechSynthesis' in window)) return emptyScreen('Słuchaj', '🔇', 'Ta przeglądarka nie umie czytać na głos. Spróbuj w Chrome (Android) albo Safari (iPhone).');
  const all = pool(['flashcard']).filter(it => !it.img);
  if (!all.length) return emptyScreen('Słuchaj', '📭', 'Brak fiszek dla wybranych tematów.');
  const st = state.settings;
  const pause = () => (st.listenPause || 5) * 1000;
  const rate = () => st.listenRate || 1;
  const queue = shuffle(all.filter(i => isDue(i.id))).concat(shuffle(all.filter(i => !isDue(i.id))));
  const L = listen = { on: false, i: 0, wait: null, lock: null };
  const front = h('div', { class: 'fc-front' });
  const back = h('div', { class: 'fc-back' });
  const status = h('div', { class: 'hint' }, 'Naciśnij ▶ i odłóż telefon – pytanie, chwila na odpowiedź w myślach, potem odpowiedź.');
  const counter = h('span');
  const playBtn = btn('▶ Start', 'primary', () => (L.on ? pauseL() : play()));
  const voiceWarn = h('p', { class: 'small muted', hidden: true }, 'Nie widzę polskiego głosu w telefonie – lektor może czytać z obcym akcentem. Android: Ustawienia → Zamiana tekstu na mowę → pobierz język polski.');
  setTimeout(() => { voiceWarn.hidden = !!plVoice(); }, 800);
  function say(text, done) {
    const parts = speakable(text).match(/[^.!?;]+[.!?;]*/g) || [];
    let k = 0;
    const nextPart = () => {
      if (!L.on || listen !== L) return;
      if (k >= parts.length) return done();
      const u = new SpeechSynthesisUtterance(parts[k++]);
      u.lang = 'pl-PL';
      const v = plVoice(); if (v) u.voice = v;
      u.rate = rate();
      u.onend = nextPart;
      u.onerror = nextPart;
      speechSynthesis.speak(u);
    };
    nextPart();
  }
  function showCard() {
    const it = queue[L.i % queue.length];
    front.textContent = it.front;
    back.textContent = '';
    counter.textContent = `${(L.i % queue.length) + 1} / ${queue.length}`;
    return it;
  }
  function step() {
    if (!L.on || listen !== L) return;
    const it = showCard();
    status.textContent = '🔊 Pytanie…';
    say(it.front, () => {
      status.textContent = '🤔 Odpowiedz w myślach…';
      L.wait = setTimeout(() => {
        if (!L.on) return;
        back.textContent = it.back;
        status.textContent = '🔊 Odpowiedź…';
        say('Odpowiedź: ' + it.back, () => {
          L.wait = setTimeout(() => { L.i++; step(); }, 1500);
        });
      }, pause());
    });
  }
  async function play() {
    L.on = true;
    if (!st.listenUsed) { st.listenUsed = true; save(); }
    playBtn.textContent = '⏸ Pauza';
    try { if (navigator.wakeLock) L.lock = await navigator.wakeLock.request('screen'); } catch (e) {}
    step();
  }
  function pauseL() {
    L.on = false;
    clearTimeout(L.wait);
    try { speechSynthesis.cancel(); } catch (e) {}
    try { if (L.lock) L.lock.release(); } catch (e) {}
    L.lock = null;
    playBtn.textContent = '▶ Wznów';
    status.textContent = 'Pauza.';
  }
  const jump = d => { const was = L.on; pauseL(); L.i = Math.max(0, L.i + d); showCard(); if (was) play(); };
  showCard();
  $app.append(
    h('div', { class: 'progress-line' }, counter, h('span', {}, 'najpierw karty do powtórki')),
    h('div', { class: 'card flash listen' }, front, back, status),
    h('div', { class: 'row' }, btn('⏮', '', () => jump(-1)), playBtn, btn('⏭', '', () => jump(1))),
    h('p', { class: 'small muted' }, 'Czas na odpowiedź w myślach:'),
    sizeLikePicker([[3, '3 s'], [5, '5 s'], [8, '8 s'], [12, '12 s']], st.listenPause || 5, v => { st.listenPause = v; save(); refreshPickers(); }),
    h('p', { class: 'small muted' }, 'Tempo lektora:'),
    sizeLikePicker([[0.85, 'Wolniej'], [1, 'Normalnie'], [1.2, 'Szybciej']], st.listenRate || 1, v => { st.listenRate = v; save(); refreshPickers(); }),
    voiceWarn,
    h('p', { class: 'small muted' }, 'Ekran nie zgaśnie w trakcie czytania. Po zablokowaniu telefonu część przeglądarek przerywa czytanie.'));
  function refreshPickers() {
    // przerysuj tylko przełączniki, bez przerywania czytania
    $app.querySelectorAll('.seg').forEach((seg, n) => {
      const cur = n === 0 ? (st.listenPause || 5) : (st.listenRate || 1);
      const vals = n === 0 ? [3, 5, 8, 12] : [0.85, 1, 1.2];
      [...seg.children].forEach((b, k) => { b.classList.toggle('on', vals[k] === cur); b.setAttribute('aria-checked', String(vals[k] === cur)); });
    });
  }
}

/* ---------- Ocena wyniku (Test i Egzamin) ---------- */

const VERDICTS = [
  { min: 91, cls: 'v-gold', icon: '🎖️', rank: 'Chorąży', head: 'Wzorowo!', confetti: true, texts: [
    'Za wzorową wiedzę i postawę – nagroda z art. 138! Dyrektor osobiście ściska dłoń.',
    'Panie Chorąży, melduję: egzamin zdany wzorowo. Gwiazdka na pagonie już się błyszczy.',
    'Wiedza na poziomie Dyrektora Generalnego. Od dziś to Ty uczysz innych.',
    'To nie wynik, to standard służby. Komisja egzaminacyjna może iść do domu.',
    'Wyróżnienie przed frontem zmiany. Kodeks karny wykonawczy prosi o autograf.'] },
  { min: 76, cls: 'v-green', icon: '🔓', rank: 'Sierżant', head: 'Dobra robota!', texts: [
    'Awans do zakładu otwartego! Cele otwarte całą dobę, widzenia bez ograniczeń.',
    'Instrukcja ochronna przyswojona. Wartownia może spać spokojnie… prawie.',
    'Muszka pośrodku przeziernika, górna krawędź równo. Jeszcze kilka przestrzelin do dziesiątki.',
    'Kierownik działu wpisuje do opinii służbowej: „rokuje bardzo dobrze”.',
    'Psycholog stwierdza: wysoka podatność na oddziaływania edukacyjne. Prognoza pozytywna.'] },
  { min: 51, cls: 'v-orange', icon: '🔐', rank: 'Kapral', head: 'Zaliczone na styk', texts: [
    'Zdane! Przenosimy Cię z zamkniętego do półotwartego. Cela w nocy jeszcze zamknięta.',
    'Przepustka przyznana: raz na dwa miesiące, łącznie 14 dni w roku. Na więcej trzeba zapracować.',
    'Dowódca zmiany kiwa głową. Nie uśmiecha się, ale kiwa.',
    'Procedura zachowana, ale palec jeszcze czasem wędruje na spust. Trening bezstrzałowy wskazany.',
    'Wynik w normie. Jak 3 m² w celi – zgodnie z przepisami, ale mogłoby być przestronniej.'] },
  { min: 0, cls: 'v-red', icon: '🚨', rank: 'Szeregowy', head: 'Nie zdane', alarm: true, texts: [
    'Ogłaszam alarm! Wiedza zbiegła z celi. Rozpocząć pościg – zbieg jest w polu widzenia (zakładka Fiszki).',
    'Komisja penitencjarna kwalifikuje Cię do systemu terapeutycznego. Terapia: 30 fiszek dziennie.',
    'Kara dyscyplinarna: pozbawienie paczek żywnościowych do czasu powtórki.',
    'Spokojnie, art. 6 ustawy o ŚPB: wybieramy środek najmniej dolegliwy. Dziś była to tylko nagana.',
    'Status „N” – Nieprzygotowany. Weryfikacja co najmniej raz na 3… godziny.'] },
];

function verdictCard(p, sub, weak, extra, quiet, prevPct) {
  const v = VERDICTS.find(x => p >= x.min);
  const card = h('div', { class: 'card verdict ' + v.cls },
    h('div', { class: 'verdict-icon', 'aria-hidden': 'true' }, v.icon),
    h('div', { class: 'score' }, p + '%'),
    h('div', { class: 'score-sub' }, sub),
    h('div', { class: 'rank' }, `Stopień: ${v.rank}`),
    h('div', { class: 'verdict-head' }, v.head),
    h('p', { class: 'verdict-text' }, v.texts[Math.floor(Math.random() * v.texts.length)]),
    extra && h('p', { class: 'verdict-extra' }, extra),
    weak && p < 76 && h('p', { class: 'small', style: 'text-align:center;margin:6px 0 0' }, `Najwięcej błędów: ${weak}.`),
    bielikComment(prevPct != null && p < prevPct - 10 ? 'wyn.gorzej' : bielikResultKey(p), { wynik: p }));
  if (!quiet) {
    try { if (navigator.vibrate) navigator.vibrate(p > 50 ? [60, 80, 60] : [400]); } catch (e) {}
    if (v.confetti) confetti();
  }
  return card;
}

// Talia z największą liczbą błędów – podpowiedź, co powtórzyć.
function worstDeck(wrongItems) {
  if (!wrongItems.length) return null;
  const c = {};
  wrongItems.forEach(it => { c[it.deck] = (c[it.deck] || 0) + 1; });
  const [id, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return `${deckById[id] ? deckById[id].name : id} (${n})`;
}

// Seria egzaminów z wynikiem ≥ 91% (state.exams: najnowszy pierwszy).
function streakNote() {
  let k = 0;
  for (const e of state.exams) { if (e.pct >= 91) k++; else break; }
  return k >= 2 ? `${k}. egzamin z rzędu powyżej 90% – proszę zgłosić się po medal! 🏅` : null;
}

function confetti() {
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const box = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const pieces = ['⭐', '🎖️', '✨', '🎉', '🏅'];
  for (let i = 0; i < 40; i++) {
    box.append(h('span', { style: `left:${Math.random() * 100}%;animation-delay:${(Math.random() * 0.8).toFixed(2)}s;animation-duration:${(2 + Math.random() * 1.5).toFixed(2)}s` },
      pieces[i % pieces.length]));
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 4000);
}

/* ---------- Egzamin próbny ---------- */

function renderExam() {
  if (exam && exam.finished) return examResult();
  if (exam) return examStep();
  screen('Egzamin próbny', true);
  const sel = new Set(state.settings.examDecks || selectedDecks());
  const info = h('p', { class: 'small' });
  const start = btn('Rozpocznij egzamin', 'primary', () => startExam([...sel]));
  const update = () => {
    const n = pool(['mcq'], { decks: [...sel], ignoreMem: true }).length;
    const size = Math.min(examSize(), n);
    info.textContent = n >= examSize()
      ? `Dostępnych pytań: ${n}. Wylosuję ${examSize()}.`
      : `W wybranych taliach jest ${n} ${plural(n, 'pytanie', 'pytania', 'pytań')} – egzamin będzie miał ${size}.`;
    start.disabled = !n;
  };
  const card = h('section', { class: 'card' },
    h('p', { style: 'margin-top:0' }, `${examSize()} losowych pytań jednokrotnego wyboru, limit ${examMinutes()} minut. Odpowiedzi poznasz dopiero na końcu – razem z listą błędów do powtórki.`),
    h('h3', {}, 'Liczba pytań'),
    sizePicker(SIZES, examSize(), v => { state.settings.examSize = v; save(); renderExam(); }),
    h('h3', {}, 'Talie'));
  for (const d of DATA.decks) {
    const n = pickVariants(DATA.items.filter(i => i.deck === d.id && i.type === 'mcq')).length;
    if (!n) continue;
    card.append(h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: sel.has(d.id), onchange: e => {
        if (e.target.checked) sel.add(d.id); else sel.delete(d.id);
        state.settings.examDecks = [...sel];
        save();
        update();
      } }),
      h('span', {}, d.name), h('span', { class: 'count' }, n)));
  }
  card.append(info);
  update();
  $app.append(card, start);
}

function startExam(decks) {
  const items = shuffle(freshFirst(pool(['mcq'], { decks, ignoreMem: true }), examSize()));
  if (!items.length) return;
  exam = {
    items,
    orders: items.map(it => shuffle(it.options.map((_, i) => i))),
    answers: items.map(() => null),
    i: 0,
    start: Date.now(),
    end: Date.now() + items.length * MINUTES_PER_QUESTION * 60000,
    finished: false,
  };
  clearInterval(timerId);
  timerId = setInterval(tick, 1000);
  updateTimer();
  examStep();
}

function tick() {
  if (!exam || exam.finished) { clearInterval(timerId); return; }
  if (Date.now() >= exam.end) finishExam(true);
  else updateTimer();
}

function updateTimer() {
  const show = currentRoute === 'egzamin' && exam && !exam.finished;
  $timer.hidden = !show;
  if (!show) return;
  const left = exam.end - Date.now();
  $timer.textContent = mmss(left);
  $timer.classList.toggle('low', left < 5 * 60000);
}

function examStep() {
  const k = exam.i, item = exam.items[k], order = exam.orders[k], n = exam.items.length;
  screen('Egzamin próbny', true);
  updateTimer();
  const answered = () => exam.answers.filter(a => a !== null).length;
  const counter = h('span', {}, `Odpowiedzi: ${answered()} / ${n}`);
  $app.append(h('div', { class: 'progress-line' }, h('span', {}, `Pytanie ${k + 1} / ${n}`), counter));
  const buttons = order.map(oi => h('button', {
    type: 'button', class: 'btn option' + (exam.answers[k] === oi ? ' selected' : ''),
    'aria-pressed': String(exam.answers[k] === oi),
    onclick: () => {
      exam.answers[k] = oi;
      buttons.forEach((b, j) => { b.classList.toggle('selected', order[j] === oi); b.setAttribute('aria-pressed', String(order[j] === oi)); });
      counter.textContent = `Odpowiedzi: ${answered()} / ${n}`;
    },
  }, item.options[oi]));
  $app.append(h('div', { class: 'card' }, h('div', { class: 'question' }, item.question), qImg(item), h('div', { class: 'options' }, buttons)));
  const last = k === n - 1;
  $app.append(h('div', { class: 'actions stack' },
    h('div', { class: 'row' },
      btn('‹ Wstecz', '', () => { exam.i--; examStep(); }, { disabled: k === 0 }),
      last ? btn('Zakończ', 'primary', () => confirmFinish()) : btn('Dalej ›', 'primary', () => { exam.i++; examStep(); })),
    !last && btn('Zakończ egzamin', 'ghost', () => confirmFinish())));
}

function confirmFinish() {
  const missing = exam.answers.filter(a => a === null).length;
  const msg = missing
    ? `Bez odpowiedzi: ${missing} ${plural(missing, 'pytanie', 'pytania', 'pytań')} (liczone jako błędne). Zakończyć egzamin?`
    : 'Zakończyć egzamin i zobaczyć wynik?';
  if (confirm(msg)) finishExam(false);
}

function finishExam(timeUp) {
  clearInterval(timerId);
  exam.finished = true;
  exam.timeUp = timeUp;
  exam.took = Math.min(Date.now(), exam.end) - exam.start;
  exam.ok = 0;
  bielikQuiet = true; // przy zapisie 30–50 odpowiedzi naraz Bielik milczy
  exam.items.forEach((it, k) => {
    const ok = exam.answers[k] === it.answer;
    if (ok) exam.ok++;
    if (exam.answers[k] !== null) markTestSeen(it);
    record(it, ok ? 'ok' : 'bad');
  });
  bielikQuiet = false;
  const n = exam.items.length;
  state.exams.unshift({ date: Date.now(), ok: exam.ok, n, pct: pct(exam.ok, n), took: exam.took, limit: exam.end - exam.start });
  state.exams = state.exams.slice(0, 20);
  save();
  onExamDone(pct(exam.ok, n));
  updateTimer();
  if (currentRoute === 'egzamin') examResult();
}

function examResult() {
  screen('Wynik egzaminu', true);
  const n = exam.items.length;
  const wrong = exam.items.map((it, k) => ({ it, a: exam.answers[k] })).filter(x => x.a !== x.it.answer);
  const card = verdictCard(pct(exam.ok, n), `${exam.ok} z ${n} poprawnie · czas ${mmss(exam.took)}`,
    worstDeck(wrong.map(x => x.it)), streakNote(), exam.celebrated, state.exams[1] ? state.exams[1].pct : null);
  exam.celebrated = true;
  if (exam.timeUp) card.prepend(h('p', { style: 'text-align:center;margin:0;color:var(--bad);font-weight:700' }, 'Koniec czasu!'));
  $app.append(card);
  $app.append(h('div', { class: 'stack' },
    wrong.length > 0 && btn(`Powtórz błędne (${wrong.length})`, 'primary', () =>
      runSequence('Powtórka błędów', shuffle(wrong.map(x => x.it)), () => { location.hash = '#/test'; })),
    btn('Nowy egzamin', wrong.length ? '' : 'primary', () => { exam = null; renderExam(); }),
    btn('Wróć do startu', '', () => { location.hash = '#/'; })));
  if (!wrong.length) return;
  $app.append(h('h2', {}, `Błędne odpowiedzi (${wrong.length})`));
  for (const { it, a } of wrong) {
    $app.append(h('div', { class: 'card mistake' },
      h('div', { class: 'q' }, it.question),
      h('div', { class: 'your' }, a === null ? '✗ Brak odpowiedzi' : '✗ ' + it.options[a]),
      h('div', { class: 'good' }, '✓ ' + it.options[it.answer]),
      it.explanation && h('div', { class: 'small', style: 'margin-top:6px' }, it.explanation),
      sourceEl(it)));
  }
}

/* ---------- Czytaj ---------- */

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function mdInline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?!\s)([^*]+?)\*(?!\*)/g, '$1<em>$2</em>')
    .replace(/&lt;br&gt;/g, '<br>');
}

const LIST_RE = /^(\s*)(?:([-*])|(\d+)\.)\s+(.*)$/;

function mdList(lines) {
  const items = lines.map(l => {
    const m = l.match(LIST_RE);
    return { indent: m[1].length, ordered: !!m[3], num: m[3] ? +m[3] : 1, text: m[4] };
  });
  const build = (start, indent) => {
    let i = start;
    const { ordered, num } = items[i];
    let html = ordered ? `<ol${num !== 1 ? ` start="${num}"` : ''}>` : '<ul>';
    while (i < items.length && items[i].indent === indent && items[i].ordered === ordered) {
      let li = '<li>' + mdInline(items[i].text);
      i++;
      while (i < items.length && items[i].indent > indent) {
        const r = build(i, items[i].indent);
        li += r.html;
        i = r.next;
      }
      html += li + '</li>';
    }
    return { html: html + (ordered ? '</ol>' : '</ul>'), next: i };
  };
  let html = '', i = 0;
  while (i < items.length) {
    const r = build(i, items[i].indent);
    html += r.html;
    i = r.next;
  }
  return html;
}

function mdTable(rows) {
  const cells = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => mdInline(c.trim().replace(/\\\|/g, '|')));
  const body = rows.filter(r => !/^\|\s*:?-{3,}/.test(r));
  const [head, ...rest] = body;
  return '<div class="table-wrap"><table><thead><tr>' + cells(head).map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
    rest.map(r => '<tr>' + cells(r).map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
}

function mdToHtml(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (!line.trim()) { i++; continue; }
    if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
      out.push(`<figure class="md-fig"><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy">${m[1] ? `<figcaption>${mdInline(m[1])}</figcaption>` : ''}</figure>`);
      i++;
    } else if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
      out.push(`<h${m[1].length}>${mdInline(m[2])}</h${m[1].length}>`);
      i++;
    } else if (/^>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push('<blockquote>' + mdToHtml(buf.join('\n')) + '</blockquote>');
    } else if (/^\|/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\|/.test(lines[i])) buf.push(lines[i++]);
      out.push(mdTable(buf));
    } else if (LIST_RE.test(line)) {
      const buf = [];
      while (i < lines.length && LIST_RE.test(lines[i])) buf.push(lines[i++]);
      out.push(mdList(buf));
    } else {
      const buf = [lines[i++]];
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>|\||!\[)/.test(lines[i]) && !LIST_RE.test(lines[i])) buf.push(lines[i++]);
      out.push('<p>' + mdInline(buf.join('\n')).replace(/\n/g, '<br>') + '</p>');
    }
  }
  return out.join('\n');
}

let readSaveTimer = null;
window.addEventListener('scroll', () => {
  if (currentRoute !== 'czytaj') return;
  clearTimeout(readSaveTimer);
  readSaveTimer = setTimeout(() => {
    state.settings.readPos[state.settings.doc] = Math.round(window.scrollY);
    save();
  }, 400);
}, { passive: true });

/* Wyszukiwanie w skryptach – bez rozróżniania wielkości liter i polskich znaków. */

const SEARCH_BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, td, th';
const SEARCH_MAX_RESULTS = 100;
const docDom = [];     // skrypty wyrenderowane poza stroną – do szukania w drugim skrypcie
let pendingHit = null; // trafienie do pokazania po przełączeniu skryptu

// Każdy znak zamienia się na dokładnie jeden znak, więc pozycje w tekście się zgadzają.
function fold(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/\s/.test(c)) { out += ' '; continue; }
    const lower = c.toLowerCase();
    const f = lower.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += f === 'ł' ? 'l' : f.length === 1 ? f : lower.length === 1 ? lower : c;
  }
  return out;
}

function renderedDoc(j) {
  if (!docDom[j]) docDom[j] = h('div', { html: mdToHtml(docs[j].text) });
  return docDom[j];
}

function clearMarks(root) {
  root.querySelectorAll('mark.hit').forEach(m => {
    const parent = m.parentNode;
    m.replaceWith(m.textContent);
    parent.normalize();
  });
}

// Zwraca trafienia { heading, snippet: [przed, słowo, po], marks }; przy apply opakowuje je w <mark>.
function searchDoc(root, qf, apply) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const parts = [];
  let orig = '', folded = '', heading = '', lastBlock = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const block = n.parentElement.closest(SEARCH_BLOCKS) || n.parentElement;
    if (block !== lastBlock) {
      // Separator między blokami, żeby fraza nie łączyła końca akapitu z początkiem następnego.
      if (lastBlock) { orig += '\u0000'; folded += '\u0000'; }
      lastBlock = block;
      if (/^H[1-6]$/.test(block.tagName)) heading = block.textContent.trim();
    }
    parts.push({ node: n, start: orig.length, heading });
    orig += n.data;
    folded += fold(n.data);
  }

  const hits = [];
  for (let i = folded.indexOf(qf); i !== -1; i = folded.indexOf(qf, i + qf.length)) {
    hits.push({ start: i, end: i + qf.length, marks: [] });
  }

  let p = 0;
  for (const hit of hits) {
    while (p + 1 < parts.length && parts[p + 1].start <= hit.start) p++;
    hit.heading = parts[p].heading;
    const a = Math.max(0, hit.start - 45), b = Math.min(orig.length, hit.end + 70);
    let before = orig.slice(a, hit.start), after = orig.slice(hit.end, b);
    const cutBefore = before.lastIndexOf('\u0000'), cutAfter = after.indexOf('\u0000');
    if (cutBefore !== -1) before = before.slice(cutBefore + 1);
    else if (a > 0) before = '…' + before.replace(/^\S*\s/, '');
    if (cutAfter !== -1) after = after.slice(0, cutAfter);
    else if (b < orig.length) after = after.replace(/\s\S*$/, '') + '…';
    hit.snippet = [before.replace(/\s+/g, ' '), orig.slice(hit.start, hit.end), after.replace(/\s+/g, ' ')];
  }

  if (apply) {
    const segs = new Map();
    p = 0;
    hits.forEach((hit, hi) => {
      while (parts[p].start + parts[p].node.data.length <= hit.start) p++;
      for (let q = p; q < parts.length && parts[q].start < hit.end; q++) {
        const { node, start } = parts[q];
        const s = Math.max(hit.start, start) - start;
        const e = Math.min(hit.end, start + node.data.length) - start;
        if (e <= s) continue;
        if (!segs.has(node)) segs.set(node, []);
        segs.get(node).push([s, e, hi]);
      }
    });
    for (const [node, list] of segs) {
      const frag = document.createDocumentFragment();
      let pos = 0;
      for (const [s, e, hi] of list) {
        if (s > pos) frag.append(node.data.slice(pos, s));
        const m = h('mark', { class: 'hit' }, node.data.slice(s, e));
        hits[hi].marks.push(m);
        frag.append(m);
        pos = e;
      }
      if (pos < node.data.length) frag.append(node.data.slice(pos));
      node.replaceWith(frag);
    }
  }
  return hits;
}

function searchPanel(k, doc) {
  const s = state.settings;
  let hits = [], cur = -1, timer = null;

  const input = h('input', {
    type: 'search', class: 'search-input', placeholder: 'Szukaj w skrypcie…', 'aria-label': 'Szukaj w skrypcie',
    enterkeyhint: 'search', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
  });
  input.value = s.searchQ || '';
  const both = h('input', { type: 'checkbox', checked: !!s.searchBoth, onchange: () => run() });
  const results = h('div', { class: 'search-results' });
  const counter = h('span', { class: 'search-count', 'aria-live': 'polite' });
  const prevB = h('button', { type: 'button', class: 'mv', 'aria-label': 'Poprzednie trafienie', onclick: () => go(cur - 1) }, '↑');
  const nextB = h('button', { type: 'button', class: 'mv', 'aria-label': 'Następne trafienie', onclick: () => go(cur + 1) }, '↓');
  const bar = h('div', { class: 'search-bar', hidden: true }, counter, prevB, nextB);
  const box = h('div', { class: 'card search' }, input,
    docs.length > 1 && h('label', { class: 'check' }, both, h('span', {}, 'Szukaj we wszystkich skryptach')),
    results);

  input.addEventListener('input', () => {
    clearTimeout(timer);
    if (!input.value.trim()) run();
    else timer = setTimeout(run, 250);
  });
  input.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (timer) run();
    input.blur();
    go(cur + 1);
  });

  function go(i) {
    if (!hits.length) return;
    cur = (i + hits.length) % hits.length;
    doc.querySelectorAll('mark.current').forEach(m => m.classList.remove('current'));
    hits[cur].marks.forEach(m => m.classList.add('current'));
    hits[cur].marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    counter.textContent = `${cur + 1} / ${hits.length}`;
  }

  function openOther(j, n) {
    pendingHit = n;
    s.doc = j;
    save();
    renderRead();
  }

  function run() {
    clearTimeout(timer);
    timer = null;
    s.searchQ = input.value;
    s.searchBoth = both.checked;
    save();
    clearMarks(doc);
    hits = [];
    cur = -1;
    results.replaceChildren();
    const q = input.value.trim().replace(/\s+/g, ' ');
    if (q.length < 2) { bar.hidden = true; return; }
    const qf = fold(q);
    hits = searchDoc(doc, qf, true);
    bar.hidden = false;
    counter.textContent = hits.length ? `– / ${hits.length}` : 'Brak trafień';
    prevB.disabled = nextB.disabled = !hits.length;

    const multi = both.checked && docs.length > 1;
    const groups = [{ j: k, hits }];
    if (multi) docs.forEach((d, j) => { if (j !== k) groups.push({ j, hits: searchDoc(renderedDoc(j), qf, false) }); });
    const total = groups.reduce((n, g) => n + g.hits.length, 0);
    results.append(h('p', { class: 'small muted search-summary' }, !total ? 'Brak trafień.'
      : multi ? groups.map(g => `${docs[g.j].name}: ${g.hits.length}`).join(' · ')
      : `Trafień: ${total}`));

    const list = h('ol', { class: 'search-list' });
    let shown = 0;
    for (const g of groups) {
      for (let n = 0; n < g.hits.length && shown < SEARCH_MAX_RESULTS; n++, shown++) {
        const hit = g.hits[n];
        list.append(h('li', {}, h('button', { type: 'button', onclick: () => (g.j === k ? go(n) : openOther(g.j, n)) },
          h('span', { class: 'search-where' }, multi && h('span', { class: 'tag' }, docs[g.j].name), hit.heading || docs[g.j].name),
          h('span', { class: 'search-snippet' }, hit.snippet[0], h('mark', {}, hit.snippet[1]), hit.snippet[2]))));
      }
    }
    if (shown) results.append(list);
    if (total > shown) results.append(h('p', { class: 'small muted' }, `Pokazano ${shown} z ${total} – doprecyzuj frazę.`));
  }

  return { box, bar, run, go };
}

function renderRead() {
  screen('Czytaj', false);
  let k = state.settings.doc;
  if (!docs[k]) k = state.settings.doc = 0;
  if (docs.length > 1) {
    $app.append(h('div', { class: 'seg seg-docs', role: 'tablist' }, docs.map((d, j) =>
      h('button', { type: 'button', role: 'tab', class: j === k ? 'on' : '', 'aria-selected': String(j === k), onclick: () => {
        state.settings.doc = j;
        save();
        renderRead();
      } }, d.name))));
  }
  const doc = h('article', { class: 'doc', html: mdToHtml(docs[k].text) });
  const toc = h('ol');
  doc.querySelectorAll('h2, h3').forEach((hd, n) => {
    hd.id = `sek-${n}`;
    toc.append(h('li', { class: hd.tagName.toLowerCase() },
      h('button', { type: 'button', onclick: () => { details.open = false; hd.scrollIntoView({ behavior: 'smooth' }); } }, hd.textContent)));
  });
  const details = h('details', { class: 'card toc' }, h('summary', {}, 'Spis treści'), toc);
  const search = searchPanel(k, doc);
  $app.append(search.box, details, search.bar, doc,
    h('button', { type: 'button', class: 'to-top', 'aria-label': 'Do góry', onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }, '↑'));
  if (state.settings.searchQ) search.run();
  if (pendingHit !== null) {
    const n = pendingHit;
    pendingHit = null;
    requestAnimationFrame(() => search.go(n));
    return;
  }
  const pos = state.settings.readPos[k];
  if (pos) requestAnimationFrame(() => window.scrollTo(0, pos));
}

/* ---------- Start ---------- */

// Stara strona (GitHub Pages) – tylko informacja o przeprowadzce i kopia postępu.
const OLD_SITE = /(^|\.)github\.io$/.test(location.hostname);
// Serwer z kodami (Cloudflare) – zgłoszenia błędów i statystyki działają tylko tam.
const HAS_SERVER = !OLD_SITE && /^https?:$/.test(location.protocol);

async function init() {
  state = loadState();
  document.getElementById('storage-warning').hidden = storageOk;
  if (OLD_SITE) { applyTheme(); showMoving(); registerSW(); return; }
  try {
    const res = await fetch('pytania_sw.json');
    if (res.status === 401) { location.reload(); return; } // wersja z kodami: dostęp wygasł → ekran logowania
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
  } catch (e) {
    $app.replaceChildren(h('div', { class: 'card' }, h('strong', {}, 'Nie udało się wczytać pytań.'),
      h('p', {}, 'Sprawdź połączenie z internetem i odśwież stronę. Aplikację trzeba otworzyć przez serwer (np. GitHub Pages), a nie bezpośrednio z pliku.')));
    return;
  }
  DATA.decks.forEach(d => { deckById[d.id] = d; });
  applyTheme();
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  if (state.settings.decks) state.settings.decks = state.settings.decks.filter(id => deckById[id]);
  // Nowe talie (dodane w aktualizacji) włączają się automatycznie także tym, którzy mają własny wybór.
  const KNOWN_BEFORE_V15 = ['spb', 'sw', 'kkw', 'ochrona', 'psycholog', 'metodyka', 'bron', 'pp', 'pragmatyka', 'psych-klin', 'psych-proc', 'ewidencja', 'stanowiska'];
  const known = new Set(state.settings.knownDecks || KNOWN_BEFORE_V15);
  const added = DATA.decks.map(d => d.id).filter(id => !known.has(id));
  if (added.length && state.settings.decks) state.settings.decks.push(...added);
  if (added.length && state.settings.examDecks) state.settings.examDecks.push(...added);
  state.settings.knownDecks = DATA.decks.map(d => d.id);
  if (state.settings.examDecks) state.settings.examDecks = state.settings.examDecks.filter(id => deckById[id]);

  const loaded = await Promise.all(DOCS.map(d =>
    fetch(d.file).then(r => (r.ok ? r.text() : null)).catch(() => null)));
  docs = DOCS.map((d, i) => ({ ...d, text: loaded[i] })).filter(d => d.text);
  document.getElementById('tab-czytaj').hidden = !docs.length;

  game();
  route();
  document.getElementById('info').addEventListener('click', showWelcome);
  document.getElementById('settings').addEventListener('click', showSettings);
  document.getElementById('help').addEventListener('click', showManual);
  if ((state.settings.welcomeSeen || 0) < WELCOME_VERSION) showWelcome();
  else showChangesIfNew();

  registerSW();
  setTimeout(syncStats, 4000);
  setTimeout(syncPush, 5000);
  setTimeout(fetchPub, 6000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') syncStats(); });
}

/* ---------- Zgłoś błąd i statystyki ---------- */

function answerText(item) {
  if (item.type === 'mcq') return 'Odpowiedź w aplikacji: ' + item.options[item.answer];
  if (item.type === 'flashcard') return 'Odwrót: ' + item.back;
  if (item.type === 'case') return item.steps.map((st, k) => `Krok ${k + 1}: ${st.question} → ${st.options[st.answer]}`).join(' | ');
  if (item.type === 'pairs') return item.pairs.map(p => p.join(' = ')).join(' | ');
  if (item.type === 'order') return 'Kolejność: ' + (item.steps || []).join(' → ');
  return '';
}

function showReport(item) {
  if (document.querySelector('.modal.report')) return;
  const box = h('div', { class: 'modal report', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'report-title' });
  const close = () => box.remove();
  const KATS = ['Błędna odpowiedź', 'Nieaktualny przepis', 'Literówka / niejasne', 'Inne'];
  let kat = KATS[0];
  const seg = sizeLikePicker(KATS.map(k => [k, k]), kat, v => {
    kat = v;
    [...seg.children].forEach(b => { b.classList.toggle('on', b.textContent === v); b.setAttribute('aria-checked', String(b.textContent === v)); });
  });
  const ta = h('textarea', { class: 'report-text', rows: '4', maxlength: '1000', placeholder: 'Co jest nie tak i jak powinno być? Jeśli wiesz – podaj przepis albo źródło.' });
  const err = h('p', { class: 'err-text' });
  const send = btn('Wyślij zgłoszenie', 'primary', async () => {
    if (!ta.value.trim() && kat === 'Inne') { err.textContent = 'Opisz krótko, co jest nie tak.'; return; }
    send.disabled = true;
    try {
      const r = await fetch('/api/zgloszenie', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, kat, opis: ta.value, tresc: itemLabel(item) + ' || ' + answerText(item), wer: String(APP_VERSION) }) });
      if (!r.ok) throw new Error(r.status);
      close();
      toast('📨', 'Dziękuję za zgłoszenie!', 'Trafiło do twórcy aplikacji.');
    } catch (e) {
      err.textContent = 'Nie udało się wysłać. Sprawdź internet i spróbuj jeszcze raz.';
      send.disabled = false;
    }
  });
  box.addEventListener('click', e => { if (e.target === box) close(); });
  box.append(h('div', { class: 'card modal-card settings-card' },
    h('div', { class: 'settings-head' }, h('h2', { id: 'report-title' }, '⚑ Zgłoś błąd'),
      h('button', { type: 'button', class: 'close-x', 'aria-label': 'Zamknij', onclick: close }, '✕')),
    h('p', { class: 'small muted report-q' }, itemLabel(item)),
    h('h3', {}, 'Rodzaj błędu'), seg,
    h('h3', {}, 'Opis'), ta, err, send, btn('Anuluj', 'ghost', close)));
  document.body.append(box);
  ta.focus();
}

// Anonimowe liczniki odpowiedzi (bez imienia i kodu) – najwyżej co 4 godziny.
function syncStats() {
  if (!HAS_SERVER || state.settings.stats === false) return;
  if (Date.now() - (state.settings.statsAt || 0) < 4 * 3600000) return;
  const ids = Object.keys(state.hist || {});
  if (!ids.length) return;
  if (!state.settings.statsId) {
    state.settings.statsId = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => (b % 36).toString(36)).join('');
  }
  const hsum = {};
  for (const id of ids) hsum[id] = [state.hist[id].n || 0, state.hist[id].bad || 0];
  state.settings.statsAt = Date.now();
  save();
  try {
    fetch('/api/statystyki', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sid: state.settings.statsId, h: hsum }) }).catch(() => { state.settings.statsAt = 0; });
  } catch (e) { /* bez sieci – spróbujemy później */ }
}

function registerSW() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    // Nowy service worker przejmuje stronę (controllerchange) → pokaż prośbę o odświeżenie.
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) showUpdateBanner();
      hadController = true;
    });
    navigator.serviceWorker.register('service-worker.js').then(reg => {
      const check = () => reg.update().catch(() => {});
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
      setInterval(check, 30 * 60000);
    }).catch(() => {});
  }
}

/* ---------- Służba: punkty, stopnie, odznaki, kamienie milowe ---------- */

// Punkty (po zmniejszeniu o 1/3 względem projektu). Progi stopni – bez zmian.
const POINTS = { mcq: 7, flashcard: 3, cloze: 10, order: 10, case: 21, pairs: 10, caseStep: 7, pair: 2, fixed: 13, examPass: 67, examTop: 167, dailyGoal: 33 };
const STREAK_FROM = 5;      // od 5. dobrej odpowiedzi z rzędu…
const STREAK_MULT = 1.5;    // …punkty ×1,5
const CHALLENGE_MULT = 2;   // wyzwanie dnia – punkty ×2
const CHALLENGE_SIZE = 10;
const DAILY_GOALS = [20, 50, 100];
const DEFAULT_EXAM_DATE = '2026-12-15';
const RANKS = [
  [0, 'Szeregowy'], [500, 'Starszy szeregowy'], [1500, 'Kapral'], [3500, 'Starszy kapral'],
  [6500, 'Plutonowy'], [11000, 'Sierżant'], [17000, 'Starszy sierżant'],
  // od młodszego chorążego progi ×0,9
  [22500, 'Młodszy chorąży'], [31500, 'Chorąży'], [45000, 'Starszy chorąży'], [63000, 'Starszy chorąży sztabowy'],
  [85500, 'Podporucznik'], [112500, 'Porucznik'], [144000, 'Kapitan'], [180000, 'Major'],
  [225000, 'Podpułkownik'], [270000, 'Pułkownik'],
];
// Wagi działów do wskaźnika gotowości – wg składu „Testu 60”.
const READY_WEIGHTS = { ochrona: 20, kkw: 15, spb: 5, bron: 3, pragmatyka: 3, sw: 3, metodyka: 3, ewidencja: 2, pp: 2, psych: 4 };
const PSYCH_DECKS = ['psycholog', 'psych-klin', 'psych-proc'];
const ZUPP_RE = /pkt 10|ZUPP|samodzielnie podjąć decyzję|decyduje sam/i;

let pointsMult = 1;          // ×2 w wyzwaniu dnia
const toastQueue = [];
let toastBusy = false;

function defaultGame() {
  return {
    points: 0, rank: 0, badges: {}, milestones: {}, days: {}, goalDone: {}, challenge: {},
    counters: { answers: 0, ok: 0, fixed: 0, zupp: 0, owl: 0, tests: 0 },
    flags: {}, deckStats: {}, run: 0,
  };
}

function game() {
  if (!state.game) migrateGame();
  return state.game;
}

// Pierwsze uruchomienie: odtwórz liczniki z dotychczasowej historii (bez zalewu powiadomień).
function migrateGame() {
  const g = defaultGame();
  for (const it of DATA.items) {
    const r = state.hist[it.id];
    if (!r) continue;
    const ok = Math.max(0, r.n - r.bad);
    g.counters.answers += r.n;
    g.counters.ok += ok;
    g.points += ok * (POINTS[it.type] || 0);
    const ds = g.deckStats[it.deck] || (g.deckStats[it.deck] = { n: 0, ok: 0 });
    ds.n += r.n; ds.ok += ok;
    if (r.ts) { const k = dayKey(new Date(r.ts)); g.days[k] = (g.days[k] || 0) + 1; }
  }
  g.counters.tests = state.exams.length;
  for (const e of state.exams) g.points += e.pct >= 91 ? POINTS.examTop : e.pct >= 51 ? POINTS.examPass : 0;
  g.rank = rankIndex(g.points);
  state.game = g;
  const got = evaluate(true);
  if (got.length) toast('🎖️', `Za dotychczasową naukę przyznano ${got.length} ${plural(got.length, 'odznakę', 'odznaki', 'odznak')}`, 'Zobacz w zakładce Teczka.');
  save();
}

const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dailyGoal = () => (DAILY_GOALS.includes(state.settings.dailyGoal) ? state.settings.dailyGoal : 50);
const examDate = () => state.settings.examDate || DEFAULT_EXAM_DATE;
const rankIndex = p => { let k = 0; RANKS.forEach(([min], i) => { if (p >= min) k = i; }); return k; };
const itemText = it => [it.question, it.front, it.back, it.text, it.prompt, it.explanation].filter(Boolean).join(' ');

function addPoints(n) {
  const g = game();
  g.points += Math.round(n);
}

// Wywoływane z record() – każda odpowiedź w każdym trybie.
function onAnswer(item, result, prev, customPts) {
  const g = game();
  const now = new Date(), day = dayKey(now), hr = now.getHours();
  const ok = result === 'ok';
  g.days[day] = (g.days[day] || 0) + 1;
  g.counters.answers++;
  const ds = g.deckStats[item.deck] || (g.deckStats[item.deck] = { n: 0, ok: 0 });
  ds.n++;
  if (hr >= 22) g.flags.night = true;
  if (hr >= 4 && hr < 7) g.flags.morning = true;
  if (hr < 4) g.counters.owl++;
  // Punkty: kazusy i pary mają punktację częściową (customPts), reszta – stała stawka za dobrą odpowiedź.
  let pts = customPts != null ? customPts : ok ? (POINTS[item.type] || 0) : 0;
  if (ok) {
    ds.ok++;
    g.counters.ok++;
    g.run++;
    const wasBad = prev && prev.last === 'bad';
    if (wasBad) {
      pts = Math.max(pts, POINTS.fixed); // poprawa błędu nigdy nie daje mniej niż zwykła odpowiedź
      g.counters.fixed++;
      if (prev.bad >= 5) unlock('szczesciarz');
    }
    if (g.run >= STREAK_FROM) pts *= STREAK_MULT;
    if (item.deck === 'spb' && ZUPP_RE.test(itemText(item))) g.counters.zupp++;
  } else if (result === 'bad') {
    g.run = 0;
  }
  if (pts) addPoints(pts * pointsMult);
  if (g.days[day] >= dailyGoal() && !g.goalDone[day]) {
    g.goalDone[day] = true;
    addPoints(POINTS.dailyGoal);
    if (!BIELIK_ON()) toast('🎯', 'Dzienny cel osiągnięty!', `${dailyGoal()} odpowiedzi dzisiaj · +${POINTS.dailyGoal} pkt`);
  }
  trackDaily(item, result, prev);
  bielikWeak(item, result, prev);
  bielikOnAnswer(item, result, prev);
  evaluate();
}

function onTestDone() {
  game().counters.tests++;
  evaluate();
  save();
}

function onExamDone(p) {
  const g = game();
  g.counters.tests++;
  if (p >= 91) addPoints(POINTS.examTop);
  else if (p >= 51) addPoints(POINTS.examPass);
  evaluate();
  save();
}

/* --- Odznaki --- */

function deckAcc(ids) {
  let n = 0, ok = 0;
  for (const id of ids) { const s = game().deckStats[id]; if (s) { n += s.n; ok += s.ok; } }
  return { n, ok, acc: n ? ok / n : 0 };
}
const mastered = ids => { const a = deckAcc(ids); return a.n >= 30 && a.acc >= 0.9; };

function streakDays() {
  const g = game();
  const d = new Date();
  if (!g.days[dayKey(d)]) d.setDate(d.getDate() - 1); // seria trwa, jeśli wczoraj była nauka
  let k = 0;
  while (g.days[dayKey(d)]) { k++; d.setDate(d.getDate() - 1); }
  return k;
}

function weekendDuty() {
  return Object.keys(game().days).some(k => {
    const d = new Date(k + 'T12:00:00');
    if (d.getDay() !== 6) return false;
    d.setDate(d.getDate() + 1);
    return !!game().days[dayKey(d)];
  });
}

const examsChrono = () => state.exams.slice().reverse();

const BADGES = [
  // Start
  { id: 'start', cat: 'Start', icon: '🎒', name: 'Pierwszy dzień w służbie', desc: 'Pierwsza odpowiedź w aplikacji', test: g => g.counters.answers >= 1 },
  { id: 'slubowanie', cat: 'Start', icon: '📜', name: 'Ślubowanie', desc: 'Pierwszy ukończony test lub egzamin', test: g => g.counters.tests >= 1 },
  // Wytrwałość
  ...[3, 7, 14, 30].map(n => ({ id: 'seria' + n, cat: 'Wytrwałość', icon: '🔥', name: `Służba bez przerwy – ${n} dni`, desc: `Nauka ${n} dni z rzędu`, test: () => streakDays() >= n })),
  { id: 'nocna', cat: 'Wytrwałość', icon: '🌙', name: 'Nocna zmiana', desc: 'Nauka po 22:00', test: g => !!g.flags.night },
  { id: 'apel', cat: 'Wytrwałość', icon: '🌅', name: 'Apel poranny', desc: 'Nauka między 4:00 a 7:00', test: g => !!g.flags.morning },
  { id: 'weekend', cat: 'Wytrwałość', icon: '📅', name: 'Weekendowy dyżur', desc: 'Nauka w sobotę i w niedzielę tego samego weekendu', test: () => weekendDuty() },
  // Ilość
  ...[100, 500, 1000, 2500].map(n => ({ id: 'kancelista' + n, cat: 'Ilość', icon: '📝', name: `Kancelista – ${n}`, desc: `${n} udzielonych odpowiedzi`, test: g => g.counters.answers >= n })),
  { id: 'weteran', cat: 'Ilość', icon: '🃏', name: 'Fiszkowy weteran', desc: 'Każda fiszka przerobiona przynajmniej raz', test: () => DATA.items.filter(i => i.type === 'flashcard').every(i => state.hist[i.id]) },
  { id: 'pudelko', cat: 'Ilość', icon: '📦', name: 'Pełne pudełko', desc: '50 fiszek w pudełku 5', test: () => DATA.items.filter(i => i.type === 'flashcard' && boxOf(i.id) === 5).length >= 50 },
  // Mistrzostwo
  { id: 'm-ochrona', cat: 'Mistrzostwo działów', icon: '🛡️', name: 'Mistrz ochrony', desc: '90%+ poprawnych w talii Ochrona (min. 30 odpowiedzi)', test: () => mastered(['ochrona']) },
  { id: 'm-kkw', cat: 'Mistrzostwo działów', icon: '⚖️', name: 'Znawca KKW', desc: '90%+ w talii KKW (min. 30 odpowiedzi)', test: () => mastered(['kkw']) },
  { id: 'm-spb', cat: 'Mistrzostwo działów', icon: '✊', name: 'Ekspert ŚPB', desc: '90%+ w talii ŚPB (min. 30 odpowiedzi)', test: () => mastered(['spb']) },
  { id: 'm-bron', cat: 'Mistrzostwo działów', icon: '🎯', name: 'Strzelec wyborowy', desc: '90%+ w talii Broń (min. 30 odpowiedzi)', test: () => mastered(['bron']) },
  { id: 'm-pp', cat: 'Mistrzostwo działów', icon: '🩹', name: 'Ratownik', desc: '90%+ w talii Pierwsza pomoc (min. 30 odpowiedzi)', test: () => mastered(['pp']) },
  { id: 'm-ewidencja', cat: 'Mistrzostwo działów', icon: '📋', name: 'Ewidencjonista', desc: '90%+ w talii Ewidencja (min. 30 odpowiedzi)', test: () => mastered(['ewidencja']) },
  { id: 'm-psych', cat: 'Mistrzostwo działów', icon: '🧠', name: 'Psycholog penitencjarny', desc: '90%+ we wszystkich taliach psychologicznych razem (min. 30 odpowiedzi)', test: () => mastered(PSYCH_DECKS) },
  { id: 'komplet', cat: 'Mistrzostwo działów', icon: '🏛️', name: 'Komplet', desc: 'Wszystkie odznaki mistrzostwa działów', test: g => ['m-ochrona', 'm-kkw', 'm-spb', 'm-bron', 'm-pp', 'm-ewidencja', 'm-psych'].every(b => g.badges[b]) },
  // Egzaminy
  { id: 'zdany', cat: 'Egzaminy', icon: '🎓', name: 'Zdany', desc: 'Egzamin próbny na 51%+', test: () => state.exams.some(e => e.pct >= 51) },
  { id: 'wzorowo', cat: 'Egzaminy', icon: '🎖️', name: 'Wzorowo', desc: 'Egzamin próbny na 91%+', test: () => state.exams.some(e => e.pct >= 91) },
  { id: 'bezblednie', cat: 'Egzaminy', icon: '💯', name: 'Bezbłędnie', desc: 'Egzamin próbny na 100%', test: () => state.exams.some(e => e.pct === 100) },
  { id: 'trzy-medale', cat: 'Egzaminy', icon: '🏅', name: 'Trzy medale', desc: '3 egzaminy z rzędu na 91%+', test: () => state.exams.length >= 3 && state.exams.slice(0, 3).every(e => e.pct >= 91) },
  { id: 'szybka', cat: 'Egzaminy', icon: '⏱️', name: 'Szybka reakcja', desc: 'Egzamin na 80%+ w mniej niż połowie czasu', test: () => state.exams.some(e => e.pct >= 80 && e.took && e.limit && e.took < e.limit / 2) },
  { id: 'zwrot', cat: 'Egzaminy', icon: '🔄', name: 'Zwrot akcji', desc: 'Egzamin na 91%+ po wcześniejszym niezdanym', test: () => { let failed = false; return examsChrono().some(e => { if (failed && e.pct >= 91) return true; if (e.pct < 51) failed = true; return false; }); } },
  // Poprawa błędów
  { id: 'porzadek', cat: 'Poprawa błędów', icon: '🧹', name: 'Porządek w celi', desc: 'Wyczyszczona lista „Trudne”', test: g => g.counters.fixed > 0 && hardItems().length === 0 },
  { id: 'recydywa', cat: 'Poprawa błędów', icon: '🔁', name: 'Recydywa pokonana', desc: '10 poprawnych odpowiedzi na pytania, na których wcześniej był błąd', test: g => g.counters.fixed >= 10 },
  // Na pamięć
  { id: 'kodeks', cat: 'Na pamięć', icon: '📖', name: 'Kodeks w głowie', desc: 'Wszystkie ćwiczenia „Na pamięć” z talii ŚPB – ostatnia odpowiedź poprawna', test: () => { const m = DATA.items.filter(i => i.deck === 'spb' && (i.type === 'cloze' || i.type === 'order')); return m.length > 0 && m.every(i => state.hist[i.id] && state.hist[i.id].last === 'ok'); } },
  { id: 'zupp', cat: 'Na pamięć', icon: '🗣️', name: 'ZUPP', desc: '10 poprawnych odpowiedzi o samodzielnej decyzji funkcjonariusza (art. 35 ust. 2 pkt 10)', test: g => g.counters.zupp >= 10 },
  // Ukryte
  { id: 'alarm', cat: 'Ukryte', hidden: true, icon: '🚨', name: 'Alarm fałszywy', desc: 'Egzamin poniżej 20% – ale wróciłeś, to się liczy', test: () => state.exams.some(e => e.pct < 20) },
  { id: 'sowa', cat: 'Ukryte', hidden: true, icon: '🦉', name: 'Sowa penitencjarna', desc: '100 odpowiedzi między północą a 4:00', test: g => g.counters.owl >= 100 },
  { id: 'szczesciarz', cat: 'Ukryte', hidden: true, icon: '🎲', name: 'Szczęściarz', desc: 'Poprawna odpowiedź na pytanie, na którym wcześniej było 5 błędów', test: () => false },
];

const MILESTONES = [
  { id: 'baza25', icon: '🗂️', name: '25% bazy przerobione', test: () => coverage() >= 0.25 },
  { id: 'pierwszy', icon: '🎓', name: 'Pierwszy zdany egzamin', test: () => state.exams.some(e => e.pct >= 51) },
  { id: 'baza50', icon: '📚', name: '50% bazy przerobione', test: () => coverage() >= 0.5 },
  { id: 'dzialy75', icon: '📈', name: 'Wszystkie działy powyżej 75%', test: () => DATA.decks.every(d => { const a = deckAcc([d.id]); return a.n >= 10 && a.acc >= 0.75; }) },
  { id: 'gotowosc', icon: '🏁', name: 'Gotowość egzaminacyjna: 3 egzaminy z rzędu na 80%+', test: () => state.exams.length >= 3 && state.exams.slice(0, 3).every(e => e.pct >= 80) },
];

function coverage() {
  const n = DATA.items.length;
  return n ? DATA.items.filter(i => state.hist[i.id]).length / n : 0;
}

function unlock(id, silent) {
  const g = game();
  if (g.badges[id]) return false;
  g.badges[id] = Date.now();
  const b = BADGES.find(x => x.id === id);
  if (b && !silent) { toast(badgeImg(b.id, 40), 'Nowa odznaka: ' + b.name, b.desc); setTimeout(() => bielikPop('odznaka'), 3800); }
  return true;
}

// Sprawdza odznaki, kamienie milowe i stopień. Zwraca listę nowych odznak.
function evaluate(silent) {
  const g = game();
  const got = [];
  for (const b of BADGES) if (!g.badges[b.id] && b.test(g) && unlock(b.id, silent)) got.push(b.id);
  for (const m of MILESTONES) {
    if (g.milestones[m.id] || !m.test()) continue;
    g.milestones[m.id] = Date.now();
    if (!silent) toast(m.icon, 'Kamień milowy!', m.name);
  }
  const r = rankIndex(g.points);
  if (r > g.rank) {
    g.rank = r;
    if (!silent) promotion(r);
  }
  return got;
}

/* --- Powiadomienia --- */

function toast(icon, title, sub) {
  toastQueue.push({ icon, title, sub });
  if (!toastBusy) nextToast();
}

function nextToast() {
  const t = toastQueue.shift();
  if (!t) { toastBusy = false; return; }
  toastBusy = true;
  const el = h('div', { class: 'toast', role: 'status' },
    h('span', { class: 'toast-icon', 'aria-hidden': 'true' }, t.icon),
    h('div', {}, h('strong', {}, t.title), t.sub && h('div', { class: 'small' }, t.sub)));
  el.addEventListener('click', () => el.remove());
  document.body.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); nextToast(); }, 300); }, 3200);
}

function promotion(r) {
  const n = Object.keys(game().badges).length;
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'card modal-card' },
      h('div', { class: 'small muted' }, `Rozkaz personalny nr ${r}/${new Date().getFullYear()}`),
      h('div', { class: 'promo-pagon' }, pagon(r, 84)),
      h('p', {}, 'Za sumienne przygotowanie do służby mianuje się funkcjonariusza na stopień:'),
      h('div', { class: 'promo-rank' }, RANKS[r][1]),
      h('p', { class: 'small muted' }, `${game().points} pkt · ${n} ${plural(n, 'odznaka', 'odznaki', 'odznak')}`),
      bielikComment('awans', { stopien: RANKS[r][1] }) || '',
      btn('Melduję się!', 'primary', () => box.remove())));
  document.body.append(box);
  confetti();
}

/* --- Gotowość, tempo, kalendarz --- */

function readiness() {
  const since = Date.now() - 7 * 86400000;
  let sw = 0, sum = 0;
  for (const [key, w] of Object.entries(READY_WEIGHTS)) {
    const decks = key === 'psych' ? PSYCH_DECKS : [key];
    const items = DATA.items.filter(i => i.type === 'mcq' && decks.includes(i.deck));
    if (!items.length) continue;
    const recent = items.filter(i => state.hist[i.id] && state.hist[i.id].ts >= since);
    const acc = recent.length ? recent.filter(i => state.hist[i.id].last === 'ok').length / recent.length : 0;
    const cover = Math.min(1, recent.length / Math.min(10, items.length));
    sw += w;
    sum += w * acc * cover;
  }
  return sw ? Math.round((sum / sw) * 100) : 0;
}

function daysToExam() {
  const t = new Date(examDate() + 'T00:00:00');
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((t - now) / 86400000);
}

function suggestedPace() {
  const left = DATA.items.filter(i => !state.hist[i.id]).length;
  const d = Math.max(1, daysToExam());
  return Math.ceil(left / d);
}

/* --- Wyzwanie dnia --- */

// Losowanie powtarzalne dla danego „ziarna” (np. daty). Mocne mieszanie (xmur3 + mulberry32),
// żeby sąsiednie dni („…-18”, „…-19”) dawały zupełnie różne wyniki już od pierwszego losowania.
function seeded(seed) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  let a = (h ^= h >>> 16) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function challengeDeckFor(day, decks) {
  return decks[Math.floor(seeded('wyzwanie' + day)() * decks.length)];
}

function challengeToday() {
  const day = dayKey(new Date());
  const all = DATA.decks.filter(d => DATA.items.filter(i => i.deck === d.id && i.type === 'mcq').length >= CHALLENGE_SIZE);
  const sel = new Set(selectedDecks());
  const mine = all.filter(d => sel.has(d.id));
  const decks = mine.length >= 2 ? mine : all; // z wybranych tematów, gdy się da
  if (!decks.length) return null;
  // temat inny niż wczoraj
  const y = new Date(); y.setDate(y.getDate() - 1);
  const prev = challengeDeckFor(dayKey(y), decks);
  let deck = challengeDeckFor(day, decks);
  if (deck === prev && decks.length > 1) deck = challengeDeckFor(day + '+', decks.filter(d => d !== prev));
  const rnd = seeded('pytania' + day);
  const items = pickVariants(DATA.items.filter(i => i.deck === deck.id && i.type === 'mcq'), rnd);
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return { day, deck, items: items.slice(0, CHALLENGE_SIZE) };
}

function startChallenge() {
  const c = challengeToday();
  if (!c) return emptyScreen('Wyzwanie dnia', '📭', 'Brak pytań do wyzwania.');
  pointsMult = CHALLENGE_MULT;
  runSequence(`Wyzwanie dnia – ${c.deck.name}`, c.items, startChallenge, {
    celebrate: true,
    onFinish: s => {
      pointsMult = 1;
      const g = game();
      g.challenge[c.day] = Math.max(g.challenge[c.day] || 0, pct(s.ok, c.items.length));
      save();
    },
  });
}

/* --- Udostępnianie i kopia postępu --- */

function shareText() {
  const g = game();
  const best = state.exams.length ? Math.max(...state.exams.map(e => e.pct)) : null;
  const nb = Object.keys(g.badges).length;
  return `Nauka SW 🎖️ ${RANKS[g.rank][1]} · ${g.points} pkt · ${nb} ${plural(nb, 'odznaka', 'odznaki', 'odznak')}` +
    (best !== null ? ` · najlepszy egzamin ${best}%` : '') + ` · seria ${streakDays()} dni 🔥`;
}

async function shareResult() {
  const text = shareText();
  try {
    if (navigator.share) { await navigator.share({ text }); return; }
    await navigator.clipboard.writeText(text);
    toast('📋', 'Skopiowano wynik', 'Wklej go w wiadomości.');
  } catch (e) { /* anulowano */ }
}

function exportProgress() {
  const blob = new Blob([JSON.stringify({ app: 'nauka-sw', version: 1, date: new Date().toISOString(), state }, null, 1)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `nauka-sw-postep-${dayKey(new Date())}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function importProgress() {
  const inp = h('input', { type: 'file', accept: '.json,application/json' });
  inp.addEventListener('change', async () => {
    const f = inp.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const s = data && data.app === 'nauka-sw' ? data.state : data;
      if (!s || typeof s.hist !== 'object' || typeof s.boxes !== 'object') throw new Error('format');
      if (!confirm('Wczytać postęp z pliku? Obecny postęp na tym telefonie zostanie zastąpiony.')) return;
      state = { ...defaultState(), ...s, settings: { ...defaultState().settings, ...(s.settings || {}) } };
      exam = null;
      save();
      applyTheme();
      toast('✅', 'Postęp wczytany', `${RANKS[game().rank][1]} · ${game().points} pkt`);
      route();
    } catch (e) {
      alert('To nie jest plik z postępem aplikacji Nauka SW.');
    }
  });
  inp.click();
}

/* --- Motyw --- */

function applyTheme() {
  const t = state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#0f1722' : '#1f3a5f'));
}

/* --- Ekran startowy: karta służby --- */

/* --- Teczka osobowa --- */

function renderTeczka() {
  screen('Teczka osobowa', false);
  const g = game();
  const r = g.rank, next = RANKS[r + 1];
  const nb = Object.keys(g.badges).length;

  // Stopień i statystyki
  $app.append(h('section', { class: 'card teczka-head' },
    h('div', { class: 'th-row' }, pagon(r, 72),
      h('div', { class: 'th-main' },
        h('div', { class: 'th-label' }, 'Stopień'),
        h('div', { class: 'promo-rank' }, RANKS[r][1]),
        h('div', { class: 'small muted' }, `${g.points} pkt` + (next ? ` · następny: ${next[1]} (${next[0]} pkt)` : '')))),
    h('div', { class: 'xp', style: 'margin:12px 0' }, h('i', { style: `width:${next ? Math.round(((g.points - RANKS[r][0]) / (next[0] - RANKS[r][0])) * 100) : 100}%` })),
    h('div', { class: 'stats' },
      stat('flame', streakDays(), 'dni z rzędu'),
      stat('medal', `${nb}/${BADGES.length}`, 'odznak'),
      stat('pen', g.counters.answers, 'odpowiedzi'),
      stat('target', readiness() + '%', 'gotowość')),
    h('button', { type: 'button', class: 'btn', onclick: shareResult }, icon('share', 20), 'Udostępnij wynik')));
  $app.append(accuracyChart());

  // Ustawienia nauki
  const dateInp = h('input', { type: 'date', value: examDate(), class: 'date', onchange: e => { state.settings.examDate = e.target.value || null; save(); renderTeczka(); } });
  $app.append(h('section', { class: 'card' },
    h('h2', { style: 'margin-top:0' }, 'Egzamin i cel'),
    h('label', { class: 'field' }, h('span', {}, 'Data egzaminu'), dateInp),
    h('p', { class: 'small muted', style: 'margin:6px 0 12px' }, daysToExam() >= 0
      ? `Zostało ${daysToExam()} ${plural(daysToExam(), 'dzień', 'dni', 'dni')}. Nieprzerobionych pozycji: ${DATA.items.filter(i => !state.hist[i.id]).length} – proponowane tempo: ok. ${suggestedPace()} nowych dziennie.`
      : 'Data egzaminu minęła – ustaw nową.'),
    h('div', { class: 'small muted' }, 'Dzienny cel (odpowiedzi):'),
    sizePicker(DAILY_GOALS, dailyGoal(), v => { state.settings.dailyGoal = v; save(); renderTeczka(); })));

  // Kamienie milowe
  $app.append(h('section', { class: 'card' },
    h('h2', { style: 'margin-top:0' }, 'Kamienie milowe'),
    h('ol', { class: 'timeline' }, MILESTONES.map(m => h('li', { class: g.milestones[m.id] ? 'done' : '' },
      h('span', { class: 'tl-dot' }, g.milestones[m.id] ? '✓' : m.icon),
      h('span', {}, m.name, g.milestones[m.id] && h('span', { class: 'small muted' }, ' · ' + new Date(g.milestones[m.id]).toLocaleDateString('pl-PL'))))))));

  // Kalendarz – ostatnie 5 tygodni
  const cal = h('div', { class: 'cal' });
  const start = new Date(); start.setHours(12, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7) - 28); // poniedziałek 4 tygodnie temu
  ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'].forEach(d => cal.append(h('span', { class: 'cal-h' }, d)));
  for (let i = 0; i < 35; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const n = g.days[dayKey(d)] || 0;
    const lvl = n === 0 ? 0 : n < 20 ? 1 : n < 50 ? 2 : n < 100 ? 3 : 4;
    const future = d > new Date();
    cal.append(h('span', { class: `cal-d l${lvl}` + (future ? ' future' : '') + (dayKey(d) === dayKey(new Date()) ? ' today' : ''), title: `${d.toLocaleDateString('pl-PL')}: ${n} odpowiedzi` }, d.getDate()));
  }
  $app.append(h('section', { class: 'card' }, h('h2', { style: 'margin-top:0' }, 'Kalendarz nauki'), cal));

  // Odznaki
  const cats = [...new Set(BADGES.map(b => b.cat))];
  const sec = h('section', { class: 'card' }, h('h2', { class: 'card-h' }, icon('medal', 20), 'Odznaki', h('span', { class: 'count' }, `${nb} z ${BADGES.length}`)),
    h('p', { class: 'small muted', style: 'margin:0 0 4px' }, 'Dotknij odznaki, żeby zobaczyć, za co jest.'));
  for (const c of cats) {
    sec.append(h('h3', { class: 'badge-cat' }, c));
    sec.append(h('div', { class: 'badges' }, BADGES.filter(b => b.cat === c).map(b => {
      const got = g.badges[b.id];
      const secret = b.hidden && !got;
      const img = secret ? h('span', { class: 'badge-secret', 'aria-hidden': 'true' }, '?') : badgeImg(b.id, 64, !got);
      return h('button', { type: 'button', class: 'badge' + (got ? ' got' : ''), 'aria-label': secret ? 'Odznaka ukryta' : `${b.name}${got ? ' – zdobyta' : ' – jeszcze nie zdobyta'}`,
        onclick: () => toast(secret ? '❓' : badgeImg(b.id, 40, !got), secret ? 'Odznaka ukryta' : b.name,
          secret ? 'Odkryjesz ją, gdy ją zdobędziesz.' : (got ? `Zdobyta ${new Date(got).toLocaleDateString('pl-PL')} · ` : '') + b.desc) },
        h('span', { class: 'badge-pic' }, img, !got && !secret ? icon('lock', 14, 'badge-lock') : null),
        h('span', { class: 'badge-name' }, secret ? '???' : b.name));
    })));
  }
  $app.append(sec);

  // Punktacja
  $app.append(h('section', { class: 'card small' },
    h('h2', { style: 'margin-top:0' }, 'Jak zdobywać punkty'),
    h('ul', {},
      h('li', {}, `Poprawna odpowiedź w teście: +${POINTS.mcq}`),
      h('li', {}, `Fiszka „Wiem”: +${POINTS.flashcard}`),
      h('li', {}, `Ćwiczenie „Na pamięć”: +${POINTS.cloze}`),
      h('li', {}, `Kazus: +${POINTS.caseStep} za każdy dobry krok · Dopasuj pary: +${POINTS.pair} za każdą dobrą parę`),
      h('li', {}, `Sprint 60 s: ok. +${Math.round(POINTS.mcq * 0.6)} za dobrą odpowiedź · Słuchaj: bez punktów`),
      h('li', {}, `Poprawiony wcześniejszy błąd: co najmniej +${POINTS.fixed}`),
      h('li', {}, `Od ${STREAK_FROM}. dobrej odpowiedzi z rzędu: punkty ×${String(STREAK_MULT).replace('.', ',')}`),
      h('li', {}, `Wyzwanie dnia: punkty ×${CHALLENGE_MULT}`),
      h('li', {}, `Dzienny cel: +${POINTS.dailyGoal} · egzamin zdany: +${POINTS.examPass} · egzamin 91%+: +${POINTS.examTop}`)),
    h('h3', {}, 'Stopnie'),
    h('div', { class: 'ranks' }, RANKS.map(([p, n], i) => h('div', { class: i === r ? 'on' : i < r ? 'past' : '' }, pagon(i, 30), h('span', { class: 'rank-n' }, n), h('span', { class: 'muted' }, `${p} pkt`))))));

  $app.append(h('p', { class: 'small muted', style: 'text-align:center' }, 'Wygląd, kopia postępu i historia zmian: ⚙️ w nagłówku.'));
}

function stat(ic, value, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, icon(ic, 18), String(value)), h('div', { class: 'small muted' }, label));
}

function sizeLikePicker(pairs, current, onPick) {
  return h('div', { class: 'seg', role: 'radiogroup' }, pairs.map(([v, label]) =>
    h('button', { type: 'button', role: 'radio', class: v === current ? 'on' : '', 'aria-checked': String(v === current), onclick: () => onPick(v) }, label)));
}


/* ---------- Co nowego (po aktualizacji) ---------- */

// Przy każdej aktualizacji: dopisz wpis NA POCZĄTKU listy, z numerem = numer CACHE w service-worker.js.
const CHANGELOG = [
  { v: 31, date: '18.11.2026', items: [
    '🎨 Nowy wygląd: przejrzysty ekran Nauka – karta ze stopniem, celem dnia i Bielikiem na tle wieżyczki, duży przycisk Egzaminu próbnego, kafelki i rząd „Więcej trybów”.',
    '🪖 Chorąży Bielik nosi furażerkę Służby Więziennej, a stopnie mają pagony w barwach SW (od szeregowego do pułkownika).',
    '🏅 Nowe obrazki wszystkich 36 odznak i wykres „Skuteczność w tematach” w Teczce.',
    '🎮 Zapowiedź gry fabularnej „Pierwsza służba” – już wkrótce.'] },
  { v: 30, date: '18.11.2026', items: [
    '💰 Milionerzy – 12 pytań coraz trudniejszych, progi gwarantowane i koła ratunkowe: 50:50, Zapytaj Bielika i Pytanie do publiczności (prawdziwe wyniki kursantów).',
    '👆 Prawda czy fałsz – przesuwaj karty: w prawo prawda, w lewo fałsz.',
    '🏛️ Kto co robi – pytania o kompetencje organów i ściągawka „kto co robi”.',
    '🔎 Szukaj – wyszukiwarka we wszystkich pytaniach, z możliwością przećwiczenia znalezionych.',
    '🦅 Bielik: rozkazy dnia (3 zadania, punkty za wykonanie), musztra znienacka (pytanie w dymku) i pamięć słabych punktów – wytyka, co ci się myli.'] },
  { v: 29, date: '18.11.2026', items: [
    '➕ Kolejne 22 pytania od kursantów (penitencjarystyka, ochrona, pragmatyka, prawo) – razem 122.'] },
  { v: 28, date: '18.11.2026', items: [
    '➕ „Pytania od kursantów” rozbudowane do 100 pytań – doszły m.in. KPA i zagadnienia prawne, ŚPB, bezpieczeństwo i quiz z prawa.'] },
  { v: 27, date: '18.11.2026', items: [
    '📝 Nowy temat „Test komendancki (przykładowy egzamin)” – 147 pytań z przykładowego testu komendanckiego.',
    'Temat „Pragmatyka służbowa” powiększony o 56 pytań z testu z pragmatyki (COSSW Kule).',
    'Nowy temat „Pytania od kursantów” – 36 pytań z modułów (prawo, penitencjarystyka, bezpieczeństwo, ochrona, ŚPB).'] },
  { v: 26, date: '17.11.2026', items: [
    '📘 Nowy skrypt w zakładce Czytaj: „Penitencjarny” – Zagadnienia penitencjarne (Kule 2026), 8 rozdziałów.',
    'Nowy temat „Zagadnienia penitencjarne (prezentacja)”: 43 pytania, 9 fiszek, 6 kazusów i 4 zestawy par – klasyfikacja, komisja i sędzia penitencjarny, rozmieszczanie skazanych i tymczasowo aresztowanych.'] },
  { v: 25, date: '16.11.2026', items: [
    '🎯 Zachowanie na strzelnicy – kolejność komend na górze skryptu „GLOCK 17” w Czytaj.',
    'Nowe w temacie GLOCK 17: 10 pytań, fiszka i układanka „ułóż w kolejności” o przebiegu strzelania.'] },
  { v: 24, date: '16.11.2026', items: [
    '🔫 Nowy skrypt w zakładce Czytaj: „GLOCK 17” – cała instrukcja obsługi pistoletu z rysunkami (Safe Action, budowa, rozkładanie, celowanie, zacięcia).',
    'Nowy temat „Pistolet GLOCK 17 (prezentacja)”: 36 pytań, 7 fiszek i 4 zestawy par – w tym pytania z rysunkiem („co oznaczono numerem…?”).'] },
  { v: 23, date: '12.11.2026', items: [
    '🦅 Chorąży Bielik melduje się na służbie! Chwali, docina, przewraca oczami i pilnuje serii.',
    'Powiadomienia od Bielika – włączysz w ⚙️ i wybierzesz godzinę (na iPhonie z ikony na ekranie początkowym).',
    'Punkty: kazus +7 za każdy dobry krok, pary +2 za każdą dobrą parę, poprawa błędu nigdy mniej niż zwykła odpowiedź.'] },
  { v: 22, date: '12.11.2026', items: [
    'Poprawione pytania z dopiskiem „wg wykładu” / „z materiałów kursu” – teraz są zrozumiałe bez znajomości wykładu (dzięki za zgłoszenie!).'] },
  { v: 21, date: '12.11.2026', items: [
    '⚖️ Kazusy – 21 sytuacji ze służby, krok po kroku (ŚPB, ochrona, KKW, stanowiska, pierwsza pomoc, psychologia).',
    '🧩 Dopasuj pary – 15 zestawów: terminy, limity, kto co nadaje, pierwsza pomoc.',
    '⏱️ Sprint 60 s z rekordem i 🎧 Słuchaj – fiszki czytane na głos.',
    '⚑ Zgłoś błąd przy każdym pytaniu. Anonimowe statystyki pytań (wyłączysz w ⚙️).'] },
  { v: 20, date: '12.11.2026', items: [
    'Przy pierwszym uruchomieniu, po „Rozkaz!”, aplikacja proponuje wczytanie postępu ze starej strony.'] },
  { v: 19, date: '12.11.2026', items: [
    'Witaj pod nowym adresem! Jeśli masz plik z postępem ze starej strony, wczytaj go: ⚙️ → Importuj.',
    'Stara strona pokazuje już tylko informację o przeprowadzce i przycisk do zapisania postępu.'] },
  { v: 18, date: '12.11.2026', items: [
    'Aplikacja wkrótce przeniesie się pod nowy adres, dostępny po wpisaniu kodu. Szczegóły i kod dostaniesz od twórcy.',
    'Już teraz zrób kopię postępu: ⚙️ → Eksportuj. Na nowej stronie wczytasz ją przez ⚙️ → Importuj.'] },
  { v: 17, date: '10.11.2026', items: [
    'Nowy przycisk „?” obok INFO – instrukcja obsługi: wybór tematów, wszystkie tryby, punkty, Teczka, kopia postępu.'] },
  { v: 16, date: '10.11.2026', items: [
    'Poprawione pytanie o bierny opór i kajdanki: jaśniejsza treść i wyjaśnienie, dlaczego w praktyce kajdanki i tak się zakłada (na innej podstawie).',
    'Nowa fiszka: jakich ŚPB nie wolno użyć przy biernym oporze.'] },
  { v: 15, date: '10.11.2026', items: [
    '⚙️ Ustawienia – trybik obok INFO: motyw, kopia postępu i historia zmian.',
    'Tematy na ekranie Nauka są teraz rozwijane, z przyciskami „Zaznacz/Odznacz wszystkie”.',
    'Nowe talie: „Umundurowanie i należności mundurowe” oraz „Historia więziennictwa i standardy” (ERW).',
    'Pragmatyka: ceremoniał, czas służby, podróże, urlopy, nagrody, stopnie – 47 nowych fiszek łącznie.',
    'Ponad 30 pytań z przeczeniem („NIE”, „fałszywe”) i 16 pytań sformułowanych inaczej.'] },
  { v: 14, date: '10.11.2026', items: [
    'Okno „Co nowego” – po każdej aktualizacji zobaczysz krótko, co się zmieniło.',
    'Historia zmian jest też w Teczce, na samym dole.'] },
  { v: 13, date: '10.11.2026', items: [
    'Czytaj → nowy skrypt „Stanowiska”: zadania bramowego, monitorowego, wartownika, spacerowego, widzeniowego, dozorującego zatrudnienie i innych (zarządzenie 30/25).',
    'Ściągawka: kto pełni służbę, co ile zmiana (2 h / 4 h), komendy wartownika, apel.',
    'Nowa talia „Stanowiska ochronne” i uzupełniona Ochrona – 95 pytań i fiszek.'] },
  { v: 12, date: '10.11.2026', items: [
    'Okno startowe i żółty przycisk INFO w nagłówku.',
    'Stopnie aż do pułkownika.',
    'Na pamięć → Wybierz: kliknięcie w lukę rozwija listę słów.'] },
  { v: 11, date: '10.11.2026', items: [
    'Punkty, stopnie, odznaki, kamienie milowe i wyzwanie dnia.',
    'Nowa zakładka Teczka, motyw jasny/ciemny, kopia postępu.',
    'Pytania w różnych formach i tryb „Wybierz” w Na pamięć.'] },
];
const APP_VERSION = CHANGELOG[0].v;
const FIRST_TRACKED_VERSION = 12; // kto już widział okno startowe, a nie ma zapisanej wersji – zobaczy zmiany od v13

function changelogBox(entries, title) {
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'changes-title' },
    h('div', { class: 'card modal-card changes-card' },
      h('div', { class: 'verdict-icon', 'aria-hidden': 'true' }, '📰'),
      h('h2', { id: 'changes-title' }, title),
      entries.map(e => h('section', { class: 'changes-entry' },
        h('div', { class: 'small muted' }, `Wersja ${e.v} · ${e.date}`),
        h('ul', {}, e.items.map(t => h('li', {}, t))))),
      btn('Przyjąłem', 'primary', () => box.remove())));
  document.body.append(box);
}

function showChangesIfNew() {
  const seen = state.settings.lastSeenVersion || FIRST_TRACKED_VERSION;
  state.settings.lastSeenVersion = APP_VERSION;
  save();
  const fresh = CHANGELOG.filter(e => e.v > seen).slice(0, 3);
  if (fresh.length) changelogBox(fresh, 'Co nowego?');
}

function showSettings() {
  document.querySelector('.modal.settings')?.remove();
  const box = h('div', { class: 'modal settings', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'settings-title' });
  const close = () => box.remove();
  box.addEventListener('click', e => { if (e.target === box) close(); });
  box.append(h('div', { class: 'card modal-card settings-card' },
    h('div', { class: 'settings-head' }, h('h2', { id: 'settings-title' }, '⚙️ Ustawienia'),
      h('button', { type: 'button', class: 'close-x', 'aria-label': 'Zamknij', onclick: close }, '✕')),
    h('h3', {}, 'Wygląd'),
    sizeLikePicker([['auto', 'Auto'], ['light', '☀️ Jasny'], ['dark', '🌙 Ciemny']], state.settings.theme || 'auto', v => {
      state.settings.theme = v === 'auto' ? null : v; save(); applyTheme(); showSettings();
    }),
    ...bielikSettings(),
    h('h3', {}, 'Historia zmian'),
    h('p', { class: 'small muted', style: 'margin-top:0' }, `Wersja aplikacji: ${APP_VERSION}`),
    btn('📰 Pokaż historię zmian', '', () => { close(); showChangelog(); }),
    HAS_SERVER && h('h3', {}, 'Statystyki pytań'),
    HAS_SERVER && h('label', { class: 'switch' },
      h('span', {}, 'Wysyłaj anonimowe statystyki'),
      h('input', { type: 'checkbox', role: 'switch', checked: state.settings.stats !== false, onchange: e => { state.settings.stats = e.target.checked; save(); } })),
    HAS_SERVER && h('p', { class: 'small muted', style: 'margin-top:4px' }, 'Co kilka godzin aplikacja wysyła tylko liczniki: które pytania ile razy rozwiązano i ile razy źle. Bez imienia, kodu i punktów. Dzięki temu twórca widzi, które pytania sprawiają najwięcej kłopotu, i może je poprawić albo omówić.'),
    h('h3', {}, 'Kopia postępu'),
    h('p', { class: 'small muted', style: 'margin-top:0' }, 'Zapisz postęp do pliku, żeby przenieść go na inny telefon albo nie stracić go po wyczyszczeniu przeglądarki.'),
    h('div', { class: 'row' }, btn('💾 Eksportuj', '', exportProgress), btn('📂 Importuj', '', () => { close(); importProgress(); })),
    btn('Zamknij', 'primary', close)));
  document.body.append(box);
}

function showChangelog() {
  changelogBox(CHANGELOG, 'Historia zmian');
}

/* ---------- Przeprowadzka (stary adres) ---------- */

function showMoving() {
  ['back', 'info', 'help', 'settings', 'timer'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
  document.querySelector('.tabbar')?.setAttribute('hidden', '');
  document.getElementById('title').textContent = 'Nauka SW';
  const answered = Object.keys(state.hist || {}).length;
  const exams = (state.exams || []).length;
  const done = h('p', { class: 'moving-done', hidden: true }, '✅ Zapisane. Plik „nauka-sw-postep-….json” jest w folderze Pobrane (na iPhonie: aplikacja Pliki → Pobrane).');
  const saveBtn = btn('💾 Zapisz kopię postępu', 'primary moving-save', () => { exportProgress(); done.hidden = false; });
  const fileOf = () => new File([JSON.stringify({ app: 'nauka-sw', version: 1, date: new Date().toISOString(), state }, null, 1)],
    `nauka-sw-postep-${dayKey(new Date())}.json`, { type: 'application/json' });
  let shareBtn = null;
  try {
    if (navigator.canShare && navigator.canShare({ files: [fileOf()] })) {
      shareBtn = btn('📤 Wyślij plik (np. sobie na WhatsApp)', 'ghost', async () => {
        try { await navigator.share({ files: [fileOf()], title: 'Nauka SW – postęp' }); done.hidden = false; } catch (e) { /* anulowano */ }
      });
    }
  } catch (e) { /* brak udostępniania plików */ }
  const step = (b, t) => h('li', {}, h('strong', {}, b), ' ', t);
  $app.replaceChildren(h('section', { class: 'card moving' },
    h('div', { class: 'moving-ico', 'aria-hidden': 'true' }, '🚚'),
    h('h2', {}, 'Aplikacja zmieniła adres'),
    h('p', {}, 'Nauka SW działa teraz pod nowym adresem, z kodem dostępu. Tutaj możesz już tylko zapisać swój postęp i przenieść go na nową stronę.'),
    h('div', { class: 'moving-stats' }, answered || exams
      ? `Twój postęp na tym urządzeniu: ${answered} ${plural(answered, 'przerobione pytanie', 'przerobione pytania', 'przerobionych pytań')}, ${exams} ${plural(exams, 'egzamin próbny', 'egzaminy próbne', 'egzaminów próbnych')}.`
      : 'Na tym urządzeniu nie ma zapisanego postępu – możesz od razu przejść na nową stronę (krok 2).'),
    answered || exams ? saveBtn : null,
    answered || exams ? shareBtn : null,
    done,
    h('h3', {}, 'Jak przejść na nową stronę'),
    h('ol', { class: 'moving-steps' },
      step('Zapisz kopię postępu', '– przycisk powyżej. Zrób to, zanim stara strona zniknie.'),
      step('Link i kod dostępu', 'znajdziesz na grupie WhatsApp. Nie masz? Napisz do twórcy aplikacji.'),
      step('Otwórz nowy link.', 'iPhone: najpierw Udostępnij → „Do ekranu początkowego” i kod wpisz już w tej ikonie. Android (Chrome): menu ⋮ → „Dodaj do ekranu głównego”.'),
      step('Wpisz kod', '– tylko raz na tym urządzeniu. Nie przekazuj go innym: działa na ograniczonej liczbie urządzeń.'),
      step('Wczytaj postęp:', 'na nowej stronie ⚙️ (trybik w nagłówku) → Importuj → wybierz zapisany plik. Wrócą stopień, punkty, odznaki i powtórki fiszek.'),
      step('Usuń starą ikonę', 'z ekranu telefonu, żeby się nie myliła z nową.')),
    h('p', { class: 'small muted' }, 'Ta strona zostanie wkrótce wyłączona.')));
}

/* ---------- Instrukcja obsługi (przycisk „?”) ---------- */

function showManual() {
  if (document.querySelector('.modal.manual')) return;
  const box = h('div', { class: 'modal manual', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'manual-title' });
  const close = () => box.remove();
  const li = (b, t) => h('li', {}, b ? h('strong', {}, b) : null, b ? ' – ' : null, t);
  const sec = (title, ...items) => h('details', { class: 'manual-sec' }, h('summary', {}, title), h('ul', {}, items));
  box.append(h('div', { class: 'card modal-card manual-card' },
    h('div', { class: 'settings-head' }, h('h2', { id: 'manual-title' }, '📖 Instrukcja obsługi'),
      h('button', { type: 'button', class: 'close-x', 'aria-label': 'Zamknij', onclick: close }, '✕')),
    h('p', { class: 'small muted' }, 'Kliknij nagłówek, żeby go rozwinąć.'),

    h('details', { class: 'manual-sec', open: '' }, h('summary', {}, '🎯 Najpierw: wybór tematów'),
      h('p', {}, 'Na ekranie ', h('strong', {}, 'Nauka'), ', pod przyciskami trybów, jest rozwijana lista ', h('strong', {}, '„Tematy”'),
        '. Każdy temat to osobna talia fiszek i pytań z jednego działu (np. KKW, Ochrona, Psycholog). Liczba obok nazwy mówi, ile w nim jest pozycji.'),
      h('ul', {},
        li('Co od tego zależy', 'zaznaczone tematy decydują, co dostajesz w Fiszkach, w Na pamięć i w Teście → „Wybrane talie”. Odznaczony temat po prostu się nie pojawia.'),
        li('Co od tego NIE zależy', 'Test → Unitarny / Specjalistyczny bierze zawsze całą swoją część, a Trudne – błędy ze wszystkich tematów. Egzamin próbny ma własny wybór talii na swoim ekranie.'),
        li('Szybkie przyciski', '„Zaznacz wszystkie” / „Odznacz wszystkie”, a przy każdej części („unitarna”, „specjalistyczna”) link zaznacz/odznacz – np. odznacz psychologię, gdy ćwiczysz tylko część unitarną.'),
        li('Pasek', 'pokazuje, ile tematów masz wybranych („4 z 15 wybranych”). Gdy odznaczysz wszystko, tryby nauki zrobią się szare.'),
        li('„Tylko na pamięć”', 'zawęża Fiszki, Na pamięć i „Wybrane talie” do rzeczy, które trzeba umieć dosłownie: cytaty przepisów, wyliczenia, terminy.'),
        li('Nowe tematy', 'dodane w aktualizacji włączają się same.'),
        li('Jak z tego korzystać', 'w tygodniu 1–3 tematy dziennie, żeby wejść w szczegóły; raz w tygodniu wszystkie naraz, żeby sprawdzić całość.'))),

    sec('🃏 Fiszki',
      li('', 'Sesja to do 20 kart. Najpierw odpowiedz w głowie, potem „Pokaż odpowiedź” i oceń się uczciwie.'),
      li('Nie wiem', 'karta wraca do pudełka 1 i pojawi się jeszcze dziś.'),
      li('Prawie', 'karta zostaje w swoim pudełku.'),
      li('Wiem', 'karta idzie pudełko wyżej. Pudełko 2 wraca po 1 dniu, 3 – po 3 dniach, 4 – po 7, 5 – po 14.'),
      li('', 'Fiszki pokazują tylko karty, których termin powtórki minął. Gdy wszystko powtórzone – „Powtarzaj mimo to”.'),
      li('Opanowana', 'karta w pudełku 4 lub 5. Postęp każdego tematu widać w „Postęp fiszek” na dole ekranu Nauka.')),

    sec('📝 Test',
      li('', 'Wybierz liczbę pytań (30 / 40 / 50 / Wszystkie) i część: Unitarny (wiedza ogólna), Specjalistyczny (psychologia) albo Wybrane talie (z listy Tematy).'),
      li('', 'Po każdej odpowiedzi od razu widzisz, czy dobrze, wyjaśnienie i źródło (artykuł, zarządzenie).'),
      li('Różne formy pytań', 'zwykłe, „Który NIE…”, „Wskaż zdanie fałszywe”, „Prawda czy fałsz”. To samo zagadnienie może wrócić inaczej sformułowane – czytaj uważnie, szczególnie słowa NIE i FAŁSZYWE.'),
      li('', 'Na końcu: ocena wyniku i lista błędów do przejrzenia.')),

    sec('✍️ Na pamięć',
      li('Luki', 'tekst przepisu z brakującymi słowami. Przełącznik u góry: „✍️ Wpisz” (piszesz sam) albo „👆 Wybierz” (klikasz w lukę i wybierasz słowo z listy).'),
      li('Kolejność', 'ułóż kroki procedury przyciskami ▲ ▼.'),
      li('', '„Sprawdź” pokazuje wynik, „Pokaż odpowiedź” – gdy nie masz pomysłu (liczy się jako błąd).')),

    sec('⚖️ Kazusy, 🧩 Pary, ⏱️ Sprint, 🎧 Słuchaj',
      li('Kazusy', 'sytuacja ze służby i 2–3 pytania krok po kroku: co to za przesłanka, czego wolno użyć, co dalej. Uczy stosowania przepisów, nie tylko ich pamiętania.'),
      li('Dopasuj pary', 'dotknij pozycji po lewej, potem pasującej po prawej. Błędna para mignie na czerwono. 5 par w zestawie.'),
      li('Sprint 60 s', 'ile poprawnych odpowiedzi zdążysz dać w minutę. Bez wyjaśnień – pomyłki zobaczysz na końcu. Aplikacja pamięta Twój rekord.'),
      li('Słuchaj', 'telefon czyta fiszki na głos: pytanie, chwila na odpowiedź w myślach, odpowiedź. Ustawisz czas na zastanowienie i tempo lektora. Dobre w drodze lub na spacerze.'),
      li('', 'Wszystkie te tryby biorą pytania z zaznaczonych tematów. Błędy trafiają do „Trudnych”.')),

    sec('💰 Milionerzy, 👆 Prawda czy fałsz, 🏛️ Kto co robi, 🔎 Szukaj',
      li('Milionerzy', '12 pytań od łatwych do trudnych (trudność liczona z wyników całego kursu). Progi gwarantowane: 1 000 zł i 40 000 zł. Koła ratunkowe: 50:50, Zapytaj Bielika (zwykle ma rację… zwykle) i Pytanie do publiczności – procenty pokazują, jak naprawdę odpowiadali kursanci (gdy jest mało danych – symulacja). Za milion +100 pkt.'),
      li('Prawda czy fałsz', '20 kart: pytanie i podana odpowiedź. Przesuń w prawo, jeśli prawda, w lewo – jeśli fałsz (albo przyciski). Pomyłka pokazuje poprawną odpowiedź.'),
      li('Kto co robi', 'pytania o kompetencje: kto powołuje, nadaje stopnie, wymierza kary, klasyfikuje, udziela zgody. Zakładka „Ściągawka” zbiera wszystkie kompetencje z bazy pogrupowane według organu.'),
      li('Szukaj', 'wpisz frazę (np. „cela izolacyjna”, „14 dni”) – dostaniesz wszystkie pytania ze wszystkich tematów z odpowiedziami. Przycisk „Ćwicz znalezione” robi z nich test.')),

    sec('🦅 Chorąży Bielik',
      li('', 'Maskotka na ekranie Nauka. Komentuje Twoją naukę: serię dni, cel dzienny, odliczanie do egzaminu, najsłabszy temat. W trakcie nauki wtrąca się po serii dobrych lub złych odpowiedzi, a pod wynikami ocenia, jak poszło.'),
      li('Nastroje', 'dumny, zadowolony, czujny, znudzony (przewraca oczami), groźny i wściekły – zależnie od tego, jak się uczysz. Stuknij go, jeśli masz odwagę.'),
      li('Rozkazy dnia', 'karta pod stopniem na ekranie Nauka: codziennie 3 zadania (np. temat, w którym masz najwięcej błędów, poprawa Trudnych, jeden z trybów). Za każdy +15 pkt, za komplet dodatkowo +30. Dotknij rozkazu, żeby od razu zacząć.'),
      li('Musztra znienacka', 'czasem, gdy wchodzisz na ekran Nauka, Bielik zadaje jedno pytanie w dymku – najczęściej takie, na którym wcześniej był błąd. Dobra odpowiedź: +10 pkt premii. Można pominąć albo wyłączyć w ⚙️.'),
      li('Słabe punkty', 'Bielik zapamiętuje, co ci się myli: organy (np. komisja penitencjarna ↔ sędzia penitencjarny), liczby i terminy, pytania oblane kilka razy – i wytyka to w dymkach. Do musztry wybiera właśnie te pytania.'),
      li('Ustawienia (⚙️)', 'możesz go ukryć, złagodzić język albo włączyć powiadomienia z wybraną godziną. Na iPhonie powiadomienia działają tylko z ikony na ekranie początkowym.')),

    sec('⚑ Zgłoś błąd',
      li('', 'Przy każdym pytaniu i fiszce jest przycisk „⚑ Zgłoś błąd”. Wybierz rodzaj błędu, opisz krótko i wyślij – zgłoszenie trafia do twórcy.'),
      li('Statystyki', 'aplikacja co kilka godzin wysyła anonimowe liczniki (które pytania sprawiają kłopot). Wyłączysz to w ⚙️.')),

    sec('⏱️ Egzamin próbny',
      li('', '30 / 40 / 50 losowych pytań, 1 minuta na pytanie; zegar widać w nagłówku.'),
      li('', 'Odpowiedzi i wynik poznasz dopiero na końcu – jak na prawdziwym egzaminie. Możesz wracać do pytań („‹ Wstecz”) i zakończyć wcześniej.'),
      li('', 'Talie wybierasz na ekranie egzaminu. Gdy wyjdziesz w trakcie, egzamin dalej trwa – wróć przyciskiem na ekranie Nauka.'),
      li('', 'Od 51% aplikacja uznaje egzamin za zdany (odznaki, punkty). To próg aplikacji, nie oficjalny.')),

    sec('⚠️ Trudne',
      li('', 'Wszystko, na czym ostatnio się pomyliłeś – ze wszystkich tematów. Dobra odpowiedź zdejmuje pytanie z listy (i daje dodatkowe punkty za poprawę).')),

    sec('📚 Czytaj',
      li('', 'Skrypty: Część unitarna, Psycholog, Stanowiska, GLOCK 17, Penitencjarny – przełączasz zakładkami u góry.'),
      li('Spis treści', 'rozwijany; klik przenosi do rozdziału.'),
      li('Wyszukiwarka', 'wpisz słowo, strzałki ↑ ↓ przeskakują między trafieniami. Zaznacz „Szukaj we wszystkich skryptach”, żeby szukać wszędzie.'),
      li('', 'Aplikacja pamięta, gdzie skończyłeś czytać.')),

    sec('🗂️ Teczka i punkty',
      li('Stopień', 'od szeregowego do pułkownika – rośnie z punktami. Punkty: test +' + POINTS.mcq + ', fiszka „Wiem” +' + POINTS.flashcard + ', Na pamięć +' + POINTS.cloze + ', kazus +' + POINTS.caseStep + ' za każdy dobry krok, pary +' + POINTS.pair + ' za każdą dobrą parę, sprint ok. +4, poprawiony błąd co najmniej +' + POINTS.fixed + '; od 5. dobrej odpowiedzi z rzędu ×1,5. Słuchaj – bez punktów.'),
      li('Wyzwanie dnia', '10 pytań z jednego tematu, punkty ×2. Przycisk na karcie służby na ekranie Nauka.'),
      li('Gotowość %', 'trafność z ostatnich 7 dni we wszystkich działach, pomnożona przez to, ile pytań z każdego działu przerobiłeś. Rośnie, gdy ćwiczysz wszystko, a nie jeden temat.'),
      li('Data egzaminu i dzienny cel', 'ustawiasz w Teczce (cel: 20 / 50 / 100 odpowiedzi dziennie).'),
      li('', 'Seria dni, kalendarz nauki, kamienie milowe, odznaki (część jest ukryta) i „Udostępnij wynik”.')),

    sec('⚙️ Ustawienia i przyciski w nagłówku',
      li('INFO', 'okno powitalne.'),
      li('?', 'ta instrukcja.'),
      li('⚙️', 'motyw jasny/ciemny, kopia postępu (eksport do pliku i import) oraz historia zmian.')),

    sec('💡 Ważne',
      li('Postęp', 'zapisuje się tylko w tym telefonie i tej przeglądarce. Każdy telefon ma swój, niezależny postęp. Wyczyszczenie danych przeglądarki kasuje postęp – dlatego co jakiś czas zrób kopię (⚙️ → Eksportuj).'),
      li('Aktualizacje', 'gdy pojawi się pasek „Jest nowa wersja”, kliknij „Odśwież”. Potem zobaczysz, co się zmieniło.'),
      li('Jak aplikacja', 'Android (Chrome): menu ⋮ → „Dodaj do ekranu głównego” / „Zainstaluj aplikację”. iPhone (Safari): Udostępnij → „Do ekranu początkowego”. Po pierwszym otwarciu działa też bez internetu.'),
      li('Reset', '„Resetuj postęp” na samym dole ekranu Nauka kasuje wszystko – nie da się tego cofnąć.'),
      li('Błąd w pytaniu?', 'daj znać twórcy. W razie sporu wygrywa aktualny tekst przepisów.')),

    btn('Zrozumiałem', 'primary', close)));
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.body.append(box);
}

/* ---------- Okno startowe ---------- */

const WELCOME_VERSION = 1; // zwiększ, żeby wszyscy zobaczyli okno ponownie

function showWelcome() {
  if (document.querySelector('.modal.welcome')) return;
  const li = (b, t) => h('li', {}, h('strong', {}, b), ' – ' + t);
  const box = h('div', { class: 'modal welcome', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'welcome-title' },
    h('div', { class: 'card modal-card welcome-card' },
      h('div', { class: 'verdict-icon', 'aria-hidden': 'true' }, '🫡'),
      h('h2', { id: 'welcome-title' }, 'BACZNOŚĆ!'),
      h('p', { class: 'lead' }, 'Melduję posłusznie: aplikacja gotowa do służby.'),
      h('p', {}, 'Witaj w ', h('strong', {}, 'Nauce SW'), ' – jedynym zakładzie karnym, z którego nikt nie chce uciekać. Odbywasz tu dobrowolną karę nauki w systemie programowanego oddziaływania. Cel jest jeden: zdać egzamin unitarny i komendancki, zanim egzamin zda Ciebie.'),
      h('h3', {}, '📋 Instrukcja ochronna (skrócona)'),
      h('ul', {},
        li('Fiszki', 'codzienny apel wiedzy. Uczciwie oceniasz, czy wiesz, a karty same wracają, gdy trzeba.'),
        li('Test', 'unitarny albo specjalistyczny, 30/40/50 pytań, odpowiedź od razu.'),
        li('Na pamięć', 'luki i kolejność. Wpisujesz albo wybierasz – dla tych z ograniczonym zaufaniem do klawiatury.'),
        li('Egzamin próbny', 'jak prawdziwy: zegar tyka, wynik dopiero na końcu.'),
        li('Trudne', 'cela przejściowa dla pytań, na których się wyłożyłeś.'),
        li('Czytaj', 'skrypty z cytatami do wkucia, z wyszukiwarką.'),
        li('Teczka', 'stopień, odznaki, seria dni nauki i odliczanie do egzaminu.'),
        li('⚙️ Ustawienia', 'trybik w nagłówku: motyw jasny/ciemny, kopia postępu, historia zmian.'),
        li('❓ Instrukcja', 'przycisk „?” obok INFO – wszystko krok po kroku.'),
        li('🦅 Chorąży Bielik', 'pilnuje Twojej nauki: chwali, docina i przypomina. Ustawisz go w ⚙️.')),
      h('p', {}, h('strong', {}, '⭐ Zasada służby: '), 'codziennie trochę. Za systematyczność są punkty, awanse i odznaki. Za przerwy jest tylko wstyd przed samym sobą (ewentualnie przed dowódcą zmiany).'),
      h('p', {}, h('strong', {}, '⚠️ Pouczenie: '), 'aplikacja nie zastępuje ustawy ani prowadzącego. W razie sporu wygrywa aktualny tekst przepisów. Aplikacja przyjmuje to z godnością.'),
      h('h3', {}, '🍫 Wsparcie twórcy'),
      h('p', {}, 'Twórca tej aplikacji nie pobiera dodatku za szkodliwe warunki pracy, choć powinien. Jeśli aplikacja pomogła Ci zdać, przewidziano następujące formy nagrody (art. 138 KKW stosuje się odpowiednio):'),
      h('ul', {},
        li('🍫 Czekolada', 'nagroda regulaminowa, przyjmowana bez kontroli pobieżnej.'),
        li('🥃 Coś mocniejszego', 'wyłącznie po służbie i poza terenem jednostki; na oddziale to przedmiot niedozwolony.'),
        li('💸 Gotówka', 'najmniej dolegliwy środek wsparcia, stosowany zgodnie z zasadą proporcjonalności.')),
      h('p', {}, 'Wsparcie przekazuje się ', h('strong', {}, 'osobiście, do rąk własnych twórcy'), ', bez pośredników i bez konwoju.'),
      h('p', { class: 'small muted' }, 'Brak wsparcia nie skutkuje karą dyscyplinarną. Wpis do teczki osobowej – w kategorii „nieprzydatny do spożycia czekolady” – zostaje.'),
      btn('Rozkaz!', 'primary', () => {
        state.settings.welcomeSeen = WELCOME_VERSION;
        state.settings.lastSeenVersion = APP_VERSION;
        save();
        box.remove();
        if (!state.settings.importOffered && !OLD_SITE) showImportOffer();
      })));
  document.body.append(box);
}

// Pierwsze uruchomienie na nowej stronie: propozycja wczytania postępu ze starej strony.
function showImportOffer() {
  state.settings.importOffered = true;
  save();
  const box = h('div', { class: 'modal import-offer', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'import-title' });
  const close = () => box.remove();
  box.append(h('div', { class: 'card modal-card welcome-card' },
    h('div', { class: 'moving-ico', 'aria-hidden': 'true' }, '📂'),
    h('h2', { id: 'import-title', style: 'text-align:center' }, 'Przenosisz się ze starej strony?'),
    h('p', {}, 'Jeśli na starej stronie zapisałeś kopię postępu (plik ', h('strong', {}, 'nauka-sw-postep-….json'),
      '), wczytaj ją teraz. Wrócą stopień, punkty, odznaki i powtórki fiszek.'),
    btn('📂 Importuj postęp', 'primary', () => { close(); importProgress(); }),
    btn('Anuluj – zaczynam od nowa', 'ghost', close),
    h('p', { class: 'small muted', style: 'text-align:center' }, 'Możesz to zrobić także później: ⚙️ → Importuj.')));
  document.body.append(box);
}

function showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  const bar = h('div', { id: 'update-banner', class: 'update-banner', role: 'status' },
    h('span', {}, '🔄 Jest nowa wersja aplikacji (nowe pytania lub poprawki).'),
    h('button', { type: 'button', class: 'btn primary', onclick: () => {
      if (exam && !exam.finished && !confirm('Trwa egzamin – odświeżenie go przerwie. Odświeżyć teraz?')) return;
      location.reload();
    } }, 'Odśwież'));
  document.body.append(bar);
}

// Teksty dymków Chorążego Bielika (z dokumentu „Chorąży Bielik – teksty dymków”).
// m = nastrój, t = tekst, o = ostrzejsza wersja (gdy włączony „ostrzejszy język”).
const BIELIK_TEKSTY = {
  'pow.rano': [
    { m: 'czujny', t: 'Pobudka, kursancie! Kawa wypita? To teraz KKW.' },
    { m: 'czujny', t: 'Ranek to najlepsza pora na naukę. Druga najlepsza jest teraz.' },
    { m: 'czujny', t: 'Dzień dobry. Egzamin też już nie śpi.' }],
  'pow.popol': [
    { m: 'czujny', t: 'Melduję: dziś zero odpowiedzi. Czekam na rozkazy.' },
    { m: 'czujny', t: '20 pytań i masz wolne. Uczciwy układ.' },
    { m: 'znudzony', t: 'Przerwa na kawę trwa już od rana. Ambitnie.' }],
  'pow.wieczor': [
    { m: 'czujny', t: 'Seria czeka, serial poczeka.' },
    { m: 'grozny', t: 'Jeszcze zdążysz. Ale zegar nie jest po twojej stronie.' },
    { m: 'czujny', t: 'Dziesięć minut przed snem. Najlepiej wchodzi do głowy.' }],
  'pow.noc': [
    { m: 'czujny', t: 'Nocna zmiana? Szanuję. Wartownik też nie śpi.' },
    { m: 'znudzony', t: 'Druga w nocy. Albo jesteś bardzo ambitny, albo masz jutro egzamin.' }],
  'pow.weekend': [
    { m: 'czujny', t: 'Sobota? Egzamin nie ma weekendów.' },
    { m: 'znudzony', t: 'Niedziela, dzień odpoczynku. Dla tych, co już zdali.' }],
  'pow.poNauce': [{ m: 'zadowolony', t: 'Dziś już byłeś na służbie. Dokładka nikomu nie zaszkodziła.' }],
  'seria.zagr': [
    { m: 'grozny', t: 'Seria {seria} dni wisi na włosku. Dziesięć pytań i jest uratowana.' },
    { m: 'grozny', t: 'Masz serię {seria} dni. Szkoda by było, gdyby coś się jej stało…' },
    { m: 'grozny', t: '{seria} dni pracy. Chcesz to wyrzucić przez jeden leniwy wieczór?' }],
  'przerwa.1': [
    { m: 'grozny', t: 'Wczoraj wolne? Ciekawe. Nie pamiętam, żebym je zatwierdzał.' },
    { m: 'grozny', t: 'Jeden dzień przerwy to wypadek. Dwa to już nawyk.' },
    { m: 'grozny', t: 'Seria spadła. Pozbieraj ją, zanim ktoś zobaczy.' }],
  'przerwa.2': [
    { m: 'wsciekly', t: 'DWA DNI bez nauki?! Nawet osadzony z przepustki wraca na czas!', w: 2 },
    { m: 'wsciekly', t: 'Trzy dni ciszy. Myślałem, że zdezerterowałeś.', w: 3 },
    { m: 'wsciekly', t: 'Kursancie! Gdzie byłeś? Tylko nie mów, że na L4.' }],
  'przerwa.4': [
    { m: 'wsciekly', t: 'Jeszcze trochę i podejdzie pod porzucenie służby. Ile to dni? A, nie wiesz, bo się nie uczysz.' },
    { m: 'wsciekly', t: 'Wiesz, co jest gorsze od złej odpowiedzi? Brak odpowiedzi od tygodnia.' }],
  'przerwa.10': [{ m: 'wsciekly', t: 'Ponad 10 dni nieobecności. W służbie to już porzucenie. Tu na szczęście tylko wstyd.' }],
  'powrot': [
    { m: 'zadowolony', t: 'No proszę, kto wrócił. Odmeldować się z urlopu i do roboty.' },
    { m: 'grozny', t: 'Wróciłeś. Nie będę pytał, gdzie byłeś. Ale zapamiętam.' }],
  'seria.3': [{ m: 'zadowolony', t: 'Trzy dni z rzędu. Zaczyna to wyglądać na charakter.' }],
  'seria.7': [{ m: 'dumny', t: 'Tydzień bez przerwy! Order ci się należy. Z czekolady, ale zawsze.' }],
  'seria.14': [{ m: 'dumny', t: 'Dwa tygodnie! Komendant pyta, czy masz brata bliźniaka.' }],
  'seria.30': [{ m: 'dumny', t: 'Miesiąc służby bez dnia przerwy. Wzruszyłem się. Ale tylko trochę.' }],
  'cel.pol': [
    { m: 'czujny', t: 'Połowa celu za tobą. Druga połowa sama się nie zrobi.' },
    { m: 'czujny', t: 'Półmetek. Nie zwalniaj, bo zauważę.' }],
  'cel.done': [
    { m: 'zadowolony', t: 'Cel na dziś zaliczony. Spocznij!' },
    { m: 'zadowolony', t: 'Rozkaz wykonany. Można się odmeldować. …Albo zostać, nie zabraniam.' },
    { m: 'zadowolony', t: 'Norma zrobiona. Dziś śpisz z czystym sumieniem.' }],
  'cel.x2': [{ m: 'dumny', t: 'Podwójna norma? Ktoś tu chce zostać chorążym przed czasem.' }],
  'cel.x3': [{ m: 'dumny', t: 'Potrójna norma. Zaczynam się o ciebie martwić. Ale tak pozytywnie.' }],
  'awans': [
    { m: 'dumny', t: 'Awans na {stopien}! Pagony nosi się dumnie, ale bez zadzierania dzioba.' },
    { m: 'dumny', t: '{stopien}? Gratuluję. Teraz wymagania rosną.' }],
  'odznaka': [{ m: 'zadowolony', t: 'Nowa odznaka w Teczce. Przypnij ją sobie… mentalnie.' }],
  'got.wys': [{ m: 'dumny', t: 'Gotowość {gotowosc}%. Zaczynam się bać, że zdasz.' }],
  'got.nis': [{ m: 'grozny', t: 'Gotowość {gotowosc}%. Na egzaminie to byłby spacer po kruchym lodzie.' }],
  'egz.30': [{ m: 'czujny', t: '{dni} dni do egzaminu. Dużo? Tak samo myślał każdy, kto oblał.' }],
  'egz.15': [{ m: 'czujny', t: '{dni} dni. Czas płynie szybciej niż zmiana na wieżyczce.' }],
  'egz.8': [{ m: 'grozny', t: '{dni} dni. Od teraz każdy dzień bez nauki liczy się podwójnie.' }],
  'egz.4': [{ m: 'grozny', t: '{dni} dni do egzaminu. Panika zabroniona. Nauka obowiązkowa.' }],
  'egz.2': [{ m: 'grozny', t: '{dni} dni. Egzamin próbny dziś, nie jutro.' }],
  'egz.1': [{ m: 'czujny', t: 'Jutro egzamin. Przejrzyj Trudne, potem marsz spać. To rozkaz.' }],
  'egz.0': [{ m: 'dumny', t: 'Dziś egzamin. Głowa do góry, dziób prosto. Dasz radę, kursancie!' }],
  'egz.po': [{ m: 'zadowolony', t: 'Egzamin za tobą? Ustaw nową datę w Teczce. Służba trwa.' }],
  'tip.temat': [
    { m: 'grozny', t: 'Najwięcej błędów masz w: {temat}. Przypadek? Nie sądzę.', o: 'Najwięcej błędów masz w: {temat}. Przypadek? Nie sądzę. Pokrako.' },
    { m: 'czujny', t: '{temat} to twój słaby punkt. Słabe punkty się ćwiczy, a nie omija.' },
    { m: 'grozny', t: '{temat} kuleje. Na egzaminie nikt nie zapyta, czy lubisz ten dział.' }],
  'tip.trudne': [
    { m: 'grozny', t: 'Masz {trudne} pytań w Trudnych. Same się nie poprawią.' },
    { m: 'wsciekly', t: '{trudne} błędów czeka na poprawkę. To już nie lista, to kartoteka.' }],
  'tip.fiszki': [{ m: 'czujny', t: 'Pudełko numer jeden aż pęka. Pora na fiszki.' }],
  'tip.kazusy': [{ m: 'czujny', t: 'Kazusy czekają. Na służbie nikt ci nie da czterech odpowiedzi do wyboru.' }],
  'tip.probny': [{ m: 'grozny', t: 'Dawno nie było egzaminu próbnego. Boisz się wyniku?' }],
  'tip.sluchaj': [{ m: 'zadowolony', t: 'Jedziesz gdzieś? Włącz Słuchaj. Nawet korek może być nauką.' }],
  'tip.jedenTemat': [{ m: 'znudzony', t: 'Znowu {temat}? Inne działy też będą na egzaminie. Sprawdzałem.' }],
  'run.5': [
    { m: 'zadowolony', t: 'Pięć z rzędu. Rozgrzewka zaliczona.' },
    { m: 'zadowolony', t: 'Idzie ci. Nie zepsuj tego.', o: 'Idzie ci. Nie zepsuj tego jak zwykle.' }],
  'run.10': [
    { m: 'dumny', t: 'Dziesięć z rzędu! Ktoś tu jednak przeczytał KKW.', o: 'Dziesięć z rzędu! Ktoś tu jednak nie jest taki głupi.' },
    { m: 'dumny', t: 'Dziesiątka bez pudła. Strzelnica by pozazdrościła.' }],
  'run.20': [{ m: 'dumny', t: 'Dwadzieścia! Sprawdzam, czy nie ściągasz.' }],
  'bad.3': [
    { m: 'grozny', t: 'Trzy pudła z rzędu. Zwolnij i czytaj wyjaśnienia.' },
    { m: 'grozny', t: 'Czytasz pytania czy grasz w totolotka?' }],
  'bad.5': [
    { m: 'wsciekly', t: 'Pięć błędów pod rząd. Rzuć monetą, wyjdzie lepiej.' },
    { m: 'wsciekly', t: 'Stop! Przerwa, woda, oddech. Potem Fiszki z tego tematu. Weź się w garść!' }],
  'bad.nie': [{ m: 'grozny', t: 'NIE było napisane wielkimi literami. Specjalnie dla ciebie.' }],
  'bad.szybko': [{ m: 'grozny', t: 'Sekunda na odpowiedź? Najpierw czytaj, potem klikaj. Myślenie nie boli.' }],
  'fixed': [
    { m: 'zadowolony', t: 'Poprawione! Tego już nie zapomnisz. Mam nadzieję.' },
    { m: 'zadowolony', t: 'No i proszę. Wystarczyło raz się pomylić, żeby zapamiętać.' }],
  'nudny.ekran': [
    { m: 'znudzony', t: 'Będziemy tak na siebie patrzeć?' },
    { m: 'znudzony', t: 'Ekran się za ciebie nie nauczy.' },
    { m: 'znudzony', t: 'Halo. Kursancie. Tu jestem. Czekam.' },
    { m: 'znudzony', t: 'Mógłbym w tym czasie zrobić trzy fiszki. Gdybym miał palce.' }],
  'nudny.krotko': [
    { m: 'znudzony', t: 'Trzy pytania? To nawet nie rozgrzewka.' },
    { m: 'znudzony', t: 'Krótka ta służba. Krótsza niż zmiana patrolu.' }],
  'nudny.fiszka': [
    { m: 'znudzony', t: 'Myślisz czy zasnąłeś?' },
    { m: 'znudzony', t: 'Odpowiedź nie przyjdzie sama. No dobra, przyjdzie, jak klikniesz.' }],
  'klik': [
    { m: 'czujny', t: 'Nie stukaj w szybę, to nie akwarium.' },
    { m: 'grozny', t: 'Jeszcze raz mnie stukniesz i dostajesz 20 pytań karnych.', o: 'Jeszcze raz mnie stukniesz i dostajesz po mo… twarzy.' },
    { m: 'zadowolony', t: 'Spocznij! …No dobra, to ja spocznę.' }],
  'klik5': [{ m: 'wsciekly', t: 'To już jest naruszenie nietykalności funkcjonariusza!' }],
  'wyn.0': [
    { m: 'wsciekly', t: '{wynik}%. Z takim wynikiem na egzaminie odprowadzą cię do wyjścia. Bez konwoju.' },
    { m: 'wsciekly', t: 'Gorzej wypadli tylko ci, co nie przyszli.' },
    { m: 'grozny', t: 'Nie płacz. Przeczytaj błędy. Potem ewentualnie płacz.' }],
  'wyn.51': [
    { m: 'czujny', t: 'Zdane. Na styk, ale zdane. Komisja patrzy jednym okiem.' },
    { m: 'czujny', t: 'Ledwo, ledwo. Celuj wyżej, kursancie.' }],
  'wyn.71': [
    { m: 'zadowolony', t: '{wynik}%! Porządna robota. Jeszcze trochę szlifu i będzie medal.' },
    { m: 'zadowolony', t: 'Dobrze! Jeszcze trochę i zacznę cię chwalić przy innych.' }],
  'wyn.91': [
    { m: 'dumny', t: '{wynik}%! Melduję posłusznie: jestem pod wrażeniem.' },
    { m: 'dumny', t: 'Perfekcja. Komisja egzaminacyjna może iść do domu.' }],
  'wyn.gorzej': [{ m: 'grozny', t: 'Ostatnio było lepiej. Co się stało? Nie odpowiadaj, popraw.' }],
  'sprint.rekord': [{ m: 'dumny', t: 'Nowy rekord: {rekord} w minutę! Palce jak u telegrafisty.' }],
  'sprint.brak': [{ m: 'czujny', t: 'Rekord stoi niepokonany. Jeszcze raz?' }],
  'kazus.ok': [{ m: 'dumny', t: 'Kazus jak z podręcznika. Dowódca zmiany byłby spokojny.' }],
  'kazus.blad': [{ m: 'grozny', t: 'Na służbie ten błąd kosztowałby raport. Tu tylko punkty.' }],
  'pary.ok': [{ m: 'zadowolony', t: 'Wszystko do pary. Jak kajdanki.' }],
};

/* ---------- Chorąży Bielik (maskotka) ---------- */

const BIELIK_ON = () => state.settings.bielikOff !== true;
const BIELIK_OSTRO = () => state.settings.bielikOstry !== false;
const bielikLast = {};
let bielikPopAt = 0, bielikClicks = 0, bielikClickT = 0, bielikIdleT = null, bielikFlashT = null;
let sessAnswers = 0, shortSession = false, badRun = 0, qShownAt = 0, bielikQuiet = false;

function bielikLine(key, vars) {
  let list = (BIELIK_TEKSTY[key] || []).filter(x => !x.w || (vars && vars.przerwa === x.w));
  if (!list.length) list = BIELIK_TEKSTY[key] || [];
  if (!list.length) return null;
  let pick = list[Math.floor(Math.random() * list.length)];
  if (list.length > 1 && bielikLast[key] === pick.t) pick = list[(list.indexOf(pick) + 1) % list.length];
  bielikLast[key] = pick.t;
  let t = (BIELIK_OSTRO() && pick.o) || pick.t;
  for (const [k, v] of Object.entries(vars || {})) t = t.split('{' + k + '}').join(String(v));
  return { m: pick.m, t };
}

function bielikSVG(mood, size) {
  const M = mood || 'czujny';
  const C = { body: '#8b5a2f', belly: '#a8763f', wing: '#6a4220', wingL: '#7d5028', face: '#f7ecdc', beret: '#4b6334', beretD: '#3a4f27',
    gold: '#f4c235', goldD: '#c8952a', beak: '#f6b62b', beakD: '#d98e12', ink: '#1f1f1f', mouth: '#d84a3a', tongue: '#f08a7a' };
  const W = {
    down: 'M38 90 Q20 104 24 130 Q30 133 36 126 Q38 132 44 126 Q48 110 44 94 Z',
    hip: 'M38 92 Q18 98 20 114 Q24 124 34 122 Q42 120 46 112 Q40 108 42 98 Z',
    up: 'M45 106 Q26 104 14 86 Q5 72 9 60 Q15 65 19 62 Q21 69 26 67 Q28 75 34 75 Q38 83 45 86 Z',
  };
  const feather = { down: 'M30 112 q4 2 8 -2 M29 121 q4 2 8 -2', hip: 'M26 112 q4 2 8 -2', up: 'M16 80 q4 4 9 3 M24 91 q4 3 9 2' };
  const wings = { dumny: ['hip', 'hip'], zadowolony: ['down', 'down'], czujny: ['down', 'down'], grozny: ['up', 'down'],
    wsciekly: ['up', 'up'], znudzony: ['down', 'down'] }[M] || ['down', 'down'];
  const wingSvg = (k, right) => {
    const g = `<path d="${W[k]}" fill="${C.wing}"/><path d="${feather[k]}" fill="none" stroke="${C.wingL}" stroke-width="2" stroke-linecap="round"/>`;
    return right ? `<g class="bk-wr"><g transform="translate(140 0) scale(-1 1)">${g}</g></g>` : `<g class="bk-wl">${g}</g>`;
  };
  const brows = {
    dumny: 'M51 50 Q58 45 65 49 M75 49 Q82 45 89 50',
    zadowolony: 'M52 50 Q58 47 64 50 M76 50 Q82 47 88 50',
    czujny: 'M51 50 L65 51 M75 51 L89 50',
    grozny: 'M50 47 L65 54 M75 54 L90 47',
    wsciekly: 'M49 45 L66 55 M74 55 L91 45',
    znudzony: 'M51 52 L65 53 M75 53 L89 52',
  }[M] || 'M51 50 L65 51 M75 51 L89 50';
  let eyes;
  if (M === 'zadowolony') {
    eyes = `<path d="M52 63 Q58 55 64 63 M76 63 Q82 55 88 63" fill="none" stroke="${C.ink}" stroke-width="3.5" stroke-linecap="round"/>`;
  } else if (M === 'znudzony') {
    eyes = `<ellipse cx="58" cy="61" rx="6.5" ry="7" fill="#fff" stroke="${C.ink}" stroke-width="1.2"/><ellipse cx="82" cy="61" rx="6.5" ry="7" fill="#fff" stroke="${C.ink}" stroke-width="1.2"/>` +
      `<g class="bk-pupils"><circle cx="58" cy="63" r="3.6" fill="${C.ink}"/><circle cx="82" cy="63" r="3.6" fill="${C.ink}"/></g>` +
      `<path d="M50.8 54 H65.2 V58.5 Q58 56.5 50.8 58.5 Z M74.8 54 H89.2 V58.5 Q82 56.5 74.8 58.5 Z" fill="${C.face}"/>` +
      `<path d="M51.5 58.5 Q58 56.5 64.5 58.5 M75.5 58.5 Q82 56.5 88.5 58.5" fill="none" stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round"/>`;
  } else {
    const ry = M === 'wsciekly' ? 5 : 6.5;
    eyes = `<ellipse cx="58" cy="61" rx="5.5" ry="${ry}" fill="${C.ink}"/><ellipse cx="82" cy="61" rx="5.5" ry="${ry}" fill="${C.ink}"/>` +
      `<circle cx="60" cy="58.5" r="1.8" fill="#fff"/><circle cx="84" cy="58.5" r="1.8" fill="#fff"/>`;
  }
  const open = { grozny: 1, wsciekly: 2, zadowolony: 0.6, dumny: 0.6 }[M] || 0;
  const beak = open
    ? `<path d="M60 68 Q70 62 81 68 Q80 73 75 74 L65 74 Q61 72 60 68 Z" fill="${C.beak}"/>` +
      `<path d="M63 75 Q70 ${74 + open * 2} 77 75 Q75 ${80 + open * 4} 70 ${81 + open * 4} Q65 ${80 + open * 4} 63 75 Z" fill="${C.mouth}"/>` +
      `<path d="M65 ${78 + open * 3} Q70 ${76 + open * 3} 75 ${78 + open * 3} Q72 ${81 + open * 4} 70 ${81 + open * 4} Q67 ${81 + open * 4} 65 ${78 + open * 3} Z" fill="${C.tongue}"/>`
    : `<path d="M60 68 Q70 62 81 68 Q81 76 74 82 Q73 76 67 74 Q61 72 60 68 Z" fill="${C.beak}"/>` +
      `<path d="M67 74 Q73 76 74 82" fill="none" stroke="${C.beakD}" stroke-width="1.6" stroke-linecap="round"/>`;
  const blush = M === 'wsciekly' ? `<ellipse cx="51" cy="70" rx="6" ry="3.5" fill="#ef6b5b" opacity=".45"/><ellipse cx="89" cy="70" rx="6" ry="3.5" fill="#ef6b5b" opacity=".45"/>`
    : M === 'zadowolony' ? `<ellipse cx="51" cy="69" rx="5" ry="3" fill="#f39b8b" opacity=".4"/><ellipse cx="89" cy="69" rx="5" ry="3" fill="#f39b8b" opacity=".4"/>` : '';
  const fx = {
    dumny: `<path d="M116 34 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 Z M124 58 l1.5 4 l4 1.5 l-4 1.5 l-1.5 4 l-1.5 -4 l-4 -1.5 l4 -1.5 Z" fill="${C.gold}"/>`,
    czujny: `<path d="M114 26 L118 16 M120 32 L130 26 M121 40 L132 40" stroke="${C.gold}" stroke-width="3" stroke-linecap="round"/>`,
    wsciekly: `<path d="M14 30 q-6 -2 -4 -8 q-2 -7 5 -8 q2 -6 8 -3 q6 -2 7 4 q6 3 2 9 q-2 6 -8 4 q-4 4 -10 2 Z M126 30 q6 -2 4 -8 q2 -7 -5 -8 q-2 -6 -8 -3 q-6 -2 -7 4 q-6 3 -2 9 q2 6 8 4 q4 4 10 2 Z" fill="none" stroke="#c9b99f" stroke-width="2.2" stroke-linejoin="round"/>`,
    znudzony: `<path d="M86 80 q6 -2 10 -6 M92 84 q7 0 12 -4" fill="none" stroke="#9aa6b2" stroke-width="2" stroke-linecap="round"/><text x="104" y="74" font-size="11" font-family="sans-serif" fill="#9aa6b2">ehh…</text>`,
  }[M] || '';
  const medal = M === 'dumny' ? `<path d="M51 92 L55 104 L59 92 Z" fill="#c0392b"/><path d="M55 92 L55 104" stroke="#fff" stroke-width="1.5"/><circle cx="55" cy="108" r="5" fill="${C.gold}" stroke="${C.goldD}" stroke-width="1.2"/><path d="M55 105.5 l1 2 2.2.3 -1.6 1.5.4 2.2 -2-1.1 -2 1.1.4-2.2 -1.6-1.5 2.2-.3 Z" fill="${C.goldD}"/>` : '';
  const s = size || 110;
  return `<svg class="bielik bielik-${M}" viewBox="0 0 140 150" width="${s}" height="${Math.round(s * 150 / 140)}" role="img" aria-label="Chorąży Bielik">` +
    `<g class="bk-root"><g class="bk-fx">${fx}</g>` +
    `<g fill="${C.gold}" stroke="${C.goldD}" stroke-width="1"><ellipse cx="52" cy="143" rx="6" ry="3.5"/><ellipse cx="60" cy="145" rx="6" ry="3.5"/><ellipse cx="80" cy="145" rx="6" ry="3.5"/><ellipse cx="88" cy="143" rx="6" ry="3.5"/></g>` +
    `<g class="bk-body"><ellipse cx="70" cy="110" rx="38" ry="34" fill="${C.body}"/>` +
    `<ellipse cx="70" cy="114" rx="25" ry="25" fill="${C.belly}"/>` +
    `<path d="M57 104 q4 3 8 0 M75 104 q4 3 8 0 M60 118 q4 3 8 0 M72 126 q4 3 8 0" fill="none" stroke="${C.body}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>` +
    `<g fill="${C.gold}" stroke="${C.goldD}" stroke-width="1.2"><circle cx="70" cy="101" r="3.4"/><circle cx="70" cy="112" r="3.4"/><circle cx="70" cy="123" r="3.4"/></g>` +
    medal + `</g>` +
    wingSvg(wings[0], false) + wingSvg(wings[1], true) +
    `<g class="bk-head"><circle cx="70" cy="60" r="34" fill="${C.body}"/>` +
    `<ellipse cx="70" cy="64" rx="28" ry="26" fill="${C.face}"/>` + blush +
    // furażerka Służby Więziennej: grafit, napis SW, srebrny orzełek
    `<path d="M33 43 Q31 30 43 23 Q70 11 101 17 Q112 20 109 34 Q71 31 33 43 Z" fill="#454b52"/>` +
    `<path d="M43 23 Q72 13 101 17" fill="none" stroke="#5f666e" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M33 43 Q71 31 109 34 L108 41 Q72 37 35 49 Z" fill="#33383e"/>` +
    `<g fill="#dfe3e8"><circle cx="46" cy="36.5" r="2"/><path d="M40 38 Q43 36 46 39 Q49 36 52 38 Q50 43 46 44.5 Q42 43 40 38 Z"/></g>` +
    `<text x="74" y="29.5" font-size="9.5" font-weight="800" font-family="Arial, Helvetica, sans-serif" fill="#e8ebee" letter-spacing=".5">SW</text>` +
    `<path d="${brows}" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linecap="round"/>` +
    `<g class="bk-eyes">${eyes}</g>` + beak + `</g></g></svg>`;
}

function bielikFigure(mood, size) {
  const wrap = h('span', { class: 'bielik-fig' });
  wrap.innerHTML = bielikSVG(mood, size);
  return wrap;
}

// Ile dni minęło od ostatniego dnia nauki (0 = dziś, 1 = wczoraj, …; null = nigdy).
function daysSinceStudy() {
  const days = Object.keys(game().days).filter(k => game().days[k] > 0).sort();
  if (!days.length) return null;
  const last = new Date(days[days.length - 1] + 'T12:00:00');
  const now = new Date(); now.setHours(12, 0, 0, 0);
  return Math.round((now - last) / 86400000);
}

function weakestDeck() {
  let worst = null;
  for (const [id, s] of Object.entries(game().deckStats || {})) {
    if (!deckById[id] || s.n < 10) continue;
    const acc = s.ok / s.n;
    if (!worst || acc < worst.acc) worst = { id, acc };
  }
  return worst && worst.acc < 0.8 ? deckById[worst.id].name : null;
}

// Wybór dymka na ekran Nauka.
function bielikHomeLine() {
  const g = game();
  const today = g.days[dayKey(new Date())] || 0;
  const goal = dailyGoal();
  const seria = streakDays();
  const dte = daysToExam();
  const gap = daysSinceStudy();
  const hr = new Date().getHours(), wd = new Date().getDay();
  const vars = { seria, dni: dte, gotowosc: readiness(), trudne: hardItems().length, temat: weakestDeck() || '' };
  if (shortSession) { shortSession = false; return bielikLine('nudny.krotko', vars); }
  if (dte === 0) return bielikLine('egz.0', vars);
  if (dte === 1) return bielikLine('egz.1', vars);
  if (today === 0) {
    if (gap !== null && gap >= 11) return bielikLine('przerwa.10', vars);
    if (gap !== null && gap >= 5) return bielikLine('przerwa.4', vars);
    if (gap !== null && gap >= 3) return bielikLine('przerwa.2', { ...vars, przerwa: gap - 1 });
    if (gap === 2) return bielikLine('przerwa.1', vars);
    if (seria >= 2 && Math.random() < 0.5) return bielikLine('seria.zagr', vars);
    if (dte >= 2 && dte <= 7 && Math.random() < 0.5) return bielikLine(dte <= 3 ? 'egz.2' : 'egz.4', vars);
    if (wd === 0 || wd === 6) { if (Math.random() < 0.5) return bielikLine('pow.weekend', vars); }
    return bielikLine(hr >= 23 || hr < 5 ? 'pow.noc' : hr < 11 ? 'pow.rano' : hr < 18 ? 'pow.popol' : 'pow.wieczor', vars);
  }
  // dziś już była nauka
  if (g.flags.returnDay === dayKey(new Date()) && !g.flags.returnSaid) { g.flags.returnSaid = true; save(); return bielikLine('powrot', vars); }
  if ([3, 7, 14, 30].includes(seria) && g.flags.streakSaid !== seria) { g.flags.streakSaid = seria; save(); return bielikLine('seria.' + seria, vars); }
  if (today >= goal * 3) return bielikLine('cel.x3', vars);
  if (today >= goal * 2) return bielikLine('cel.x2', vars);
  if (today >= goal) return bielikLine(Math.random() < 0.5 ? 'cel.done' : 'pow.poNauce', vars);
  const wl = bielikWeakLine();
  if (wl) return wl;
  // podpowiedzi
  const tips = [];
  if (vars.temat) tips.push('tip.temat');
  if (vars.trudne >= 15) tips.push('tip.trudne');
  if (DATA.items.filter(i => i.type === 'flashcard' && state.boxes[i.id] && state.boxes[i.id].box === 1 && isDue(i.id)).length >= 15) tips.push('tip.fiszki');
  if (!DATA.items.some(i => i.type === 'case' && state.hist[i.id] && Date.now() - state.hist[i.id].ts < 7 * 86400000)) tips.push('tip.kazusy');
  if (!state.exams.length || Date.now() - state.exams[0].date > 5 * 86400000) tips.push('tip.probny');
  if (!state.settings.listenUsed) tips.push('tip.sluchaj');
  if (selectedDecks().length === 1) { tips.push('tip.jedenTemat'); vars.temat = deckById[selectedDecks()[0]].name; }
  if (vars.gotowosc >= 80) tips.push('got.wys');
  if (today >= 10 && vars.gotowosc < 40) tips.push('got.nis');
  if (dte > 1) tips.push(dte > 30 ? 'egz.30' : dte >= 15 ? 'egz.15' : dte >= 8 ? 'egz.8' : dte >= 4 ? 'egz.4' : 'egz.2');
  if (dte < 0) tips.push('egz.po');
  if (today >= Math.ceil(goal / 2)) tips.push('cel.pol');
  return bielikLine(tips[Math.floor(Math.random() * tips.length)] || 'pow.poNauce', vars);
}

// Karta z Bielikiem na ekranie Nauka.
function bielikCard() {
  if (!BIELIK_ON()) return null;
  const line = bielikHomeLine() || { m: 'czujny', t: 'Melduję gotowość, kursancie.' };
  const fig = bielikFigure(line.m, 86);
  const bubble = h('div', { class: 'bielik-bubble', role: 'status' }, line.t);
  const say = l => { if (!l) return; fig.innerHTML = bielikSVG(l.m, 86); bubble.textContent = l.t; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); };
  fig.setAttribute('role', 'button');
  fig.setAttribute('tabindex', '0');
  fig.setAttribute('aria-label', 'Chorąży Bielik – stuknij');
  const click = () => {
    const now = Date.now();
    bielikClicks = now - bielikClickT < 2500 ? bielikClicks + 1 : 1;
    bielikClickT = now;
    say(bielikLine(bielikClicks >= 5 ? 'klik5' : 'klik'));
    if (bielikClicks >= 5) bielikClicks = 0;
    restartIdle();
  };
  fig.addEventListener('click', click);
  fig.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); } });
  const talk = h('div', { class: 'bielik-talk' }, h('div', { class: 'bielik-name' }, 'Chorąży Bielik'), bubble);
  const card = h('div', { class: 'bielik-row' }, fig, talk);
  if (musztraDue()) {
    const m = musztraCard(fig, say, bubble);
    if (m) { card.classList.add('has-musztra'); card.append(m); }
  }
  function restartIdle() {
    clearTimeout(bielikIdleT);
    bielikIdleT = setTimeout(() => { if (card.isConnected && currentRoute === '') say(bielikLine('nudny.ekran')); }, 30000);
  }
  restartIdle();
  return card;
}

// Krótkie wtrącenie w trakcie nauki (dymek u dołu ekranu).
function bielikPop(key, vars, opts) {
  if (!BIELIK_ON() || bielikQuiet) return;
  if (['egzamin', 'sprint'].includes(currentRoute)) return;
  const o = opts || {};
  if (!o.force && Date.now() - bielikPopAt < 90000) return;
  const line = bielikLine(key, vars);
  if (!line) return;
  bielikPopAt = Date.now();
  document.querySelector('.bielik-pop')?.remove();
  const el = h('div', { class: 'bielik-pop', role: 'status' }, bielikFigure(line.m, 58),
    h('div', { class: 'bielik-pop-text' }, h('strong', {}, 'Chorąży Bielik'), h('div', {}, line.t), o.sub && h('div', { class: 'small muted' }, o.sub)));
  el.addEventListener('click', () => el.remove());
  document.body.append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, o.ms || 5200);
}

// Komentarz Bielika pod wynikiem (test, egzamin, sprint, kazus, pary).
function bielikComment(key, vars) {
  if (!BIELIK_ON()) return null;
  const line = bielikLine(key, vars);
  if (!line) return null;
  return h('div', { class: 'bielik-comment' }, bielikFigure(line.m, 64), h('div', { class: 'bielik-bubble' }, line.t));
}

function bielikResultKey(p) {
  return p >= 91 ? 'wyn.91' : p >= 71 ? 'wyn.71' : p >= 51 ? 'wyn.51' : 'wyn.0';
}

// Reakcje na odpowiedzi – wołane z onAnswer().
function bielikOnAnswer(item, result, prev) {
  if (bielikQuiet) return;
  sessAnswers++;
  const g = game();
  const ok = result === 'ok';
  if (result === 'bad') badRun++; else if (ok) badRun = 0;
  const day = dayKey(new Date());
  const today = g.days[day] || 0, goal = dailyGoal();
  if (today === 1) {
    setTimeout(syncPush, 1500);
    const gap = daysSinceStudyBefore(day);
    if (gap !== null && gap >= 3) { g.flags.returnDay = day; g.flags.returnSaid = false; }
  }
  if (today === goal) return bielikPop('cel.done', {}, { force: true, sub: `${goal} odpowiedzi dzisiaj · +${POINTS.dailyGoal} pkt` });
  if (today === goal * 2) return bielikPop('cel.x2', {}, { force: true });
  if (today === goal * 3) return bielikPop('cel.x3', {}, { force: true });
  if (ok && [10, 20].includes(g.run)) return bielikPop('run.' + g.run, {}, { force: true });
  if (ok && g.run === 5) return bielikPop('run.5');
  if (badRun === 5) return bielikPop('bad.5', {}, { force: true });
  if (badRun === 3) return bielikPop('bad.3');
  if (result === 'bad' && item.type === 'mcq' && /\bNIE\b|FAŁSZ|BŁĘDN|NIEPRAWDZIW/.test(item.question)) return bielikPop('bad.nie');
  if (result === 'bad' && item.type === 'mcq' && qShownAt && Date.now() - qShownAt < 2000) return bielikPop('bad.szybko');
  if (ok && prev && prev.last === 'bad') return bielikPop('fixed');
  if (today === Math.ceil(goal / 2)) return bielikPop('cel.pol');
}

// Dni przerwy przed dniem `day` (bez liczenia go).
function daysSinceStudyBefore(day) {
  const days = Object.keys(game().days).filter(k => k < day && game().days[k] > 0).sort();
  if (!days.length) return null;
  return Math.round((new Date(day + 'T12:00:00') - new Date(days[days.length - 1] + 'T12:00:00')) / 86400000);
}

/* ---------- Powiadomienia (Web Push) ---------- */

const PUSH_OK = () => HAS_SERVER && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const IS_STANDALONE = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

function b64uToBytes(s) {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}

function lastStudyDay() {
  const days = Object.keys(game().days).filter(k => game().days[k] > 0).sort();
  return days.length ? days[days.length - 1] : null;
}

function pushPayload() {
  return { hour: state.settings.push.hour, tz: -new Date().getTimezoneOffset(), last: lastStudyDay(), seria: streakDays(), exam: examDate(), ostro: BIELIK_OSTRO() };
}

async function enablePush(hour) {
  if (!PUSH_OK()) throw new Error('Ten telefon lub przeglądarka nie obsługuje powiadomień.');
  if (IS_IOS && !IS_STANDALONE()) throw new Error('Na iPhonie najpierw dodaj aplikację do ekranu początkowego (Udostępnij → „Do ekranu początkowego”) i włącz powiadomienia już w tej ikonie.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Nie ma zgody na powiadomienia. Włączysz ją w ustawieniach telefonu (powiadomienia dla przeglądarki lub aplikacji).');
  const reg = await navigator.serviceWorker.ready;
  const { k } = await (await fetch('/api/push/klucz', { cache: 'no-store' })).json();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(k) });
  state.settings.push = { on: true, hour };
  const r = await fetch('/api/push/zapis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON(), ...pushPayload() }) });
  if (!r.ok) throw new Error('Serwer nie przyjął zapisu. Spróbuj jeszcze raz.');
  state.settings.pushSync = JSON.stringify(pushPayload());
  save();
}

async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch (e) {}
  try { await fetch('/api/push/usun', { method: 'POST' }); } catch (e) {}
  state.settings.push = { on: false, hour: (state.settings.push && state.settings.push.hour) || 19 };
  save();
}

// Aktualizacja danych do przypomnień (ostatni dzień nauki, seria, data egzaminu) – tylko gdy coś się zmieniło.
function syncPush() {
  const p = state.settings.push;
  if (!p || !p.on || !PUSH_OK()) return;
  const now = JSON.stringify(pushPayload());
  if (state.settings.pushSync === now) return;
  state.settings.pushSync = now;
  save();
  fetch('/api/push/zapis', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: now })
    .catch(() => { state.settings.pushSync = ''; });
}

function bielikSettings() {
  const st = state.settings;
  const p = st.push || { on: false, hour: 19 };
  const info = h('p', { class: 'small muted', style: 'margin:4px 0' });
  const hours = [];
  for (let x = 6; x <= 22; x++) hours.push(x);
  const hourSel = h('select', { class: 'hour-select', 'aria-label': 'Godzina przypomnienia', disabled: !p.on ? '' : null,
    onchange: async e => { st.push.hour = parseInt(e.target.value, 10); save(); syncPush(); info.textContent = `Bielik odezwie się o ${st.push.hour}:00, jeśli tego dnia nie będzie nauki.`; } },
    hours.map(x => h('option', { value: x, selected: x === p.hour ? '' : null }, `${x}:00`)));
  const pushSwitch = h('input', { type: 'checkbox', role: 'switch', checked: !!p.on, onchange: async e => {
    e.target.disabled = true;
    try {
      if (e.target.checked) { await enablePush(parseInt(hourSel.value, 10)); hourSel.disabled = false; info.textContent = `Gotowe! Bielik odezwie się o ${hourSel.value}:00, jeśli tego dnia nie będzie nauki.`; }
      else { await disablePush(); hourSel.disabled = true; info.textContent = 'Powiadomienia wyłączone.'; }
    } catch (err) { e.target.checked = false; info.textContent = err.message; }
    e.target.disabled = false;
  } });
  if (p.on) info.textContent = `Bielik odezwie się o ${p.hour}:00, jeśli tego dnia nie będzie nauki. Przed egzaminem przypomni się też 7, 3 i 1 dzień wcześniej.`;
  else if (!PUSH_OK()) info.textContent = 'Ta przeglądarka nie obsługuje powiadomień.';
  else if (IS_IOS && !IS_STANDALONE()) info.textContent = 'Na iPhonie powiadomienia działają tylko z ikony na ekranie początkowym (Udostępnij → „Do ekranu początkowego”).';
  else info.textContent = 'Najwyżej jedno przypomnienie dziennie, tylko gdy tego dnia nie było nauki.';
  return [
    h('h3', {}, '🦅 Chorąży Bielik'),
    h('label', { class: 'switch' }, h('span', {}, 'Pokazuj Bielika'),
      h('input', { type: 'checkbox', role: 'switch', checked: BIELIK_ON(), onchange: e => { st.bielikOff = !e.target.checked; save(); } })),
    h('label', { class: 'switch' }, h('span', {}, 'Ostrzejszy język (docinki, czasem dosadnie)'),
      h('input', { type: 'checkbox', role: 'switch', checked: BIELIK_OSTRO(), onchange: e => { st.bielikOstry = e.target.checked; save(); syncPush(); } })),
    h('label', { class: 'switch' }, h('span', {}, 'Musztra znienacka (pytanie w dymku na ekranie Nauka)'),
      h('input', { type: 'checkbox', role: 'switch', checked: !st.musztraOff, onchange: e => { st.musztraOff = !e.target.checked; save(); } })),
    HAS_SERVER && h('label', { class: 'switch' }, h('span', {}, 'Powiadomienia od Bielika'), pushSwitch),
    HAS_SERVER && h('div', { class: 'row', style: 'align-items:center' }, h('span', { class: 'small' }, 'Godzina:'), hourSel),
    HAS_SERVER && info,
  ];
}
const ICONS = {
  'info': '<circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path>',
  'help': '<circle cx="12" cy="12" r="9"></circle><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5V14M12 17h.01"></path>',
  'gear': '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path>',
  'cards': '<rect x="3" y="6" width="14" height="14" rx="2"></rect><path d="M7 3h12a2 2 0 0 1 2 2v12"></path>',
  'check': '<path d="M9 11l3 3 8-8"></path><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"></path>',
  'clock': '<circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2.5M9 2h6"></path>',
  'pen': '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>',
  'alert': '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path><path d="M12 9v4M12 17h.01"></path>',
  'coins': '<circle cx="9" cy="9" r="6"></circle><path d="M18.1 10.4A6 6 0 1 1 10.4 18.1M7 7h2v4M16.7 13.9l.7.7-2.8 2.8"></path>',
  'swipe': '<rect x="6" y="3" width="12" height="18" rx="2"></rect><path d="M2 12h2M20 12h2M9 12h6M13 10l2 2-2 2"></path>',
  'landmark': '<path d="M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l8 5H4z"></path>',
  'search': '<circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path>',
  'scale': '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"></path>',
  'puzzle': '<path d="M10 3h4v3a2 2 0 1 0 4 0V3h3v7h-3a2 2 0 1 0 0 4h3v7h-7v-3a2 2 0 1 0-4 0v3H3v-7h3a2 2 0 1 0 0-4H3V3z"></path>',
  'timer': '<circle cx="12" cy="13" r="8"></circle><path d="M12 9v4M10 2h4M19 6l1.5-1.5"></path>',
  'phones': '<path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z"></path>',
  'book': '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"></path>',
  'file': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h6"></path>',
  'brief': '<rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 13h20"></path>',
  'flame': '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7z"></path>',
  'medal': '<circle cx="12" cy="15" r="6"></circle><path d="M8 3l2.5 6M16 3l-2.5 6M12 12v6M10 14h4"></path>',
  'cal': '<rect x="3" y="4" width="18" height="17" rx="2"></rect><path d="M3 9h18M8 2v4M16 2v4"></path>',
  'target': '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle><circle cx="12" cy="12" r="1"></circle>',
  'chev': '<path d="M9 6l6 6-6 6"></path>',
  'back': '<path d="M15 6l-6 6 6 6"></path>',
  'star': '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"></path>',
  'done': '<circle cx="12" cy="12" r="9"></circle><path d="M8 12l3 3 5-6"></path>',
  'todo': '<circle cx="12" cy="12" r="9"></circle>',
  'lock': '<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>',
  'x': '<path d="M18 6L6 18M6 6l12 12"></path>',
  'ok': '<path d="M5 12l5 5 9-10"></path>',
  'flag': '<path d="M4 22V4M4 4h13l-2 4 2 4H4"></path>',
  'trophy': '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"></path><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"></path>',
  'share': '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"></path>'
};

/* =====================================================================
   v31: nowy wygląd – ikony, pagony SW, karta główna z wieżyczką,
        odznaki-obrazki, wykres skuteczności
   ===================================================================== */

function icon(name, size, cls) {
  const s = size || 22;
  const el = h('span', { class: 'ico' + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' });
  el.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return el;
}

// Pagony wg wzorów Służby Więziennej: belki, krokiewki (V), gwiazdki, galony.
const PAGONY = {
  'Szeregowy': {}, 'Starszy szeregowy': { bars: 1 }, 'Kapral': { bars: 2 }, 'Starszy kapral': { bars: 3 }, 'Plutonowy': { bars: 4 },
  'Sierżant': { chev: 1 }, 'Starszy sierżant': { chev: 2 },
  'Młodszy chorąży': { chev: 1, stars: 1, edge: true }, 'Chorąży': { stars: 1, edge: true }, 'Starszy chorąży': { stars: 2, edge: true },
  'Starszy chorąży sztabowy': { stars: 4, edge: true },
  'Podporucznik': { stars: 2 }, 'Porucznik': { stars: 3 }, 'Kapitan': { stars: 4 },
  'Major': { stars: 1, galon: true }, 'Podpułkownik': { stars: 2, galon: true }, 'Pułkownik': { stars: 3, galon: true },
};
function starPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ' ' + (cy + rr * Math.sin(a)).toFixed(1);
  }
  return d + 'Z';
}
function pagonSVG(name, size) {
  const p = PAGONY[name] || {};
  const S = '#DCE0E5';
  let inner = '';
  let y = 54; // od dołu
  if (p.galon) { inner += `<rect x="7" y="51" width="26" height="3.6" rx="1" fill="${S}"/><rect x="7" y="45.5" width="26" height="3.6" rx="1" fill="${S}"/>`; y = 40; }
  for (let i = 0; i < (p.bars || 0); i++) inner += `<rect x="7" y="${51 - i * 6}" width="26" height="3.4" rx="1" fill="${S}"/>`;
  for (let i = 0; i < (p.chev || 0); i++) { const cy = 43 - i * 7; inner += `<path d="M8 ${cy} L20 ${cy + 7} L32 ${cy}" fill="none" stroke="${S}" stroke-width="3.2" stroke-linejoin="round"/>`; y = cy - 5; }
  const n = p.stars || 0;
  const gap = n >= 4 ? 7.2 : 8.5;
  for (let i = 0; i < n; i++) inner += `<path d="${starPath(20, y - 3 - i * gap, 3.4)}" fill="${S}"/>`;
  const edge = p.edge ? '#C9CED4' : '#6B737C';
  const s = size || 40;
  return `<svg width="${Math.round(s * 40 / 62)}" height="${s}" viewBox="0 0 40 62" role="img" aria-label="Pagon: ${name}">` +
    `<path d="M4 16 L20 3 L36 16 L36 60 L4 60 Z" fill="#3E444B" stroke="${edge}" stroke-width="${p.edge ? 2.4 : 1.5}" stroke-linejoin="round"/>` +
    `<circle cx="20" cy="15" r="4.2" fill="#C9CED4" stroke="#8A929B" stroke-width="1"/>` + inner + `</svg>`;
}
function pagon(r, size) {
  const el = h('span', { class: 'pagon' });
  el.innerHTML = pagonSVG(RANKS[r][1], size);
  return el;
}

// Tło karty głównej: wieżyczka strażnicza i ogrodzenie (ozdobne).
function towerBg() {
  const el = h('span', { class: 'hero-bg', 'aria-hidden': 'true' });
  let fence = '';
  for (let x = 4; x <= 196; x += 16) fence += `<rect x="${x}" y="70" width="2.2" height="40"/>`;
  let wire = 'M0 72';
  for (let x = 0; x <= 200; x += 8) wire += ` L${x + 4} ${x % 16 ? 69 : 75}`;
  el.innerHTML = `<svg viewBox="0 0 200 110" preserveAspectRatio="xMaxYMax meet" fill="currentColor">` +
    `<path d="M0 96 Q40 84 80 92 T160 88 T200 90 V110 H0Z" opacity=".5"/>` +
    fence + `<rect x="0" y="82" width="200" height="1.6"/><rect x="0" y="100" width="200" height="1.6"/>` +
    `<path d="${wire}" fill="none" stroke="currentColor" stroke-width="1.2"/>` +
    `<path d="M144 110 L150 42 H154 L149 110Z M176 110 L170 42 H166 L171 110Z"/>` +
    `<path d="M150 60 L170 74 M170 60 L150 74 M148 84 L172 96 M172 84 L148 96" stroke="currentColor" stroke-width="1.6"/>` +
    `<rect x="140" y="28" width="40" height="15" rx="1.5"/><rect x="138" y="42" width="44" height="3"/>` +
    `<path d="M135 28 L160 12 L185 28Z"/><rect x="158" y="6" width="4" height="7"/>` +
    `<path d="M140 31 L104 18 L104 26Z" opacity=".35"/>` +
    `</svg>`;
  return el;
}

function heroCard() {
  const g = game();
  const r = g.rank, next = RANKS[r + 1];
  const from = RANKS[r][0];
  const prog = next ? (g.points - from) / (next[0] - from) : 1;
  const today = g.days[dayKey(new Date())] || 0;
  const goal = dailyGoal();
  const gp = Math.min(1, today / goal);
  const dte = daysToExam();
  const card = h('section', { class: 'card hero' }, towerBg());
  const bk = bielikCard();
  if (bk) card.append(bk, h('div', { class: 'hero-sep' }));
  const chip = (ic, cls, text, href) => h(href ? 'a' : 'span', { class: 'chip ' + cls, href }, icon(ic, 16), h('span', {}, text));
  card.append(
    h('a', { class: 'hero-rank', href: '#/teczka', 'aria-label': `Stopień ${RANKS[r][1]}, ${g.points} punktów – otwórz Teczkę` },
      pagon(r, 46),
      h('div', { class: 'hero-main' },
        h('div', { class: 'hero-rline' }, h('strong', {}, RANKS[r][1]), h('span', { class: 'hero-pts' }, `${g.points} pkt`)),
        h('div', { class: 'xp' }, h('i', { style: `width:${Math.round(prog * 100)}%` })),
        h('div', { class: 'hero-next' }, next ? `${next[0] - g.points} pkt do stopnia ${next[1]}` : 'Najwyższy stopień')),
      h('div', { class: 'ring', style: `--p:${Math.round(gp * 100)}`, title: 'Dzienny cel', 'aria-label': `Dzienny cel: ${today} z ${goal}` },
        h('span', {}, gp >= 1 ? '✓' : h('b', {}, String(today)), gp >= 1 ? null : h('small', {}, `z ${goal}`)))),
    h('div', { class: 'chips' },
      chip('flame', 'c-fire', `${streakDays()} ${plural(streakDays(), 'dzień', 'dni', 'dni')}`),
      chip('medal', 'c-gold', `${Object.keys(g.badges).length} ${plural(Object.keys(g.badges).length, 'odznaka', 'odznaki', 'odznak')}`, '#/teczka'),
      chip('cal', 'c-blue', dte >= 0 ? `${dte} ${plural(dte, 'dzień', 'dni', 'dni')} do egzaminu` : 'ustaw datę egzaminu', '#/teczka'),
      chip('target', 'c-green', `Gotowość ${readiness()}%`)));
  return card;
}

function gameTile() {
  return h('button', { type: 'button', class: 'game-tile', onclick: () => {
    if (BIELIK_ON()) bielikPop('gra.wkrotce', {}, { force: true });
    else toast('🚧', 'Pierwsza służba – już wkrótce', 'Gra fabularna jest w przygotowaniu.');
  } },
    h('span', { class: 'game-ic' }, icon('flag', 24)),
    h('span', { class: 'game-text' },
      h('span', { class: 'game-title' }, 'Pierwsza służba', h('span', { class: 'soon' }, 'WKRÓTCE')),
      h('span', { class: 'game-sub' }, 'Gra fabularna: jeden dzień w zakładzie karnym, twoje decyzje i Chorąży Bielik.')),
    icon('lock', 20, 'game-lock'));
}

const BADGE_IMG = id => `obrazy/odznaki/${id}.webp`;
function badgeImg(id, size, locked) {
  return h('img', { src: BADGE_IMG(id), width: size, height: size, alt: '', class: 'badge-img' + (locked ? ' locked' : ''), decoding: 'async' });
}

// Skuteczność w tematach – wykres słupkowy (Teczka).
function accuracyChart() {
  const g = game();
  const rows = Object.entries(g.deckStats || {}).filter(([id, s]) => deckById[id] && s.n >= 5)
    .sort((a, b) => b[1].n - a[1].n).slice(0, 5)
    .map(([id, s]) => ({ name: deckById[id].name, p: Math.round(s.ok / s.n * 100), n: s.n }));
  const sec = h('section', { class: 'card' }, h('h2', { class: 'card-h' }, icon('target', 20), 'Skuteczność w tematach'));
  if (!rows.length) { sec.append(h('p', { class: 'small muted' }, 'Odpowiedz na kilka pytań z różnych tematów – tu pojawi się wykres.')); return sec; }
  const short = n => (n.length > 22 ? n.slice(0, 20).trim() + '…' : n);
  sec.append(h('div', { class: 'chart', role: 'img', 'aria-label': rows.map(r => `${r.name}: ${r.p}%`).join(', ') },
    rows.map(r => h('div', { class: 'col' },
      h('span', { class: 'col-v' }, r.p + '%'),
      h('div', { class: 'col-track' }, h('i', { class: r.p >= 80 ? 'hi' : r.p >= 60 ? 'mid' : 'lo', style: `height:${Math.max(4, r.p)}%` })),
      h('span', { class: 'col-l', title: r.name }, short(r.name))))),
    h('p', { class: 'small muted', style: 'margin:8px 0 0' }, 'Najczęściej ćwiczone tematy · odsetek dobrych odpowiedzi.'));
  return sec;
}

Object.assign(BIELIK_TEKSTY, {
  'gra.wkrotce': [
    { m: 'czujny', t: 'Pierwsza służba jeszcze się szykuje. Na razie musztra na sucho – do roboty.' },
    { m: 'znudzony', t: 'Gra będzie, jak będzie. Egzamin jest szybciej. Wiesz, co robić.' }],
});

init();

/* =====================================================================
   v30: Szukaj, Kto co robi, Milionerzy, Prawda czy fałsz,
        Bielik – rozkazy dnia, musztra znienacka, słabe punkty
   ===================================================================== */

let answerMode = null;   // nadpisuje currentRoute przy liczeniu rozkazów (np. musztra na ekranie startowym)
let lastChoice = null;   // { id, text } – ostatnio wybrana odpowiedź w pytaniu testowym

/* ---------- Organy (Kto co robi + słabe punkty Bielika) ---------- */

const ORGANY = [
  ['prezydent', 'Prezydent RP', /prezydent/i],
  ['premier', 'Prezes Rady Ministrów', /prezes\w* rady ministrów|premier/i],
  ['ms', 'Minister Sprawiedliwości', /minist\w* sprawiedliwości/i],
  ['dg', 'Dyrektor Generalny SW', /dyrektor\w* generaln/i],
  ['do', 'Dyrektor okręgowy SW', /dyrektor\w* okręgow/i],
  ['komisja', 'Komisja penitencjarna', /komisj\w* penitencjarn/i],
  ['sedzia', 'Sędzia penitencjarny', /sędzi\w* penitencjarn/i],
  ['sadpen', 'Sąd penitencjarny', /sąd\w* penitencjarn/i],
  ['sad', 'Sądy i trybunały', /(^|\s)sąd|trybunał/i],
  ['dyr', 'Dyrektor ZK / AŚ', /dyrektor/i],
  ['komendant', 'Komendant', /komendan/i],
  ['kierownik', 'Kierownik jednostki / działu', /kierownik/i],
  ['wychowawca', 'Wychowawca', /wychowawc/i],
  ['lekarz', 'Lekarz / psycholog', /lekarz|psycholog/i],
  ['oddzialowy', 'Oddziałowy', /oddziałow/i],
  ['dowodca', 'Dowódca zmiany / konwoju', /dowódc/i],
  ['rpo', 'Rzecznik Praw Obywatelskich', /rzecznik/i],
  ['policja', 'Policja / prokurator', /policj|prokurat/i],
];
const ORGAN_NAME = Object.fromEntries(ORGANY.map(o => [o[0], o[1]]));
function organOf(text) {
  for (const o of ORGANY) if (o[2].test(text || '')) return o[0];
  return null;
}

// Pytanie „kto?”: poprawna odpowiedź i (prawie) wszystkie inne to organy / osoby.
let ktoCache = null;
function isKtoItem(it) {
  if (it.type !== 'mcq' || it.options.length < 3) return false;
  const os = it.options.map(organOf);
  return !!os[it.answer] && os.filter(Boolean).length >= it.options.length - 1 && new Set(os.filter(Boolean)).size >= 2;
}
function ktoItems(decks) {
  if (!ktoCache) ktoCache = DATA.items.filter(isKtoItem);
  const set = new Set(decks || selectedDecks());
  let list = ktoCache.filter(it => set.has(it.deck));
  if (list.length < 10) list = ktoCache.slice();
  return pickVariants(list);
}

function renderKto(tab) {
  screen('Kto co robi', true);
  const items = ktoItems();
  if (!items.length) return emptyScreen('Kto co robi', '📭', 'Brak pytań o kompetencje.');
  const t = tab || 'cwicz';
  $app.append(sizeLikePicker([['cwicz', '🎯 Ćwicz'], ['sciaga', '📋 Ściągawka']], t, v => renderKto(v)));
  if (t === 'cwicz') {
    const n = state.settings.ktoSize ?? 15;
    $app.append(h('div', { class: 'card' },
      h('p', { style: 'margin-top:0' }, 'Pytania o to, ', h('strong', {}, 'kto'), ' powołuje, nadaje, wymierza, udziela zgody, klasyfikuje… Na egzaminie to najczęstsza pułapka – organy łatwo pomylić.'),
      h('p', { class: 'small muted' }, `${items.length} ${plural(items.length, 'pytanie', 'pytania', 'pytań')} z wybranych tematów (gdy za mało – ze wszystkich). Najpierw te, których jeszcze nie było.`)),
      h('p', { class: 'small muted' }, 'Ile pytań?'),
      sizePicker([10, 15, 25, 0], n, v => { state.settings.ktoSize = v; save(); renderKto('cwicz'); }),
      h('div', { class: 'stack', style: 'margin-top:12px' }, btn('Start', 'primary', runKto)));
  } else {
    const groups = {};
    for (const it of items) {
      const o = organOf(it.options[it.answer]);
      (groups[o] || (groups[o] = [])).push(it);
    }
    $app.append(h('p', { class: 'small muted' }, 'Kompetencje zebrane z pytań w bazie – pogrupowane według organu, który jest poprawną odpowiedzią.'));
    for (const [id, name] of ORGANY.map(o => [o[0], o[1]])) {
      const g = groups[id];
      if (!g) continue;
      $app.append(h('details', { class: 'card kto-group' },
        h('summary', {}, h('span', {}, name), h('span', { class: 'count' }, g.length)),
        h('ul', { class: 'kto-list' }, g.map(it => h('li', {},
          h('span', {}, it.question.replace(/[:?]\s*$/, '')), ' → ', h('strong', {}, it.options[it.answer]))))));
    }
  }
}

function runKto() {
  const n = state.settings.ktoSize ?? 15;
  const items = shuffle(freshFirst(ktoItems(), n));
  runSequence('Kto co robi', items, runKto, { celebrate: true, onShow: markTestSeen });
}

/* ---------- Szukaj w pytaniach ---------- */

function itemSearchText(it) {
  const parts = [it.question, it.front, it.back, it.title, it.scenario, it.prompt, it.explanation, it.source,
    it.text && String(it.text).replace(/\[\[|\]\]/g, ''),
    ...(it.options || []), ...(it.steps || []).map(s => (typeof s === 'string' ? s : [s.question, ...(s.options || []), s.explanation].join(' '))),
    ...(it.pairs || []).map(p => p.join(' '))];
  return fold(parts.filter(Boolean).join(' '));
}
let searchIndex = null;

function answerBlock(it) {
  if (it.type === 'mcq') return h('div', { class: 'good' }, '✓ ' + it.options[it.answer]);
  if (it.type === 'flashcard') return h('div', { class: 'good' }, it.back);
  if (it.type === 'cloze') return h('div', { class: 'good' }, String(it.text).replace(/\[\[([^\]]*)\]\]/g, (m, a) => a.split('|')[0]));
  if (it.type === 'order') return h('div', { class: 'good' }, (it.steps || []).map((s, i) => `${i + 1}. ${s}`).join('  ·  '));
  if (it.type === 'pairs') return h('div', { class: 'good' }, it.pairs.map(p => p.join(' = ')).join('  ·  '));
  if (it.type === 'case') return h('div', {}, h('p', { class: 'small', style: 'margin:4px 0' }, it.scenario),
    it.steps.map(s => h('div', { class: 'good' }, `${s.question} → ${s.options[s.answer]}`)));
  return null;
}

function renderSearch() {
  screen('Szukaj w pytaniach', true);
  if (!searchIndex) searchIndex = DATA.items.map(it => [it, itemSearchText(it)]);
  const q0 = state.settings.lastSearch || '';
  const input = h('input', { type: 'search', class: 'search-input', placeholder: 'np. cela izolacyjna, 14 dni, komisja…', value: q0,
    'aria-label': 'Szukana fraza', enterkeyhint: 'search' });
  const info = h('p', { class: 'small muted' });
  const list = h('div');
  const practice = h('div', { class: 'stack' });
  let t = null;
  const run = () => {
    const q = fold(input.value.trim());
    state.settings.lastSearch = input.value.trim();
    list.replaceChildren(); practice.replaceChildren();
    if (q.length < 3) { info.textContent = 'Wpisz co najmniej 3 znaki. Szukam we wszystkich tematach: w treści pytań, odpowiedziach, wyjaśnieniach i podstawie prawnej.'; return; }
    const words = q.split(' ').filter(Boolean);
    const found = searchIndex.filter(([, txt]) => words.every(w => txt.includes(w))).map(([it]) => it);
    info.textContent = found.length ? `Znaleziono: ${found.length}` + (found.length > 60 ? ' (pokazuję 60 pierwszych)' : '') : 'Nic nie znaleziono. Spróbuj krótszej frazy albo innego słowa.';
    if (found.length) practice.append(btn(`🎯 Ćwicz znalezione (${Math.min(found.length, 30)})`, 'primary', () => {
      runSequence('Ćwiczenie: ' + input.value.trim(), shuffle(found).slice(0, 30), () => renderSearch(), { celebrate: true });
    }));
    for (const it of found.slice(0, 60)) {
      list.append(h('div', { class: 'card mistake search-hit' },
        h('div', { class: 'tags-row' }, h('span', { class: 'tag' }, deckById[it.deck] ? deckById[it.deck].name : it.deck)),
        h('div', { class: 'q' }, itemLabel(it)), answerBlock(it), sourceEl(it)));
    }
  };
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(run, 180); });
  $app.append(input, info, practice, list);
  run();
  setTimeout(() => input.focus(), 50);
}

/* ---------- Dane „publiczności” (wyniki całego kursu) ---------- */

const PUB_KEY = 'nauka-sw-pub';
let pubData = null;
function loadPub() {
  if (pubData) return pubData;
  try { pubData = JSON.parse(localStorage.getItem(PUB_KEY) || 'null'); } catch (e) { pubData = null; }
  return pubData || { t: 0, d: {} };
}
async function fetchPub() {
  if (!HAS_SERVER) return;
  const p = loadPub();
  if (Date.now() - (p.at || 0) < 12 * 3600000) return;
  try {
    const r = await fetch('/api/publicznosc');
    if (!r.ok) return;
    const j = await r.json();
    pubData = { ...j, at: Date.now() };
    localStorage.setItem(PUB_KEY, JSON.stringify(pubData));
  } catch (e) { /* bez sieci */ }
}
// Trudność 0–1 (odsetek błędów): kurs → własna historia → domyślna.
function difficulty(it) {
  const p = loadPub().d[it.id];
  if (p && p[0] >= 5) return p[1] / p[0];
  const r = state.hist[it.id];
  if (r && r.n) return Math.min(0.9, r.bad / r.n * 0.8 + 0.1);
  return 0.35;
}

/* ---------- Milionerzy ---------- */

const MILION_KWOTY = ['500 zł', '1 000 zł', '2 000 zł', '5 000 zł', '10 000 zł', '20 000 zł', '40 000 zł', '75 000 zł', '125 000 zł', '250 000 zł', '500 000 zł', '1 000 000 zł'];
const MILION_PROGI = [1, 6]; // indeksy kwot gwarantowanych (1 000 zł i 40 000 zł)
const MILION_BONUS = 100;
let milion = null;

function milionPool() {
  return pool(['mcq']).filter(it => it.options.length === 4 && !it.img);
}

function renderMilion() {
  screen('Milionerzy', true);
  const n = milionPool().length;
  if (n < 12) return emptyScreen('Milionerzy', '📭', 'Za mało pytań z czterema odpowiedziami w wybranych tematach (potrzeba 12).');
  const best = state.settings.milionBest;
  $app.append(h('div', { class: 'card empty' },
    h('div', { class: 'big' }, '💰'),
    h('p', {}, '12 pytań, coraz trudniejszych. Każda dobra odpowiedź to wyższa kwota. Jedna pomyłka – spadasz do ostatniego progu gwarantowanego (1 000 zł albo 40 000 zł).'),
    h('p', { class: 'small' }, 'Koła ratunkowe (każde raz): ', h('strong', {}, '50:50'), ', ', h('strong', {}, '🦅 Zapytaj Bielika'), ', ', h('strong', {}, '👥 Pytanie do publiczności'),
      ' – pokazuje, jak na to pytanie odpowiadali kursanci.'),
    h('p', { class: 'small muted' }, best != null ? `Twój najlepszy wynik: ${MILION_KWOTY[best]}` : 'Pierwsza gra – powodzenia!')),
    h('div', { class: 'stack' }, btn('Gramy!', 'primary', startMilion), btn('Wróć do startu', '', () => { location.hash = '#/'; })));
}

function startMilion() {
  const all = shuffle(milionPool()).slice(0, 72).map(it => [it, difficulty(it) + Math.random() * 0.08]);
  all.sort((a, b) => a[1] - b[1]);
  const third = Math.floor(all.length / 3);
  const tier = (from, to, k) => shuffle(all.slice(from, to)).slice(0, k).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  const qs = [...tier(0, third, 4), ...tier(third, 2 * third, 4), ...tier(2 * third, all.length, 4)];
  milion = { qs, i: 0, used: {}, removed: [], over: false };
  milionStep();
}

function milionSafe(i) { // kwota gwarantowana po błędzie na pytaniu i
  let s = -1;
  for (const p of MILION_PROGI) if (p < i) s = p;
  return s;
}

function milionStep() {
  const m = milion;
  if (!m) return;
  const it = m.qs[m.i];
  m.removed = [];
  m.order = m.order && m.order.id === it.id ? m.order : { id: it.id, o: shuffle([0, 1, 2, 3]) };
  screen('Milionerzy', true);
  const ladder = h('details', { class: 'card milion-ladder' },
    h('summary', {}, h('span', {}, `Pytanie ${m.i + 1} z 12 · za `, h('strong', {}, MILION_KWOTY[m.i])),
      h('span', { class: 'count' }, m.i ? `masz: ${MILION_KWOTY[m.i - 1]}` : '')),
    h('ol', { reversed: '' }, MILION_KWOTY.slice().reverse().map((k, j) => {
      const idx = 11 - j;
      return h('li', { class: (idx === m.i ? 'now ' : '') + (idx < m.i ? 'done ' : '') + (MILION_PROGI.includes(idx) ? 'safe' : '') }, k);
    })));
  const letters = ['A', 'B', 'C', 'D'];
  const help = h('div', { class: 'milion-help' });
  const buttons = m.order.o.map((oi, k) => h('button', { type: 'button', class: 'btn option milion-opt', onclick: () => choose(oi, buttons[k]) },
    h('span', { class: 'ml' }, letters[k] + ':'), ' ', it.options[oi]));
  const lifelines = h('div', { class: 'milion-lifelines' },
    h('button', { type: 'button', class: 'btn small-btn', disabled: !!m.used.half, onclick: e => { e.currentTarget.disabled = true; half(); } }, '50:50'),
    h('button', { type: 'button', class: 'btn small-btn', disabled: !!m.used.bielik, onclick: e => { e.currentTarget.disabled = true; askBielik(); } }, '🦅 Bielik'),
    h('button', { type: 'button', class: 'btn small-btn', disabled: !!m.used.pub, onclick: e => { e.currentTarget.disabled = true; askPub(); } }, '👥 Publiczność'));
  const quit = m.i ? btn(`🏳️ Rezygnuję – biorę ${MILION_KWOTY[m.i - 1]}`, 'ghost', () => milionEnd('quit')) : null;
  $app.append(ladder, lifelines,
    h('div', { class: 'card' }, h('div', { class: 'question' }, it.question), h('div', { class: 'options' }, buttons), help),
    h('div', { class: 'actions' }));
  if (quit) $app.append(quit);
  qShownAt = Date.now();
  let locked = false;

  function half() {
    m.used.half = true;
    const wrong = shuffle([0, 1, 2, 3].filter(x => x !== it.answer)).slice(0, 2);
    m.removed = wrong;
    buttons.forEach((b, k) => { if (wrong.includes(m.order.o[k])) { b.disabled = true; b.classList.add('gone'); } });
  }
  function askBielik() {
    m.used.bielik = true;
    const d = difficulty(it);
    const pRight = d < 0.25 ? 0.9 : d < 0.45 ? 0.78 : 0.62;
    const avail = [0, 1, 2, 3].filter(x => !m.removed.includes(x));
    const pick = Math.random() < pRight ? it.answer : shuffle(avail.filter(x => x !== it.answer))[0];
    const key = d < 0.25 ? 'milion.pewny' : d < 0.45 ? 'milion.raczej' : 'milion.niepewny';
    const line = bielikLine(key, { odp: it.options[pick] }) || { m: 'czujny', t: `Stawiałbym na „${it.options[pick]}”.` };
    help.append(h('div', { class: 'bielik-comment' }, bielikFigure(line.m, 56), h('div', { class: 'bielik-bubble' }, line.t)));
  }
  function askPub() {
    m.used.pub = true;
    const p = loadPub().d[it.id];
    const real = p && p[0] >= 5;
    let right = real ? (p[0] - p[1]) / p[0] : Math.max(0.3, Math.min(0.9, 1 - difficulty(it) + (Math.random() - 0.5) * 0.2));
    const avail = [0, 1, 2, 3].filter(x => !m.removed.includes(x) && x !== it.answer);
    const rest = 1 - right;
    const w = avail.map(() => 0.3 + Math.random());
    const sw = w.reduce((a, b) => a + b, 0);
    const share = { [it.answer]: right };
    avail.forEach((x, k) => { share[x] = rest * w[k] / sw; });
    const rows = m.order.o.map((oi, k) => {
      const v = Math.round((share[oi] || 0) * 100);
      return h('div', { class: 'pub-row' }, h('span', { class: 'pub-l' }, letters[k]),
        h('div', { class: 'pub-bar' }, h('i', { style: `width:${v}%` })), h('span', { class: 'pub-v' }, v + '%'));
    });
    help.append(h('div', { class: 'pub-box' },
      h('div', { class: 'small' }, h('strong', {}, '👥 Publiczność'), ' – ', real ? `tak odpowiadali kursanci (${p[0]} ${plural(p[0], 'odpowiedź', 'odpowiedzi', 'odpowiedzi')})` : 'symulacja: za mało odpowiedzi z kursu na to pytanie'),
      rows));
  }
  function choose(oi, b) {
    if (locked) return;
    locked = true;
    lifelines.querySelectorAll('button').forEach(x => { x.disabled = true; });
    if (quit) quit.disabled = true;
    b.classList.add('selected');
    setTimeout(() => {
      const ok = oi === it.answer;
      buttons.forEach((x, k) => { x.disabled = true; if (m.order.o[k] === it.answer) x.classList.add('correct'); else if (m.order.o[k] === oi) x.classList.add('wrong'); });
      lastChoice = { id: it.id, text: it.options[oi] };
      answerMode = 'milionerzy';
      record(it, ok ? 'ok' : 'bad');
      answerMode = null;
      const d = game().daily;
      if (d) { d.milionMax = Math.max(d.milionMax || 0, ok ? m.i + 1 : m.i); checkRozkazy(); save(); }
      const acts = $app.querySelector('.actions');
      help.append(feedback(ok, ok ? `Dobrze! Masz ${MILION_KWOTY[m.i]}.` : 'Niestety. Poprawna odpowiedź: ' + it.options[it.answer],
        it.explanation ? h('div', {}, it.explanation) : null, sourceEl(it)));
      if (!ok) nextButton(acts, () => milionEnd('lost'), 'Koniec gry');
      else if (m.i === 11) nextButton(acts, () => milionEnd('win'), '🏆 Odbierz milion');
      else nextButton(acts, () => { m.i++; milionStep(); }, `Pytanie za ${MILION_KWOTY[m.i + 1]}`);
    }, 900);
  }
}

function milionEnd(how) {
  const m = milion;
  milion = null;
  if (!m) return;
  const won = how === 'win' ? 11 : how === 'quit' ? m.i - 1 : milionSafe(m.i);
  const best = state.settings.milionBest;
  const isBest = won >= 0 && (best == null || won > best);
  if (isBest) state.settings.milionBest = won;
  if (how === 'win') { addPoints(MILION_BONUS); evaluate(); }
  save();
  screen('Milionerzy', true);
  const kwota = won >= 0 ? MILION_KWOTY[won] : '0 zł';
  const key = how === 'win' ? 'milion.wygrana' : how === 'quit' ? 'milion.rezygnacja' : 'milion.przegrana';
  $app.append(h('div', { class: 'card verdict ' + (how === 'win' ? 'v-gold' : won >= 6 ? 'v-green' : 'v-red') },
    h('div', { class: 'verdict-icon', 'aria-hidden': 'true' }, how === 'win' ? '🏆' : how === 'quit' ? '🏳️' : '💸'),
    h('div', { class: 'score' }, kwota),
    h('div', { class: 'score-sub' }, how === 'win' ? `Wszystkie 12 pytań! +${MILION_BONUS} pkt premii` : how === 'quit' ? `Rezygnacja po ${m.i} ${plural(m.i, 'pytaniu', 'pytaniach', 'pytaniach')}` : `Odpadłeś na pytaniu ${m.i + 1} za ${MILION_KWOTY[m.i]}`),
    isBest && how !== 'win' && won >= 0 ? h('div', { class: 'verdict-head' }, 'Nowy rekord!') : null,
    bielikComment(key, { kwota: MILION_KWOTY[m.i] || kwota })));
  if (how === 'win') confetti();
  $app.append(h('div', { class: 'stack' }, btn('Zagraj jeszcze raz', 'primary', startMilion), btn('Wróć do startu', '', () => { location.hash = '#/'; })));
}

/* ---------- Prawda czy fałsz (przesuwanie kart) ---------- */

const PRAWDA_SIZE = 20;
const TF_RE = /^prawda czy fałsz:?\s*/i;
const BAD_OPT_RE = /wszystk\w* (wymienion|odpowiedzi|powyższ)|żadn\w* z (powyższ|wymienion)|obie odpowiedzi|nie ma takiego/i;

function prawdaCards(n) {
  const list = [];
  for (const it of shuffle(pool(['mcq']).filter(x => !x.img))) {
    if (list.length >= n) break;
    const o = it.options.map(x => x.trim().toLowerCase());
    if (o.length === 2 && o[0] === 'prawda' && o[1] === 'fałsz') {
      list.push({ it, text: it.question.replace(TF_RE, ''), shown: null, truth: it.answer === 0 });
      continue;
    }
    if (/\bNIE\b|FAŁSZ|BŁĘDN|NIEPRAWDZIW|nieprawdziw|błędn/.test(it.question)) continue;
    if (it.options.some(x => BAD_OPT_RE.test(x))) continue;
    const truth = Math.random() < 0.5;
    const wrong = it.options.map((_, i) => i).filter(i => i !== it.answer);
    const oi = truth ? it.answer : wrong[Math.floor(Math.random() * wrong.length)];
    list.push({ it, text: it.question, shown: it.options[oi], truth });
  }
  return list;
}

function renderPrawda() {
  const cards = prawdaCards(PRAWDA_SIZE);
  if (cards.length < 5) return emptyScreen('Prawda czy fałsz', '📭', 'Za mało pytań w wybranych tematach.');
  const s = { cards, i: 0, ok: 0, run: 0, bestRun: 0, bad: [] };
  prawdaStep(s);
}

function prawdaStep(s) {
  if (s.i >= s.cards.length) return prawdaSummary(s);
  const c = s.cards[s.i];
  screen('Prawda czy fałsz', true);
  $app.append(h('div', { class: 'progress-line' }, h('span', {}, `${s.i + 1} / ${s.cards.length}`), h('span', {}, `Dobrze: ${s.ok}` + (s.run >= 3 ? ` · 🔥 ${s.run}` : ''))));
  const stampT = h('div', { class: 'swipe-stamp t' }, 'PRAWDA');
  const stampF = h('div', { class: 'swipe-stamp f' }, 'FAŁSZ');
  const card = h('div', { class: 'card swipe-card', tabindex: '0', 'aria-label': 'Karta: przesuń w prawo – prawda, w lewo – fałsz' },
    stampT, stampF,
    h('div', { class: 'tags-row' }, h('span', { class: 'tag' }, deckById[c.it.deck] ? deckById[c.it.deck].name : c.it.deck)),
    h('div', { class: 'question' }, c.text),
    c.shown != null ? h('div', { class: 'swipe-answer' }, '→ ', c.shown) : null);
  const after = h('div');
  const bF = btn('✗ Fałsz', 'bad', () => judge(false));
  const bT = btn('✓ Prawda', 'ok', () => judge(true));
  const row = h('div', { class: 'row swipe-btns' }, bF, bT);
  $app.append(h('p', { class: 'small muted swipe-hint' }, 'Przesuń kartę: w prawo ➜ prawda, w lewo ⬅ fałsz'), card, row, after);
  let done = false, x0 = null, dx = 0;
  const move = x => {
    dx = x;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
    stampT.style.opacity = Math.max(0, Math.min(1, dx / 90));
    stampF.style.opacity = Math.max(0, Math.min(1, -dx / 90));
  };
  card.addEventListener('pointerdown', e => { if (done) return; x0 = e.clientX; card.setPointerCapture(e.pointerId); card.classList.add('drag'); });
  card.addEventListener('pointermove', e => { if (x0 != null && !done) move(e.clientX - x0); });
  const up = () => {
    if (x0 == null) return;
    x0 = null;
    card.classList.remove('drag');
    if (Math.abs(dx) > 80) judge(dx > 0);
    else move(0);
  };
  card.addEventListener('pointerup', up);
  card.addEventListener('pointercancel', up);
  card.addEventListener('keydown', e => { if (e.key === 'ArrowRight') judge(true); if (e.key === 'ArrowLeft') judge(false); });
  setTimeout(() => card.focus({ preventScroll: true }), 30);

  function judge(say) {
    if (done) return;
    done = true;
    const ok = say === c.truth;
    card.classList.add(ok ? 'right' : 'miss');
    move(say ? 160 : -160);
    card.style.opacity = ok ? '.0' : '1';
    if (!ok) { card.style.transform = ''; card.style.opacity = '1'; stampT.style.opacity = 0; stampF.style.opacity = 0; }
    bF.disabled = bT.disabled = true;
    answerMode = 'prawda';
    pointsMult = 0.5;
    if (!ok) record(c.it, 'bad');
    else if (!c.truth && state.hist[c.it.id] && state.hist[c.it.id].last === 'bad') noteAnswer(c.it, 3);
    else record(c.it, 'ok');
    pointsMult = 1;
    answerMode = null;
    if (ok) { s.ok++; s.run++; s.bestRun = Math.max(s.bestRun, s.run); setTimeout(() => { s.i++; prawdaStep(s); }, 380); return; }
    s.run = 0;
    s.bad.push(c);
    row.hidden = true;
    after.append(feedback(false, c.truth ? 'To była prawda.' : 'To był fałsz.',
      h('div', {}, 'Poprawna odpowiedź: ', h('strong', {}, c.it.options[c.it.answer])),
      c.it.explanation ? h('div', {}, c.it.explanation) : null, sourceEl(c.it)),
      h('div', { class: 'actions' }, btn(s.i + 1 >= s.cards.length ? 'Zobacz wynik' : 'Dalej', 'primary', () => { s.i++; prawdaStep(s); })));
  }
}

function prawdaSummary(s) {
  screen('Prawda czy fałsz', true);
  const p = pct(s.ok, s.cards.length);
  $app.append(verdictCard(p, `${s.ok} z ${s.cards.length} trafnie · najdłuższa seria: ${s.bestRun}`, worstDeck(s.bad.map(c => c.it))));
  $app.append(h('div', { class: 'stack' }, btn('Jeszcze raz', 'primary', renderPrawda), btn('Wróć do startu', '', () => { location.hash = '#/'; })));
  if (s.bad.length) {
    $app.append(h('h2', {}, 'Pomyłki'));
    for (const c of s.bad) $app.append(h('div', { class: 'card mistake' }, h('div', { class: 'q' }, c.text),
      c.shown != null ? h('div', { class: 'small muted' }, `Na karcie: ${c.shown} – ${c.truth ? 'prawda' : 'fałsz'}`) : null,
      h('div', { class: 'good' }, '✓ ' + c.it.options[c.it.answer])));
  }
}

// Odpowiedź liczona do celu dziennego i rozkazów, ale bez zmiany historii pytania.
function noteAnswer(item, pts) {
  const g = game();
  const day = dayKey(new Date());
  g.days[day] = (g.days[day] || 0) + 1;
  g.counters.answers++;
  if (pts) addPoints(pts);
  trackDaily(item, 'ok', null);
  save();
}

/* ---------- Rozkazy dnia ---------- */

const ROZKAZ_PTS = 15, ROZKAZY_BONUS = 30;

let shownDay = dayKey(new Date());
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const d = dayKey(new Date());
  if (d !== shownDay) { shownDay = d; if (DATA && (location.hash === '' || location.hash === '#/')) route(); }
});

function ensureDaily() {
  const g = game();
  const day = dayKey(new Date());
  if (!g.daily || g.daily.day !== day) {
    const prev = g.daily && g.daily.list ? g.daily.list : [];
    g.daily = { day, ok: 0, fixed: 0, n: 0, deck: {}, mode: {}, sprintMax: 0, milionMax: 0, list: null, done: [],
      prevDeck: (prev.find(r => r.k === 'deck') || {}).id || null, prevExtra: prev.length ? prev[prev.length - 1].k : null };
  }
  if (!g.daily.list) g.daily.list = makeRozkazy(day);
  return g.daily;
}

function weakestDeckId(skip) {
  let worst = null;
  for (const [id, s] of Object.entries(game().deckStats || {})) {
    if (!deckById[id] || s.n < 10 || id === skip) continue;
    if (DATA.items.filter(i => i.deck === id && i.type === 'mcq').length < 10) continue;
    const acc = s.ok / s.n;
    if (!worst || acc < worst.acc) worst = { id, acc };
  }
  return worst && worst.acc < 0.85 ? worst.id : null;
}

function makeRozkazy(day) {
  const rnd = seeded('rozkazy' + day);
  const prevD = game().daily || {};
  const yesterday = prevD.prevDeck ? { id: prevD.prevDeck } : null;
  const goal = dailyGoal();
  const okN = Math.max(10, Math.min(25, Math.round(goal * 0.4 / 5) * 5));
  const decks = selectedDecks().filter(id => DATA.items.filter(i => i.deck === id && i.type === 'mcq').length >= 10);
  const weak = weakestDeckId(yesterday && yesterday.id);
  const list = [];
  if (weak) list.push({ k: 'deck', n: 10, id: weak });
  else list.push({ k: 'ok', n: okN });
  const hard = hardItems().length;
  if (hard >= 3) list.push({ k: 'fixed', n: Math.min(5, hard) });
  else if (list[0].k === 'deck') list.push({ k: 'ok', n: okN });
  else if (decks.length) {
    const pool2 = decks.filter(id => !yesterday || id !== yesterday.id);
    const src = pool2.length ? pool2 : decks;
    list.push({ k: 'deck', n: 10, id: src[Math.floor(rnd() * src.length)] });
  }
  else list.push({ k: 'ok', n: okN + 10 });
  const extra = [{ k: 'prawda', n: 20 }, { k: 'milion', n: 5 }, { k: 'kto', n: 10 }, { k: 'sprint', n: 8 }];
  if (pool(['flashcard']).length) extra.push({ k: 'fiszki', n: 20 });
  if (pool(['case']).length) extra.push({ k: 'kazusy', n: 2 });
  const extra2 = extra.filter(e => e.k !== prevD.prevExtra);
  list.push(extra2[Math.floor(rnd() * extra2.length)]);
  return list;
}

function rozkazInfo(r, d) {
  const dn = r.id && deckById[r.id] ? deckById[r.id].name : '';
  switch (r.k) {
    case 'ok': return { t: `Odpowiedz poprawnie na ${r.n} pytań`, v: d.ok, href: '#/test' };
    case 'deck': return { t: `${r.n} odpowiedzi z tematu: ${dn}`, v: d.deck[r.id] || 0, act: () => startDeckDrill(r.id) };
    case 'fixed': return { t: `Popraw ${r.n} ${plural(r.n, 'błąd', 'błędy', 'błędów')} z listy Trudne`, v: d.fixed, href: '#/trudne' };
    case 'prawda': return { t: `Rozstrzygnij ${r.n} kart w Prawda czy fałsz`, v: d.mode.prawda || 0, href: '#/prawda' };
    case 'milion': return { t: `Dojdź do ${r.n}. pytania w Milionerach`, v: d.milionMax, href: '#/milionerzy' };
    case 'kto': return { t: `${r.n} odpowiedzi w „Kto co robi”`, v: d.mode.kto || 0, href: '#/kto' };
    case 'sprint': return { t: `Sprint: co najmniej ${r.n} poprawnych w minutę`, v: d.sprintMax, href: '#/sprint' };
    case 'fiszki': return { t: `Przerób ${r.n} fiszek`, v: d.mode.fiszki || 0, href: '#/fiszki' };
    case 'kazusy': return { t: `Rozwiąż ${r.n} ${plural(r.n, 'kazus', 'kazusy', 'kazusów')}`, v: d.mode.kazusy || 0, href: '#/kazusy' };
  }
  return { t: '?', v: 0 };
}

function startDeckDrill(id) {
  const items = DATA.items.filter(i => i.deck === id && i.type === 'mcq');
  const pick = shuffle(freshFirst(pickVariants(items), 10));
  runSequence('Rozkaz: ' + deckById[id].name, pick, () => startDeckDrill(id), { celebrate: true, onShow: markTestSeen });
}

function trackDaily(item, result, prev) {
  const d = ensureDaily();
  d.n++;
  const mode = answerMode || currentRoute || 'start';
  d.mode[mode] = (d.mode[mode] || 0) + 1;
  d.deck[item.deck] = (d.deck[item.deck] || 0) + 1;
  if (result === 'ok') {
    d.ok++;
    if (prev && prev.last === 'bad') d.fixed++;
  }
  checkRozkazy();
}

function checkRozkazy() {
  const d = ensureDaily();
  let newly = 0;
  d.list.forEach((r, k) => {
    if (d.done[k]) return;
    const inf = rozkazInfo(r, d);
    if (inf.v >= r.n) {
      d.done[k] = true;
      newly++;
      addPoints(ROZKAZ_PTS);
      toast('📋', 'Rozkaz wykonany!', `${inf.t} · +${ROZKAZ_PTS} pkt`);
    }
  });
  if (newly && d.list.every((_, k) => d.done[k]) && !d.allDone) {
    d.allDone = true;
    addPoints(ROZKAZY_BONUS);
    setTimeout(() => bielikPop('rozkaz.wszystkie', { pkt: ROZKAZY_BONUS }, { force: true }), 3500);
  }
}

function rozkazyCard() {
  const d = ensureDaily();
  const doneN = d.list.filter((_, k) => d.done[k]).length;
  return h('details', { class: 'card rozkazy', open: state.settings.rozkazyClosed ? null : '',
    ontoggle: e => { state.settings.rozkazyClosed = !e.target.open; save(); } },
    h('summary', {}, h('span', { class: 'sum-l' }, icon('check', 20), 'Rozkazy dnia'), h('span', { class: 'count' }, doneN === d.list.length ? '✓ wykonane' : `${doneN} / ${d.list.length}`)),
    h('div', { class: 'rozkazy-list' }, d.list.map((r, k) => {
      const inf = rozkazInfo(r, d);
      const ok = !!d.done[k];
      const prog = Math.min(1, inf.v / r.n);
      const body = [icon(ok ? 'done' : 'todo', 22, 'rz-check' + (ok ? ' on' : '')),
        h('span', { class: 'rz-text' }, inf.t, h('span', { class: 'rz-bar' }, h('i', { style: `width:${Math.round(prog * 100)}%` }))),
        h('span', { class: 'rz-num' }, ok ? `+${ROZKAZ_PTS}` : `${Math.min(inf.v, r.n)}/${r.n}`)];
      if (ok) return h('div', { class: 'rz done' }, body);
      if (inf.href) return h('a', { class: 'rz', href: inf.href }, body);
      return h('button', { type: 'button', class: 'rz', onclick: inf.act }, body);
    })),
    h('p', { class: 'small muted', style: 'margin:6px 0 0' }, `Za każdy rozkaz +${ROZKAZ_PTS} pkt, za wszystkie trzy dodatkowo +${ROZKAZY_BONUS}. Nowe rozkazy jutro.`));
}

/* ---------- Bielik: słabe punkty ---------- */

const NUM_RE = /^\s*(\d+[\s\d]*)\s*(dni|dzień|godz\w*|h\b|miesi\w*|lat|lata|rok\w*|tygodni\w*|minut\w*|%|zł|stawek|razy)/i;

function bielikWeak(item, result, prev) {
  const g = game();
  const w = g.weak || (g.weak = { pairs: {}, liczby: 0, said: {} });
  if (result !== 'bad' || item.type !== 'mcq' || !lastChoice || lastChoice.id !== item.id) return;
  const chosen = lastChoice.text, right = item.options[item.answer];
  const a = organOf(chosen), b = organOf(right);
  if (a && b && a !== b) {
    const key = [a, b].sort().join('|');
    const n = w.pairs[key] = (w.pairs[key] || 0) + 1;
    w.lastPair = key;
    if (n === 2 || n === 3 || n === 5 || n === 8) setTimeout(() => bielikPop('slabe.para', { a: ORGAN_NAME[b], b: ORGAN_NAME[a], n }, { force: true, ms: 7000 }), 600);
    return;
  }
  if (NUM_RE.test(chosen) && NUM_RE.test(right)) {
    w.liczby = (w.liczby || 0) + 1;
    if (w.liczby % 4 === 2) setTimeout(() => bielikPop('slabe.liczby', { wybrana: chosen.trim(), dobra: right.trim(), n: w.liczby }, { force: true, ms: 7000 }), 600);
    return;
  }
  const r = state.hist[item.id];
  if (r && (r.bad === 3 || r.bad === 5)) {
    const odp = right.length > 90 ? right.slice(0, 87) + '…' : right;
    setTimeout(() => bielikPop('slabe.pytanie', { n: r.bad, odp }, { force: true, ms: 7500 }), 600);
  }
}

// Dymek na ekranie startowym o najczęściej mylonej parze (raz dziennie).
function bielikWeakLine() {
  const w = game().weak;
  if (!w || !w.pairs) return null;
  const day = dayKey(new Date());
  if (w.said && w.said.home === day) return null;
  const top = Object.entries(w.pairs).filter(([, n]) => n >= 2).sort((x, y) => y[1] - x[1])[0];
  if (!top || Math.random() < 0.5) return null;
  const [a, b] = top[0].split('|');
  w.said = { ...(w.said || {}), home: day };
  save();
  return bielikLine('slabe.home', { a: ORGAN_NAME[a], b: ORGAN_NAME[b], n: top[1] });
}

/* ---------- Bielik: musztra znienacka ---------- */

const MUSZTRA_BONUS = 10;

function musztraDue() {
  const g = game();
  if (state.settings.musztraOff || g.counters.answers < 5) return false;
  if (Date.now() - (g.flags.musztraAt || 0) < 2 * 3600000) return false;
  return Math.random() < 0.4;
}

function musztraItem() {
  const cand = pool(['mcq']).filter(it => !it.img && it.options.length >= 3);
  if (!cand.length) return null;
  const w = game().weak;
  const hot = w && w.lastPair ? w.lastPair.split('|') : null;
  const prefer = cand.filter(it => (state.hist[it.id] && state.hist[it.id].last === 'bad') ||
    (hot && isKtoItem(it) && hot.includes(organOf(it.options[it.answer]))));
  const src = prefer.length && Math.random() < 0.7 ? prefer : cand;
  return src[Math.floor(Math.random() * src.length)];
}

function musztraCard(fig, say, bubble) {
  const it = musztraItem();
  if (!it) return false;
  game().flags.musztraAt = Date.now();
  save();
  const start = bielikLine('musztra.start') || { m: 'grozny', t: 'Musztra! Pytanie kontrolne:' };
  fig.innerHTML = bielikSVG(start.m, 86);
  bubble.textContent = start.t;
  const order = shuffle(it.options.map((_, i) => i));
  const opts = h('div', { class: 'musztra-opts' });
  const buttons = order.map(oi => h('button', { type: 'button', class: 'btn option small-opt', onclick: () => pick(oi) }, it.options[oi]));
  const box = h('div', { class: 'musztra' }, h('div', { class: 'musztra-q' }, '❓ ', it.question), opts);
  opts.append(...buttons, h('button', { type: 'button', class: 'link-btn musztra-skip', onclick: () => {
    box.remove();
    say(bielikLine('musztra.unik'));
  } }, 'Odmaszeruj (pomiń)'));
  return box;
  function pick(oi) {
    const ok = oi === it.answer;
    buttons.forEach((b, k) => { b.disabled = true; if (order[k] === it.answer) b.classList.add('correct'); else if (order[k] === oi) b.classList.add('wrong'); });
    opts.querySelector('.musztra-skip')?.remove();
    lastChoice = { id: it.id, text: it.options[oi] };
    answerMode = 'musztra';
    record(it, ok ? 'ok' : 'bad');
    answerMode = null;
    if (ok) addPoints(MUSZTRA_BONUS);
    save();
    const odp = it.options[it.answer];
    say(bielikLine(ok ? 'musztra.ok' : 'musztra.zle', { pkt: MUSZTRA_BONUS + POINTS.mcq, odp: odp.length > 90 ? odp.slice(0, 87) + '…' : odp }));
  }
}

/* ---------- Teksty Bielika do nowych funkcji ---------- */

Object.assign(BIELIK_TEKSTY, {
  'musztra.start': [
    { m: 'grozny', t: 'Musztra! Bez zaglądania do notatek:' },
    { m: 'czujny', t: 'Baczność! Pytanie kontrolne, kursancie:' },
    { m: 'grozny', t: 'Stój! Kto idzie? Odpowiedz, to przepuszczę:' }],
  'musztra.ok': [
    { m: 'zadowolony', t: 'Dobrze. Spocznij. +{pkt} pkt.' },
    { m: 'dumny', t: 'Zgadza się! Widzę, że coś zostaje w głowie. +{pkt} pkt.' }],
  'musztra.zle': [
    { m: 'wsciekly', t: 'Źle! Poprawnie: „{odp}”. Zapamiętaj, bo wrócę z tym.' },
    { m: 'grozny', t: 'Pudło. „{odp}” – i to ma siedzieć w głowie do egzaminu.', o: 'Pudło. „{odp}”. Myślenie nie boli, kursancie.' }],
  'musztra.unik': [
    { m: 'znudzony', t: 'Unikasz musztry? Zapisuję w notesie.' },
    { m: 'grozny', t: 'Odmaszerować… Ale następnym razem nie odpuszczę.' }],
  'slabe.para': [
    { m: 'grozny', t: '{a} czy {b}? Mylisz ich już {n}. raz. Zrób „Kto co robi”, zanim pomylisz na egzaminie.' },
    { m: 'wsciekly', t: 'Znowu! {a}, nie {b}. To {n}. raz. Zapisz to sobie na ręce.', o: 'Znowu! {a}, nie {b}. To {n}. raz. Litości, kursancie.' }],
  'slabe.liczby': [
    { m: 'grozny', t: '„{wybrana}” zamiast „{dobra}”. Terminy się wkuwa, nie zgaduje.' },
    { m: 'wsciekly', t: 'Liczby ci się mylą: „{wybrana}”, a miało być „{dobra}”. Na egzaminie liczy się każdy dzień.' }],
  'slabe.pytanie': [
    { m: 'wsciekly', t: 'To pytanie oblałeś już {n} razy. Raz na zawsze: „{odp}”.' },
    { m: 'grozny', t: '{n}. raz to samo pytanie i ten sam błąd. Zapamiętaj: „{odp}”.' }],
  'slabe.home': [
    { m: 'grozny', t: 'Ostatnio mylisz: {a} ↔ {b} ({n}×). Dziś cię z tego przepytam.' },
    { m: 'czujny', t: '{a} i {b} – to twoja pięta achillesowa ({n} pomyłek). „Kto co robi” czeka.' }],
  'rozkaz.wszystkie': [
    { m: 'dumny', t: 'Wszystkie rozkazy dnia wykonane! +{pkt} pkt premii. Wzorowo.' },
    { m: 'dumny', t: 'Trzy rozkazy, trzy wykonania. Tak wygląda służba. +{pkt} pkt.' }],
  'milion.pewny': [
    { m: 'dumny', t: 'To „{odp}”. Daję głowę. No, może nie głowę – pióro.' },
    { m: 'zadowolony', t: '„{odp}”. Pewne jak apel poranny.' }],
  'milion.raczej': [
    { m: 'czujny', t: 'Stawiałbym na „{odp}”. Ale ręki sobie nie dam uciąć. Skrzydła też nie.' },
    { m: 'czujny', t: 'Chyba „{odp}”. Chyba. Decyzja należy do ciebie.' }],
  'milion.niepewny': [
    { m: 'znudzony', t: 'Hmm… może „{odp}”? Kursancie, to ty masz się uczyć, nie ja.' },
    { m: 'znudzony', t: 'Nie wiem. Może „{odp}”. Ostatnio czytałem tylko regulamin stołówki.' }],
  'milion.wygrana': [{ m: 'dumny', t: 'MILION! Teraz tylko zdać egzamin i będziesz bogaty… w wiedzę.' }],
  'milion.przegrana': [
    { m: 'grozny', t: 'Odpadłeś na pytaniu za {kwota}. Na egzaminie nie ma kół ratunkowych.' },
    { m: 'czujny', t: 'Koniec gry. Przeczytaj wyjaśnienie, to następnym razem pójdzie dalej.' }],
  'milion.rezygnacja': [{ m: 'znudzony', t: 'Wziąłeś kasę i uciekłeś. Rozsądnie. Tchórzliwie, ale rozsądnie.' }],
});

Object.assign(routes, { szukaj: renderSearch, kto: () => renderKto(), milionerzy: renderMilion, prawda: renderPrawda });
