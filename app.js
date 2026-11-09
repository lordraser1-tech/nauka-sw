'use strict';

const STORE_KEY = 'nauka-sw-v1';
const BOX_DAYS = [0, 0, 1, 3, 7, 14]; // po ilu dniach karta wraca; indeks = pudełko 1–5
const MASTERED_BOX = 4;               // „opanowana” = pudełko 4 lub 5
const FLASH_SESSION = 20;
const EXAM_SIZE = 30;
const EXAM_MINUTES = 30;
const DOCS = [
  { file: 'skrypt_unitarna.md', name: 'Część unitarna' },
  { file: 'skrypt_psycholog.md', name: 'Psycholog' },
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
  return DATA.items.filter(it =>
    types.includes(it.type) && decks.has(it.deck) &&
    (opts.ignoreMem || !state.settings.onlyMem || it.naPamiec));
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

function record(item, result) {
  const r = state.hist[item.id] || { n: 0, bad: 0 };
  r.last = result;
  r.n++;
  if (result === 'bad') r.bad++;
  r.ts = Date.now();
  state.hist[item.id] = r;
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
  const t = item.question || item.front || item.prompt || item.text.replace(/\[\[[^\]]*\]\]/g, '___');
  return t.length > 160 ? t.slice(0, 157) + '…' : t;
}

function tags(item) {
  const box = boxOf(item.id);
  return h('div', {},
    h('span', { class: 'tag' }, deckById[item.deck] ? deckById[item.deck].name : item.deck),
    item.naPamiec && h('span', { class: 'tag mem' }, 'Na pamięć'),
    item.type === 'flashcard' && h('span', { class: 'tag' }, box ? `Pudełko ${box}` : 'Nowa'));
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
};

function route() {
  currentRoute = location.hash.replace(/^#\/?/, '');
  if (!(currentRoute in routes)) currentRoute = '';
  if (currentRoute === 'czytaj' && !docs.length) currentRoute = '';
  document.querySelectorAll('.tabbar a').forEach(a =>
    a.classList.toggle('active', (a.dataset.tab === 'czytaj') === (currentRoute === 'czytaj')));
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

  $app.append(h('div', { class: 'modes' },
    mode('Fiszki', `${due} do powtórki · ${flash.length} w wybranych taliach`, '#/fiszki', flash.length, true),
    mode('Test', `${mcq} ${plural(mcq, 'pytanie', 'pytania', 'pytań')} z natychmiastową odpowiedzią`, '#/test', mcq),
    mode('Na pamięć', `${mem} ${plural(mem, 'ćwiczenie', 'ćwiczenia', 'ćwiczeń')}: luki i kolejność`, '#/pamiec', mem),
    mode('Egzamin próbny', examRunning ? `Trwa – zostało ${mmss(exam.end - Date.now())}` : `${EXAM_SIZE} pytań · ${EXAM_MINUTES} minut`, '#/egzamin', 1),
    mode('Trudne', hard ? `${hard} do poprawy (wszystkie talie)` : 'Brak błędnych odpowiedzi', '#/trudne', hard)));

  // Filtry
  const sel = new Set(selectedDecks());
  const filters = h('section', { class: 'card' }, h('h2', { style: 'margin-top:0' }, 'Talie'));
  for (const d of DATA.decks) {
    const n = DATA.items.filter(i => i.deck === d.id && (!state.settings.onlyMem || i.naPamiec)).length;
    filters.append(h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: sel.has(d.id), onchange: e => {
        if (e.target.checked) sel.add(d.id); else sel.delete(d.id);
        state.settings.decks = DATA.decks.map(x => x.id).filter(id => sel.has(id));
        save();
        renderHome(true);
      } }),
      h('span', {}, d.name),
      h('span', { class: 'count' }, n)));
  }
  filters.append(h('label', { class: 'switch' },
    h('span', {}, 'Tylko „na pamięć”'),
    h('input', { type: 'checkbox', role: 'switch', checked: state.settings.onlyMem, onchange: e => {
      state.settings.onlyMem = e.target.checked;
      save();
      renderHome(true);
    } })));
  $app.append(filters);

  // Postęp
  const prog = h('section', { class: 'card' }, h('h2', { style: 'margin-top:0' }, 'Postęp fiszek'));
  let allM = 0, allN = 0;
  for (const d of DATA.decks) {
    const cards = DATA.items.filter(i => i.deck === d.id && i.type === 'flashcard');
    if (!cards.length) continue;
    const counts = [0, 0, 0, 0, 0, 0];
    cards.forEach(c => counts[boxOf(c.id)]++);
    const m = counts[4] + counts[5];
    allM += m; allN += cards.length;
    prog.append(h('div', { class: 'deck-progress' },
      h('div', { class: 'label' }, h('span', {}, d.name), h('span', { class: 'muted' }, `${m} / ${cards.length}`)),
      h('div', { class: 'bar', role: 'img', 'aria-label': `${m} z ${cards.length} opanowanych` },
        [1, 2, 3, 4, 5].map(b => h('i', { class: 'b' + b, style: `width:${(counts[b] / cards.length) * 100}%` })))));
  }
  prog.append(h('p', { class: 'small muted', style: 'margin:12px 0 0' },
    `Opanowane (pudełko ${MASTERED_BOX}–5): ${allM} z ${allN} fiszek.`));
  prog.append(h('div', { class: 'legend' },
    h('span', { style: '--c:var(--surface-2)' }, 'nowe'),
    [1, 2, 3, 4, 5].map(b => h('span', { style: `--c:var(--b${b})`, class: 'lg' + b }, `P${b}`))));
  $app.append(prog);

  if (state.exams.length) {
    $app.append(h('section', { class: 'card' },
      h('h2', { style: 'margin-top:0' }, 'Ostatnie egzaminy'),
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
  const choose = g => { if (done) return; done = true; grade(item, g); onGrade(g); };
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
    tags(item), h('div', { class: 'fc-front' }, item.front), back, src, hint);
  return [card, h('div', { class: 'actions' }, showBtn, grades)];
}

function feedback(ok, title, ...body) {
  return h('div', { class: 'feedback ' + (ok ? 'ok' : 'bad') }, h('strong', {}, title), ...body);
}

function mcqView(item, onResult, onNext, nextLabel) {
  let done = false;
  const order = shuffle(item.options.map((_, i) => i));
  const fb = h('div');
  const actions = h('div', { class: 'actions' });
  const buttons = order.map(oi => h('button', { type: 'button', class: 'btn option', onclick: () => choose(oi) }, item.options[oi]));
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
    record(item, ok ? 'ok' : 'bad');
    onResult(ok);
    nextButton(actions, onNext, nextLabel);
  }
  return [h('div', { class: 'card' }, tags(item), h('div', { class: 'question' }, item.question), h('div', { class: 'options' }, buttons), fb), actions];
}

