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
  const prev = state.hist[item.id] ? { ...state.hist[item.id] } : null;
  const r = state.hist[item.id] || { n: 0, bad: 0 };
  r.last = result;
  r.n++;
  if (result === 'bad') r.bad++;
  r.ts = Date.now();
  state.hist[item.id] = r;
  onAnswer(item, result, prev);
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
  teczka: renderTeczka,
  wyzwanie: startChallenge,
};

function route() {
  currentRoute = location.hash.replace(/^#\/?/, '');
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

  $app.append(serviceCard());
  $app.append(h('div', { class: 'modes' },
    mode('Fiszki', `${due} do powtórki · ${flash.length} w wybranych taliach`, '#/fiszki', flash.length, true),
    mode('Test', `${mcq} ${plural(mcq, 'pytanie', 'pytania', 'pytań')} z natychmiastową odpowiedzią`, '#/test', mcq),
    mode('Na pamięć', `${mem} ${plural(mem, 'ćwiczenie', 'ćwiczenia', 'ćwiczeń')}: luki i kolejność`, '#/pamiec', mem),
    mode('Egzamin próbny', examRunning ? `Trwa – zostało ${mmss(exam.end - Date.now())}` : `${examSize()} pytań · ${examMinutes()} minut`, '#/egzamin', 1),
    mode('Trudne', hard ? `${hard} do poprawy (wszystkie talie)` : 'Brak błędnych odpowiedzi', '#/trudne', hard)));

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
    h('summary', {}, h('span', {}, 'Tematy'), h('span', { class: 'count' }, `${sel.size} z ${allIds.length} wybranych`)),
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
  const all = shuffle(testItems(decks));
  const items = testSize() ? all.slice(0, testSize()) : all;
  runSequence(`Test – ${name.toLowerCase()}`, items, () => runTest(name, decks), { celebrate: true });
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

function verdictCard(p, sub, weak, extra, quiet) {
  const v = VERDICTS.find(x => p >= x.min);
  const card = h('div', { class: 'card verdict ' + v.cls },
    h('div', { class: 'verdict-icon', 'aria-hidden': 'true' }, v.icon),
    h('div', { class: 'score' }, p + '%'),
    h('div', { class: 'score-sub' }, sub),
    h('div', { class: 'rank' }, `Stopień: ${v.rank}`),
    h('div', { class: 'verdict-head' }, v.head),
    h('p', { class: 'verdict-text' }, v.texts[Math.floor(Math.random() * v.texts.length)]),
    extra && h('p', { class: 'verdict-extra' }, extra),
    weak && p < 76 && h('p', { class: 'small', style: 'text-align:center;margin:6px 0 0' }, `Najwięcej błędów: ${weak}.`));
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
  const items = shuffle(pool(['mcq'], { decks, ignoreMem: true })).slice(0, examSize());
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
    worstDeck(wrong.map(x => x.it)), streakNote(), exam.celebrated);
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

async function init() {
  state = loadState();
  document.getElementById('storage-warning').hidden = storageOk;
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
const POINTS = { mcq: 7, flashcard: 3, cloze: 10, order: 10, fixed: 13, examPass: 67, examTop: 167, dailyGoal: 33 };
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
function onAnswer(item, result, prev) {
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
  if (ok) {
    ds.ok++;
    g.counters.ok++;
    g.run++;
    const wasBad = prev && prev.last === 'bad';
    let pts = wasBad ? POINTS.fixed : (POINTS[item.type] || 0);
    if (wasBad) {
      g.counters.fixed++;
      if (prev.bad >= 5) unlock('szczesciarz');
    }
    if (g.run >= STREAK_FROM) pts *= STREAK_MULT;
    addPoints(pts * pointsMult);
    if (item.deck === 'spb' && ZUPP_RE.test(itemText(item))) g.counters.zupp++;
  } else if (result === 'bad') {
    g.run = 0;
  }
  if (g.days[day] >= dailyGoal() && !g.goalDone[day]) {
    g.goalDone[day] = true;
    addPoints(POINTS.dailyGoal);
    toast('🎯', 'Dzienny cel osiągnięty!', `${dailyGoal()} odpowiedzi dzisiaj · +${POINTS.dailyGoal} pkt`);
  }
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
  if (b && !silent) toast(b.icon, 'Nowa odznaka: ' + b.name, b.desc);
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
      h('div', { class: 'verdict-icon' }, '📜'),
      h('p', {}, 'Za sumienne przygotowanie do służby mianuje się funkcjonariusza na stopień:'),
      h('div', { class: 'promo-rank' }, RANKS[r][1]),
      h('p', { class: 'small muted' }, `${game().points} pkt · ${n} ${plural(n, 'odznaka', 'odznaki', 'odznak')}`),
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

function seeded(seed) {
  let s = 0;
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function challengeToday() {
  const day = dayKey(new Date());
  const decks = DATA.decks.filter(d => DATA.items.filter(i => i.deck === d.id && i.type === 'mcq').length >= CHALLENGE_SIZE);
  if (!decks.length) return null;
  const rnd = seeded(day);
  const deck = decks[Math.floor(rnd() * decks.length)];
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

function serviceCard() {
  const g = game();
  const r = g.rank, next = RANKS[r + 1];
  const from = RANKS[r][0];
  const prog = next ? (g.points - from) / (next[0] - from) : 1;
  const today = g.days[dayKey(new Date())] || 0;
  const goal = dailyGoal();
  const gp = Math.min(1, today / goal);
  const dte = daysToExam();
  const c = challengeToday();
  const cDone = c && g.challenge[c.day] != null;
  return h('section', { class: 'card service' },
    h('a', { class: 'service-top', href: '#/teczka' },
      h('div', { class: 'ring', style: `--p:${Math.round(gp * 100)}`, 'aria-label': `Dzienny cel: ${today} z ${goal}` },
        h('span', {}, gp >= 1 ? '✓' : `${today}/${goal}`)),
      h('div', { class: 'service-main' },
        h('div', { class: 'service-rank' }, RANKS[r][1]),
        h('div', { class: 'small muted' }, `${g.points} pkt` + (next ? ` · do awansu: ${next[0] - g.points}` : ' · najwyższy stopień')),
        h('div', { class: 'xp' }, h('i', { style: `width:${Math.round(prog * 100)}%` }))),
      h('div', { class: 'service-side' },
        h('div', { title: 'Seria dni nauki' }, `🔥 ${streakDays()}`),
        h('div', { title: 'Odznaki' }, `🏅 ${Object.keys(g.badges).length}`))),
    h('div', { class: 'service-info small' },
      dte >= 0 ? h('span', {}, `📆 Do egzaminu: ${dte} ${plural(dte, 'dzień', 'dni', 'dni')} · tempo ok. ${suggestedPace()} nowych/dzień`) : h('span', {}, '📆 Ustaw datę egzaminu w Teczce'),
      h('span', {}, `📊 Gotowość: ${readiness()}%`)),
    c && h('a', { class: 'btn challenge' + (cDone ? '' : ' primary'), href: '#/wyzwanie' },
      cDone ? `⭐ Wyzwanie dnia zaliczone (${g.challenge[c.day]}%) – powtórz` : `⭐ Wyzwanie dnia: ${c.deck.name} · 10 pytań · punkty ×2`));
}

/* --- Teczka osobowa --- */

function renderTeczka() {
  screen('Teczka osobowa', false);
  const g = game();
  const r = g.rank, next = RANKS[r + 1];
  const nb = Object.keys(g.badges).length;

  // Stopień i statystyki
  $app.append(h('section', { class: 'card teczka-head' },
    h('div', { class: 'verdict-icon' }, '🎖️'),
    h('div', { class: 'promo-rank' }, RANKS[r][1]),
    h('div', { class: 'muted' }, `${g.points} pkt` + (next ? ` · następny stopień: ${next[1]} (${next[0]} pkt)` : '')),
    h('div', { class: 'xp', style: 'margin:10px 0' }, h('i', { style: `width:${next ? Math.round(((g.points - RANKS[r][0]) / (next[0] - RANKS[r][0])) * 100) : 100}%` })),
    h('div', { class: 'stats' },
      stat('🔥', streakDays(), 'dni z rzędu'),
      stat('🏅', `${nb}/${BADGES.length}`, 'odznak'),
      stat('📝', g.counters.answers, 'odpowiedzi'),
      stat('📊', readiness() + '%', 'gotowość')),
    btn('📤 Udostępnij wynik', '', shareResult)));

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
  const sec = h('section', { class: 'card' }, h('h2', { style: 'margin-top:0' }, `Odznaki (${nb}/${BADGES.length})`));
  for (const c of cats) {
    sec.append(h('h3', {}, c));
    sec.append(h('div', { class: 'badges' }, BADGES.filter(b => b.cat === c).map(b => {
      const got = g.badges[b.id];
      const secret = b.hidden && !got;
      return h('div', { class: 'badge' + (got ? ' got' : '') },
        h('span', { class: 'badge-icon' }, secret ? '❓' : b.icon),
        h('strong', {}, secret ? '???' : b.name),
        h('span', { class: 'small muted' }, secret ? 'Odznaka ukryta' : got ? 'Zdobyta ' + new Date(got).toLocaleDateString('pl-PL') : b.desc));
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
      h('li', {}, `Poprawiony wcześniejszy błąd: +${POINTS.fixed}`),
      h('li', {}, `Od ${STREAK_FROM}. dobrej odpowiedzi z rzędu: punkty ×${String(STREAK_MULT).replace('.', ',')}`),
      h('li', {}, `Wyzwanie dnia: punkty ×${CHALLENGE_MULT}`),
      h('li', {}, `Dzienny cel: +${POINTS.dailyGoal} · egzamin zdany: +${POINTS.examPass} · egzamin 91%+: +${POINTS.examTop}`)),
    h('h3', {}, 'Stopnie'),
    h('div', { class: 'ranks' }, RANKS.map(([p, n], i) => h('div', { class: i === r ? 'on' : i < r ? 'past' : '' }, h('span', {}, n), h('span', { class: 'muted' }, `${p} pkt`))))));

  $app.append(h('p', { class: 'small muted', style: 'text-align:center' }, 'Wygląd, kopia postępu i historia zmian: ⚙️ w nagłówku.'));
}

function stat(icon, value, label) {
  return h('div', { class: 'stat' }, h('div', { class: 'stat-v' }, icon + ' ' + value), h('div', { class: 'small muted' }, label));
}

function sizeLikePicker(pairs, current, onPick) {
  return h('div', { class: 'seg', role: 'radiogroup' }, pairs.map(([v, label]) =>
    h('button', { type: 'button', role: 'radio', class: v === current ? 'on' : '', 'aria-checked': String(v === current), onclick: () => onPick(v) }, label)));
}


/* ---------- Co nowego (po aktualizacji) ---------- */

// Przy każdej aktualizacji: dopisz wpis NA POCZĄTKU listy, z numerem = numer CACHE w service-worker.js.
const CHANGELOG = [
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
    h('h3', {}, 'Historia zmian'),
    h('p', { class: 'small muted', style: 'margin-top:0' }, `Wersja aplikacji: ${APP_VERSION}`),
    btn('📰 Pokaż historię zmian', '', () => { close(); showChangelog(); }),
    h('h3', {}, 'Kopia postępu'),
    h('p', { class: 'small muted', style: 'margin-top:0' }, 'Zapisz postęp do pliku, żeby przenieść go na inny telefon albo nie stracić go po wyczyszczeniu przeglądarki.'),
    h('div', { class: 'row' }, btn('💾 Eksportuj', '', exportProgress), btn('📂 Importuj', '', () => { close(); importProgress(); })),
    btn('Zamknij', 'primary', close)));
  document.body.append(box);
}

function showChangelog() {
  changelogBox(CHANGELOG, 'Historia zmian');
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

    sec('⏱️ Egzamin próbny',
      li('', '30 / 40 / 50 losowych pytań, 1 minuta na pytanie; zegar widać w nagłówku.'),
      li('', 'Odpowiedzi i wynik poznasz dopiero na końcu – jak na prawdziwym egzaminie. Możesz wracać do pytań („‹ Wstecz”) i zakończyć wcześniej.'),
      li('', 'Talie wybierasz na ekranie egzaminu. Gdy wyjdziesz w trakcie, egzamin dalej trwa – wróć przyciskiem na ekranie Nauka.'),
      li('', 'Od 51% aplikacja uznaje egzamin za zdany (odznaki, punkty). To próg aplikacji, nie oficjalny.')),

    sec('⚠️ Trudne',
      li('', 'Wszystko, na czym ostatnio się pomyliłeś – ze wszystkich tematów. Dobra odpowiedź zdejmuje pytanie z listy (i daje dodatkowe punkty za poprawę).')),

    sec('📚 Czytaj',
      li('', 'Skrypty: Część unitarna, Psycholog, Stanowiska – przełączasz zakładkami u góry.'),
      li('Spis treści', 'rozwijany; klik przenosi do rozdziału.'),
      li('Wyszukiwarka', 'wpisz słowo, strzałki ↑ ↓ przeskakują między trafieniami. Zaznacz „Szukaj we wszystkich skryptach”, żeby szukać wszędzie.'),
      li('', 'Aplikacja pamięta, gdzie skończyłeś czytać.')),

    sec('🗂️ Teczka i punkty',
      li('Stopień', 'od szeregowego do pułkownika – rośnie z punktami. Punkty: test +' + POINTS.mcq + ', fiszka „Wiem” +' + POINTS.flashcard + ', Na pamięć +' + POINTS.cloze + ', poprawiony błąd +' + POINTS.fixed + '; od 5. dobrej odpowiedzi z rzędu ×1,5.'),
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
        li('❓ Instrukcja', 'przycisk „?” obok INFO – wszystko krok po kroku.')),
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
      })));
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

init();