function clozeView(item, onResult, onNext, nextLabel) {
  let done = false;
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
  return [h('div', { class: 'card' }, tags(item), h('p', { class: 'small muted', style: 'margin:0 0 6px' }, 'Uzupełnij luki:'), text, fb), actions];
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
function runSequence(title, items, restart) {
  if (!items.length) return emptyScreen(title, '📭', 'Brak pozycji dla wybranych talii i filtrów.');
  const s = { i: 0, ok: 0, wrong: [] };
  const step = () => {
    if (s.i >= items.length) return sequenceSummary(title, items, s, restart);
    const item = items[s.i];
    screen(title, true);
    $app.append(h('div', { class: 'progress-line' },
      h('span', {}, `${s.i + 1} / ${items.length}`),
      h('span', {}, `Dobrze: ${s.ok}`)));
    $app.append(...exerciseView(item,
      ok => { if (ok) s.ok++; else s.wrong.push(item); },
      () => { s.i++; step(); },
      s.i + 1 === items.length ? 'Zobacz wynik' : 'Dalej'));
  };
  step();
}

function sequenceSummary(title, items, s, restart) {
  screen(title, true);
  const n = items.length;
  $app.append(h('div', { class: 'card' },
    h('div', { class: 'score' }, pct(s.ok, n) + '%'),
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
      h('span', { class: 'mode-sub' }, `${n} ${plural(n, 'pytanie', 'pytania', 'pytań')} · ${sub}`));
  };
  $app.append(h('p', { class: 'small muted', style: 'margin-top:0' }, 'Wybierz część egzaminu:'),
    h('div', { class: 'modes' },
      option('Unitarny', 'wiedza ogólna: KKW, ochrona, ŚPB, broń, pragmatyka, pierwsza pomoc', partDecks('unitarna'), true),
      option('Specjalistyczny', 'tylko psychologia', partDecks('specjalistyczna'), true),
      option('Wybrane talie', 'talie zaznaczone na ekranie startowym', null)));
}

function testItems(decks) {
  return decks ? pool(['mcq'], { decks, ignoreMem: true }) : pool(['mcq']);
}

function runTest(name, decks) {
  runSequence(`Test – ${name.toLowerCase()}`, shuffle(testItems(decks)), () => runTest(name, decks));
}

function startMemory() {
  runSequence('Na pamięć', shuffle(pool(['cloze', 'order'])), startMemory);
}

function startHard() {
  const items = hardItems();
  if (!items.length) return emptyScreen('Trudne', '🎉', 'Nie masz pozycji z błędną ostatnią odpowiedzią.');
  runSequence('Trudne', shuffle(items), startHard);
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
    const size = Math.min(EXAM_SIZE, n);
    info.textContent = n >= EXAM_SIZE
      ? `Dostępnych pytań: ${n}. Wylosuję ${EXAM_SIZE}.`
      : `W wybranych taliach jest ${n} ${plural(n, 'pytanie', 'pytania', 'pytań')} – egzamin będzie miał ${size}.`;
    start.disabled = !n;
  };
  const card = h('section', { class: 'card' },
    h('p', { style: 'margin-top:0' }, `${EXAM_SIZE} losowych pytań jednokrotnego wyboru, limit ${EXAM_MINUTES} minut. Odpowiedzi poznasz dopiero na końcu – razem z listą błędów do powtórki.`),
    h('h3', {}, 'Talie'));
  for (const d of DATA.decks) {
    const n = DATA.items.filter(i => i.deck === d.id && i.type === 'mcq').length;
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
  const items = shuffle(pool(['mcq'], { decks, ignoreMem: true })).slice(0, EXAM_SIZE);
  if (!items.length) return;
  exam = {
    items,
    orders: items.map(it => shuffle(it.options.map((_, i) => i))),
    answers: items.map(() => null),
    i: 0,
    start: Date.now(),
    end: Date.now() + EXAM_MINUTES * 60000,
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
  $app.append(h('div', { class: 'card' }, h('div', { class: 'question' }, item.question), h('div', { class: 'options' }, buttons)));
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
  exam.items.forEach((it, k) => {
    const ok = exam.answers[k] === it.answer;
    if (ok) exam.ok++;
    record(it, ok ? 'ok' : 'bad');
  });
  const n = exam.items.length;
  state.exams.unshift({ date: Date.now(), ok: exam.ok, n, pct: pct(exam.ok, n) });
  state.exams = state.exams.slice(0, 20);
  save();
  updateTimer();
  if (currentRoute === 'egzamin') examResult();
}

function examResult() {
  screen('Wynik egzaminu', true);
  const n = exam.items.length;
  const wrong = exam.items.map((it, k) => ({ it, a: exam.answers[k] })).filter(x => x.a !== x.it.answer);
  $app.append(h('div', { class: 'card' },
    exam.timeUp && h('p', { style: 'text-align:center;margin:0;color:var(--bad);font-weight:700' }, 'Koniec czasu!'),
    h('div', { class: 'score' }, pct(exam.ok, n) + '%'),
    h('div', { class: 'score-sub' }, `${exam.ok} z ${n} poprawnie · czas ${mmss(exam.took)}`)));
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
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) {
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
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|>|\|)/.test(lines[i]) && !LIST_RE.test(lines[i])) buf.push(lines[i++]);
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

function renderRead() {
  screen('Czytaj', false);
  let k = state.settings.doc;
  if (!docs[k]) k = state.settings.doc = 0;
  if (docs.length > 1) {
    $app.append(h('div', { class: 'seg', role: 'tablist' }, docs.map((d, j) =>
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
  $app.append(details, doc,
    h('button', { type: 'button', class: 'to-top', 'aria-label': 'Do góry', onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) }, '↑'));
  const pos = state.settings.readPos[k];
  if (pos) requestAnimationFrame(() => window.scrollTo(0, pos));
}

/* ---------- Start ---------- */

async function init() {
  state = loadState();
  document.getElementById('storage-warning').hidden = storageOk;
  try {
    const res = await fetch('pytania_sw.json');
    if (!res.ok) throw new Error(res.status);
    DATA = await res.json();
  } catch (e) {
    $app.replaceChildren(h('div', { class: 'card' }, h('strong', {}, 'Nie udało się wczytać pytań.'),
      h('p', {}, 'Sprawdź połączenie z internetem i odśwież stronę. Aplikację trzeba otworzyć przez serwer (np. GitHub Pages), a nie bezpośrednio z pliku.')));
    return;
  }
  DATA.decks.forEach(d => { deckById[d.id] = d; });
  if (state.settings.decks) state.settings.decks = state.settings.decks.filter(id => deckById[id]);
  if (state.settings.examDecks) state.settings.examDecks = state.settings.examDecks.filter(id => deckById[id]);

  const loaded = await Promise.all(DOCS.map(d =>
    fetch(d.file).then(r => (r.ok ? r.text() : null)).catch(() => null)));
  docs = DOCS.map((d, i) => ({ ...d, text: loaded[i] })).filter(d => d.text);
  document.getElementById('tab-czytaj').hidden = !docs.length;

  route();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

init();
