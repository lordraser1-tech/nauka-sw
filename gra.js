/* =====================================================================
   „Pierwsza służba” – silnik gry fabularnej.
   Treść kampanii: gra-dane.js (window.GRA). Ten plik korzysta z funkcji
   aplikacji (h, btn, screen, mcqView, exerciseView, addPoints, evaluate…).
   ===================================================================== */
(function () {
  'use strict';
  const D = () => window.GRA;
  const START = { op: 50, bez: 60, zauf: 50 };
  const KARY = {
    rozmowa: { w: 0, n: 'Rozmowa dyscyplinująca', d: 'Nie jest karą. Przy przewinieniu mniejszej wagi przełożony może zamiast postępowania przeprowadzić udokumentowaną rozmowę dyscyplinującą (art. 230 ust. 6 ustawy o SW). Notatka leży w aktach osobowych 3 miesiące.' },
    nagana: { w: 1, n: 'Nagana', d: 'Pierwsza w katalogu kar dyscyplinarnych (art. 232 pkt 1 ustawy o SW).' },
    ost_stan: { w: 2, n: 'Ostrzeżenie o niepełnej przydatności na zajmowanym stanowisku', d: 'Kara z art. 232 pkt 2 ustawy o SW.' },
    ost_sluzba: { w: 3, n: 'Ostrzeżenie o niepełnej przydatności do służby w SW', d: 'Kara z art. 232 pkt 3 ustawy o SW – ostatni dzwonek przed wydaleniem.' },
  };
  const KARY_LIMIT = 5;
  const STAT_N = { op: 'Opinia', bez: 'Bezpieczeństwo', zauf: 'Zaufanie' };
  const STAT_IC = { op: 'file', bez: 'shield', zauf: 'users' };
  const EXTRA_IC = {
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',
    map: '<path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  };
  function gic(name, size, color) {
    if (!EXTRA_IC[name]) { const e = icon(name, size); if (color) e.style.color = color; return e; }
    const el = h('span', { class: 'ico', 'aria-hidden': 'true' });
    el.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${EXTRA_IC[name]}</svg>`;
    if (color) el.style.color = color;
    return el;
  }

  /* ---------- stan ---------- */
  const R = () => state.rpg;
  const clamp = v => Math.max(0, Math.min(100, v));
  const clone = o => JSON.parse(JSON.stringify(o));
  function newRun(name, sex) {
    state.rpg = { v: 1, name, sex, ch: D().order[0], i: 0, st: { ...START }, pts: 0, flags: {}, kary: [], done: {}, path: null,
      paths: {}, cp: null, cpRaport: null, endings: {}, clean: true, susp: null, started: Date.now() };
    checkpoint();
    save();
  }
  function snap() { const r = R(); return clone({ ch: r.ch, st: r.st, pts: r.pts, flags: r.flags, kary: r.kary, done: r.done, path: r.path, clean: r.clean }); }
  function checkpoint() { const r = R(); r.cp = snap(); r.i = 0; r.susp = null; r.chT = r.ch && chap(r.ch) ? chap(r.ch).t : ''; if (r.ch === 'raport') r.cpRaport = snap(); }
  function restore(s) { const r = R(); Object.assign(r, clone(s)); r.i = 0; r.susp = null; r.cp = clone(s); r.chT = chap(r.ch) ? chap(r.ch).t : ''; save(); }

  const fx = t => String(t == null ? '' : t)
    .replace(/\{imie\}/g, (R() && R().name) || 'Kursancie')
    .replace(/\{([^|{}]*)\|([^|{}]*)\}/g, (_, m, k) => (R() && R().sex === 'k' ? k : m));

  const chap = id => D().chapters[id];
  function chapterList() {
    const r = R();
    return D().order.filter(id => !chap(id).path || chap(id).path === r.path || (!r.path && chap(id).path === 'ochrona'));
  }
  function nextChapter(id) {
    const r = R();
    const ord = D().order;
    for (let k = ord.indexOf(id) + 1; k < ord.length; k++) {
      const c = chap(ord[k]);
      if (!c.path || c.path === r.path) return ord[k];
    }
    return null;
  }

  /* ---------- ładowanie ---------- */
  let loading = null;
  function loadData() {
    if (window.GRA) return Promise.resolve();
    if (!loading) loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'gra-dane.js?v=' + (window.GRA_VER || 1);
      s.onload = () => res();
      s.onerror = () => { loading = null; rej(new Error('Brak pliku gra-dane.js')); };
      document.head.append(s);
    });
    return loading;
  }

  /* ---------- wspólne elementy ---------- */
  function shell(title) {
    const app = screen(title || 'Pierwsza służba', true);
    const root = h('div', { class: 'gra' });
    app.append(root);
    return root;
  }
  function portrait(who, size) {
    const c = D().chars[who];
    if (who === 'bielik') { const f = bielikFigure(c && c.mood || 'czujny', size); f.classList.add('gra-bk'); return f; }
    if (who === 'ty') return h('span', { class: 'gra-av gra-av-ty', style: `width:${size}px;height:${size}px` }, (R().name || 'Ty').slice(0, 1).toUpperCase());
    if (!c || !c.img) return h('span', { class: 'gra-av', style: `width:${size}px;height:${size}px` }, '•');
    return h('span', { class: 'gra-av', style: `width:${size}px;height:${size}px` },
      h('img', { src: `obrazy/gra/${c.img}.webp`, alt: '', decoding: 'async' }));
  }
  function meters(compact) {
    const r = R();
    const col = { op: '#f4c235', bez: '#4fb37a', zauf: '#6fa8e8' };
    return h('div', { class: 'gra-meters' + (compact ? ' compact' : '') }, ...Object.keys(STAT_N).map(k =>
      h('div', { class: 'gra-meter', title: `${STAT_N[k]}: ${r.st[k]}` },
        h('div', { class: 'gra-mlabel' }, gic(STAT_IC[k], 14, col[k]), h('span', {}, STAT_N[k])),
        h('div', { class: 'gra-mbar' }, h('i', { style: `width:${r.st[k]}%;background:${col[k]}` })))));
  }
  function sceneImg(bg, overlay) {
    const box = h('div', { class: 'gra-img' });
    if (bg) box.append(h('img', { src: `obrazy/gra/${bg}.webp`, alt: (D().bgAlt && D().bgAlt[bg]) || '', decoding: 'async' }));
    if (overlay) box.append(h('div', { class: 'gra-img-tag' }, overlay));
    box.append(h('div', { class: 'gra-img-fade' }));
    return box;
  }
  function bubble(who, text) {
    const c = D().chars[who];
    if (who === 'nar' || !who) return h('div', { class: 'gra-nar' }, fx(text));
    const name = who === 'ty' ? (R().name || 'Ty') : c ? c.n : who;
    return h('div', { class: 'gra-say' + (who === 'bielik' ? ' bk' : '') + (who === 'ty' ? ' me' : '') },
      portrait(who, who === 'bielik' ? 58 : 54),
      h('div', { class: 'gra-say-b' }, h('div', { class: 'gra-who' }, fx(name)), h('div', { class: 'gra-txt' }, fx(text))));
  }
  const goBtn = (label, fn, cls) => h('button', { type: 'button', class: 'gra-btn ' + (cls || ''), onclick: fn }, label);

  /* ---------- ekran startowy gry ---------- */
  function renderGra() {
    const root = shell();
    root.append(h('div', { class: 'gra-loading' }, 'Wczytuję zakład karny…'));
    loadData().then(() => {
      if (currentRoute !== 'gra') return;
      if (!R()) intro(); else if (R().ending) showEnding(R().ending); else hub();
    }).catch(() => {
      root.replaceChildren(h('div', { class: 'gra-nar' }, 'Nie udało się wczytać gry. Sprawdź internet i spróbuj ponownie.'),
        goBtn('Spróbuj ponownie', () => route(), 'gold'));
    });
  }

  function intro() {
    const root = shell();
    let sex = 'm';
    const inp = h('input', { class: 'gra-input', type: 'text', maxlength: 20, placeholder: 'np. Mateusz', value: '', autocomplete: 'given-name' });
    const sx = h('div', { class: 'gra-seg' });
    const draw = () => sx.replaceChildren(
      h('button', { type: 'button', class: sex === 'm' ? 'on' : '', onclick: () => { sex = 'm'; draw(); } }, 'Pan'),
      h('button', { type: 'button', class: sex === 'k' ? 'on' : '', onclick: () => { sex = 'k'; draw(); } }, 'Pani'));
    draw();
    root.append(
      h('div', { class: 'gra-hero' }, h('img', { src: 'obrazy/gra/mapa.webp', alt: 'Zakład karny w Bielinach z lotu ptaka' }),
        h('div', { class: 'gra-hero-t' }, h('div', { class: 'gra-kick' }, 'Gra fabularna'), h('div', { class: 'gra-h1' }, 'Pierwsza służba'))),
      h('div', { class: 'gra-card' },
        h('p', {}, 'Przejdziesz drogę funkcjonariusza: od listu z kadr, przez wstępniak i wszystkie stanowiska w dziale ochrony, po egzamin na chorążego. Każda decyzja ma skutki – a rażący błąd może skończyć się po drugiej stronie krat.'),
        h('p', { class: 'gra-mut' }, 'Przepisy są prawdziwe, zakład w Bielinach i jego mieszkańcy – zmyśleni. Pytania z gry liczą się do twojej nauki i punktów.')),
      h('div', { class: 'gra-card' },
        h('label', { class: 'gra-lbl' }, 'Jak masz na imię?'), inp,
        h('div', { class: 'gra-lbl' }, 'Jak się do ciebie zwracać?'), sx),
      goBtn('Zgłoś się do kadr', () => {
        const name = inp.value.trim().replace(/[<>]/g, '').slice(0, 20) || (sex === 'k' ? 'Kursantka' : 'Kursant');
        newRun(name, sex);
        play();
      }, 'gold'));
  }

  /* ---------- mapa / centrum gry ---------- */
  function hub() {
    const r = R();
    const root = shell();
    const d = D();
    const cur = chap(r.ch);
    const mapBox = h('div', { class: 'gra-map' }, h('img', { src: 'obrazy/gra/mapa.webp', alt: 'Mapa Zakładu Karnego w Bielinach' }));
    const pinChapters = {};
    for (const id of d.order) { const c = chap(id); if (c.pin) (pinChapters[c.pin] = pinChapters[c.pin] || []).push(id); }
    for (const [pid, p] of Object.entries(d.pins)) {
      const ids = pinChapters[pid] || [];
      const isNow = ids.includes(r.ch);
      const isDone = ids.length && ids.every(id => r.done[id] || (chap(id).path && chap(id).path !== r.path));
      const st = isNow ? 'now' : isDone && ids.some(id => r.done[id]) ? 'done' : 'lock';
      mapBox.append(h('div', { class: 'gra-pin ' + st, style: `left:${p.x}%;top:${p.y}%` },
        h('i', {}), h('span', {}, isNow ? 'Tu jesteś · ' + p.n : p.n)));
    }
    mapBox.append(h('div', { class: 'gra-map-fade' }));
    const kary = r.kary.filter(k => k.k !== 'rozmowa');
    root.append(mapBox,
      h('div', { class: 'gra-hubhead' }, h('div', { class: 'gra-kick' }, 'ZK w Bielinach · ' + fx('{imie}')), h('div', { class: 'gra-h1' }, 'Pierwsza służba')),
      meters(),
      h('div', { class: 'gra-chips' },
        h('span', { class: 'gra-chip red' }, `Kary w teczce: ${kary.length}`),
        h('span', { class: 'gra-chip gold' }, `Punkty gry: ${r.pts}`),
        r.path && h('span', { class: 'gra-chip blue' }, r.path === 'psych' ? 'Ścieżka: psycholog' : 'Ścieżka: dział ochrony')),
      cur ? goBtn(r.i > 0 || r.susp ? 'Kontynuuj służbę' : 'Rozpocznij: ' + cur.t, play, 'gold') : null);
    for (const akt of d.acts) {
      const ids = akt.chapters.filter(id => !chap(id).path || chap(id).path === r.path || (!r.path));
      const shown = r.path ? ids : ids.filter(id => !chap(id).path || chap(id).path === 'ochrona');
      const done = shown.filter(id => r.done[id]).length;
      const isNow = shown.includes(r.ch);
      const locked = !isNow && done === 0;
      const box = h('div', { class: 'gra-act' + (isNow ? ' now' : locked ? ' lock' : '') },
        h('div', { class: 'gra-act-n' }, akt.n),
        h('div', { class: 'gra-act-b' }, h('div', { class: 'gra-act-t' }, akt.t),
          h('div', { class: 'gra-act-s' }, isNow ? `Rozdział: ${cur.t}` : akt.s),
          isNow ? h('div', { class: 'gra-act-bar' }, h('i', { style: `width:${Math.round(done / Math.max(1, shown.length) * 100)}%` })) : null),
        done === shown.length && shown.length ? h('span', { class: 'gra-ok' }, 'ukończony') : locked ? gic('lock', 18, '#5b6e86') : gic('bolt', 20, '#f4c235'));
      root.append(box);
    }
    if (kary.length || r.kary.length) {
      root.append(h('div', { class: 'gra-card' }, h('div', { class: 'gra-lbl' }, 'Teczka osobowa – adnotacje'),
        h('ul', { class: 'gra-list' }, r.kary.map(k => h('li', {}, `${KARY[k.k].n} – ${k.why}`)))));
    }
    const endings = Object.keys(r.endings || {});
    if (endings.length) root.append(h('div', { class: 'gra-card' }, h('div', { class: 'gra-lbl' }, 'Odkryte zakończenia'),
      h('div', { class: 'gra-mut' }, endings.map(e => (d.endings[e] || {}).t || e).join(' · '))));
    root.append(h('button', { type: 'button', class: 'gra-link', onclick: () => {
      if (confirm('Zacząć grę od nowa? Postęp w grze zostanie usunięty (punkty i odpowiedzi w nauce zostają).')) { state.rpg = null; save(); intro(); }
    } }, 'Zacznij od nowa'));
  }

  /* ---------- odtwarzanie scen ---------- */
  function play() {
    const r = R();
    if (r.ending) return showEnding(r.ending);
    if (r.susp) return suspStep();
    const c = chap(r.ch);
    if (!c) return hub();
    let guard = 0;
    while (r.i < c.s.length && guard++ < 50) {
      const sc = c.s[r.i];
      if (sc.lab != null) { r.i++; continue; }
      if (sc.set) { r.flags[sc.set] = true; r.i++; continue; }
      if (sc.unset) { delete r.flags[sc.unset]; r.i++; continue; }
      if (sc.stat) { applyStats(sc.stat); r.i++; continue; }
      if (sc.go) { jump(c, sc.go); continue; }
      if (sc.forcepath) { if (r.flags.forcePath) { r.path = r.flags.forcePath; delete r.flags.forcePath; jump(c, sc.goto); } else r.i++; continue; }
      if (sc.if) { if (cond(sc.if)) jump(c, sc.goto); else r.i++; continue; }
      break;
    }
    save();
    if (r.i >= c.s.length) return chapterDone();
    const sc = c.s[r.i];
    if (sc.c) return choicePage(c, sc);
    if (sc.quiz) return quizPage(c, sc);
    if (sc.item) return itemPage(c, sc);
    if (sc.hunt) return huntPage(c, sc);
    if (sc.exam) return examPage(c, sc);
    if (sc.review) return reviewPage(c, sc);
    if (isSay(sc)) return sayPage(c);
    r.i++; play();
  }
  function cond(expr) {
    const r = R();
    return String(expr).split('&').every(p => {
      p = p.trim();
      if (p.startsWith('!')) return !r.flags[p.slice(1)];
      const m = p.match(/^(op|bez|zauf)([<>]=?)(\d+)$/);
      if (m) { const v = r.st[m[1]], n = +m[3]; return m[2] === '<' ? v < n : m[2] === '>' ? v > n : m[2] === '<=' ? v <= n : v >= n; }
      if (p === 'kary') return R().kary.some(k => k.k !== 'rozmowa');
      return !!r.flags[p];
    });
  }
  function jump(c, lab) {
    const k = c.s.findIndex(x => x.lab === lab);
    R().i = k < 0 ? c.s.length : k + 1;
  }
  function applyStats(d) {
    const r = R();
    if (!d) return;
    ['op', 'bez', 'zauf'].forEach((k, j) => { if (d[j]) r.st[k] = clamp(r.st[k] + d[j]); });
  }
  function gain(n) {
    if (!n) return;
    R().pts += n;
    addPoints(n);
    evaluate();
  }

  const isSay = sc => (sc.who !== undefined || sc.nar !== undefined) && !sc.c && !sc.quiz && !sc.item && !sc.hunt && !sc.exam && !sc.review;
  function sayPage(c) {
    const r = R();
    const root = shell(c.t);
    const lines = [];
    let k = r.i, bg = c.bg, tag = c.tag;
    while (k < c.s.length && lines.length < 3) {
      const sc = c.s[k];
      if (!isSay(sc)) break;
      if (sc.bg) bg = sc.bg;
      if (sc.tag) tag = sc.tag;
      lines.push(sc);
      k++;
      if (sc.pause) break;
    }
    root.append(head(c), sceneImg(bg, tag && fx(tag)));
    const body = h('div', { class: 'gra-body' });
    for (const sc of lines) body.append(bubble(sc.nar !== undefined ? 'nar' : sc.who, sc.nar !== undefined ? sc.nar : sc.t));
    root.append(body, goBtn('Dalej', () => { r.i = k; save(); play(); }, 'gold'));
  }
  function head(c) {
    const akt = D().acts.find(a => a.chapters.includes(c.id));
    return h('div', { class: 'gra-head' },
      h('div', {}, h('div', { class: 'gra-kick' }, `Akt ${akt ? akt.n : ''} · ${akt ? akt.t : ''}`), h('div', { class: 'gra-ht' }, c.t)),
      h('button', { type: 'button', class: 'gra-ib', 'aria-label': 'Mapa i postęp', onclick: hub }, gic('map', 20)), meters(true));
  }

  function choicePage(c, sc) {
    const r = R();
    const root = shell(c.t);
    root.append(head(c));
    if (sc.bg) c = Object.assign({}, c, { bg: sc.bg });
    root.append(sceneImg(sc.bg || c.bg));
    const body = h('div', { class: 'gra-body' });
    if (sc.who) body.append(bubble(sc.who, sc.say || ''));
    body.append(h('div', { class: 'gra-q' }, fx(sc.c)));
    const opts = sc.shuffle === false ? sc.o.map((o, j) => j) : shuffle(sc.o.map((o, j) => j));
    const L = 'ABCDE';
    opts.forEach((j, n) => {
      const o = sc.o[j];
      if (o.if && !cond(o.if)) return;
      body.append(h('button', { type: 'button', class: 'gra-opt', onclick: () => pick(c, sc, o) },
        h('span', { class: 'gra-l' }, L[n]), h('span', {}, fx(o.t))));
    });
    if (sc.hint) body.append(h('div', { class: 'gra-hint' }, gic('eye', 16), h('span', {}, fx(sc.hint))));
    root.append(body);
  }

  const VERDICT = {
    ok: ['Wzorowo', 'ok'], meh: ['Ujdzie', 'meh'], bad: ['Źle', 'bad'], dysc: ['Postępowanie dyscyplinarne', 'dysc'], karne: ['Przestępstwo', 'karne'], susp: ['Kłopoty', 'karne'],
  };
  function pick(c, sc, o) {
    const r = R();
    const res = o.r || 'meh';
    const before = { ...r.st };
    applyStats(o.d);
    if (o.set) [].concat(o.set).forEach(f => { r.flags[f] = true; });
    if (o.path) r.path = o.path;
    const pts = res === 'ok' ? 10 : res === 'meh' ? 3 : 0;
    gain(pts);
    if (res !== 'ok' && res !== 'susp') r.clean = false;
    if (res === 'dysc' && o.kara) r.kary.push({ k: o.kara, why: fx(o.why || c.t), ch: c.id });
    save();
    const root = shell(c.t);
    root.append(head(c));
    const [title, cls] = VERDICT[res] || VERDICT.meh;
    const deltas = h('div', { class: 'gra-deltas' }, ...Object.keys(STAT_N).map(k => {
      const v = r.st[k] - before[k];
      return h('div', { class: 'gra-delta' + (v > 0 ? ' up' : v < 0 ? ' down' : '') }, gic(STAT_IC[k], 18),
        h('b', {}, v > 0 ? '+' + v : v < 0 ? '−' + (-v) : '0'), h('small', {}, STAT_N[k]));
    }));
    const card = h('div', { class: 'gra-res ' + cls },
      h('div', { class: 'gra-res-h' }, h('span', { class: 'gra-res-ic' }, res === 'ok' ? '✓' : res === 'meh' ? '~' : '!'),
        h('strong', {}, title), pts ? h('span', { class: 'gra-pts' }, `+${pts} pkt`) : null),
      h('div', { class: 'gra-mut' }, 'Wybrał', fx('{eś|aś}'), ': ', h('b', {}, fx(o.t))), deltas);
    root.append(h('div', { class: 'gra-body' }, card,
      o.b ? bubble(o.who || 'bielik', o.b) : null,
      o.x ? h('div', { class: 'gra-card gra-ex' }, h('div', { class: 'gra-lbl' }, gic('book', 16), ' Wyjaśnienie'), h('div', {}, fx(o.x)),
        o.z ? h('div', { class: 'gra-src' }, 'Podstawa: ' + o.z) : null) : null,
      res === 'dysc' && o.kara ? karaCard(o.kara) : null,
      o.mem ? h('div', { class: 'gra-mem' }, gic('flag', 16), h('span', {}, fx(o.mem))) : null));
    const next = () => {
      if ((res === 'karne' || res === 'susp') && o.crime) { r.susp = { crime: o.crime, v: o.fake ? 'B' : D().crimes[o.crime].nieumyslne ? 'N' : 'A', step: 0, ch: c.id, back: o.go || null, resume: r.i + 1 }; save(); return play(); }
      if (karyWeight() >= KARY_LIMIT) return ending('wydalenie');
      if (o.end) return ending(o.end);
      if (o.go) jump(c, o.go); else r.i++;
      save(); play();
    };
    root.append(goBtn(res === 'karne' || res === 'susp' ? 'Co dalej…' : 'Dalej', next, res === 'karne' || res === 'susp' ? 'red' : 'gold'));
  }
  function karaCard(k) {
    const K = KARY[k];
    return h('div', { class: 'gra-card gra-kara' }, h('div', { class: 'gra-lbl' }, k === 'rozmowa' ? '📝 Rozmowa dyscyplinująca' : '⚖️ Kara dyscyplinarna: ' + K.n),
      h('div', {}, K.d), k !== 'rozmowa' ? h('div', { class: 'gra-mut' }, `Kary w teczce: ${R().kary.filter(x => x.k !== 'rozmowa').length}. Uzbierasz zbyt wiele – i będzie po służbie.`) : null);
  }
  const karyWeight = () => R().kary.reduce((s, k) => s + KARY[k.k].w, 0);

  /* ---------- kartkówki z bazy pytań ---------- */
  function quizPage(c, sc) {
    const r = R();
    const byId = Object.fromEntries(DATA.items.map(x => [x.id, x]));
    let items = (sc.quiz || []).map(id => byId[id]).filter(Boolean);
    items = shuffle(items).slice(0, sc.n || items.length);
    if (!items.length) { r.i++; return play(); }
    let k = 0, good = 0;
    const step = () => {
      const root = shell(c.t);
      root.append(head(c));
      const it = items[k];
      root.append(h('div', { class: 'gra-quizhead' }, h('span', {}, fx(sc.t || 'Kartkówka')), h('span', {}, `${k + 1} / ${items.length}`)));
      if (sc.who && k === 0) root.append(h('div', { class: 'gra-body' }, bubble(sc.who, sc.say || 'Pytanie kontrolne.')));
      const wrap = h('div', { class: 'gra-ex-wrap' }, ...exerciseView(it, ok => { if (ok) good++; }, () => {
        k++;
        if (k < items.length) return step();
        const pct = good / items.length;
        if (sc.pass && pct < sc.pass) { save(); return failQuiz(c, sc, good, items.length); }
        applyStats(pct >= 0.99 ? [2, 0, 0] : pct < 0.5 ? [-4, 0, 0] : [0, 0, 0]);
        r.i++; save(); quizSummary(c, sc, good, items.length);
      }, k + 1 < items.length ? 'Następne pytanie' : 'Zakończ'));
      root.append(wrap);
    };
    step();
  }
  function quizSummary(c, sc, good, n) {
    const root = shell(c.t);
    root.append(head(c));
    const line = good === n ? (sc.okLine || 'Komplet. Nawet się nie zdziwiłem… dobra, trochę się zdziwiłem.')
      : good / n >= 0.5 ? (sc.midLine || 'Zaliczone. Bez fajerwerków, ale zaliczone.') : (sc.badLine || 'Słabo. Kodeks nie gryzie, możesz go otworzyć.');
    root.append(h('div', { class: 'gra-body' }, h('div', { class: 'gra-res ' + (good === n ? 'ok' : good / n >= 0.5 ? 'meh' : 'bad') },
      h('div', { class: 'gra-res-h' }, h('strong', {}, `${fx(sc.t || 'Kartkówka')}: ${good} / ${n}`))), bubble(sc.by || 'bielik', line)),
    goBtn('Dalej', play, 'gold'));
  }
  function failQuiz(c, sc, good, n) {
    const root = shell(c.t);
    root.append(head(c), h('div', { class: 'gra-body' }, h('div', { class: 'gra-res bad' }, h('div', { class: 'gra-res-h' }, h('strong', {}, `Wynik: ${good} / ${n} – niezaliczone`))),
      bubble(sc.by || 'bielik', sc.failLine || 'Niezaliczone. Siadaj i powtarzaj – podejdziesz jeszcze raz.'),
      sc.failX ? h('div', { class: 'gra-card gra-ex' }, h('div', {}, fx(sc.failX)), sc.failZ ? h('div', { class: 'gra-src' }, 'Podstawa: ' + sc.failZ) : null) : null),
    goBtn('Podejdź jeszcze raz', () => quizPage(c, sc), 'gold'));
  }
  function itemPage(c, sc) {
    const r = R();
    const it = DATA.items.find(x => x.id === sc.item);
    if (!it) { r.i++; return play(); }
    const root = shell(c.t);
    root.append(head(c));
    if (sc.who) root.append(h('div', { class: 'gra-body' }, bubble(sc.who, sc.say || '')));
    let ok1 = false;
    const after = () => {
      r.i++; save();
      if (!sc.after) return play();
      const root2 = shell(c.t);
      root2.append(head(c), h('div', { class: 'gra-body' }, bubble(sc.by || 'bielik', ok1 ? sc.after[0] : sc.after[1])), goBtn('Dalej', play, 'gold'));
    };
    root.append(h('div', { class: 'gra-ex-wrap' }, ...exerciseView(it, ok => { ok1 = ok; applyStats(ok ? [4, 0, 0] : [-2, 0, 0]); if (ok) gain(5); }, after, 'Dalej')));
  }

  /* ---------- rewizja celi (szukanie przedmiotów) ---------- */
  function huntPage(c, sc) {
    const r = R();
    const H = sc.hunt;
    const root = shell(c.t);
    root.append(head(c));
    const picked = new Set();
    const box = h('div', { class: 'gra-hunt' }, h('img', { src: `obrazy/gra/${H.bg}.webp`, alt: 'Cela do przeszukania' }));
    const counter = h('span', {}, `Zaznaczone: 0`);
    H.items.forEach((it, j) => {
      const b = h('button', { type: 'button', class: 'gra-obj', style: `left:${it.x}%;top:${it.y}%`, 'aria-label': it.n, onclick: () => {
        if (picked.has(j)) picked.delete(j); else picked.add(j);
        b.classList.toggle('on', picked.has(j));
        counter.textContent = `Zaznaczone: ${picked.size}`;
      } }, it.ic);
      box.append(b);
    });
    root.append(h('div', { class: 'gra-body' }, bubble(sc.who || 'bielik', H.say), h('div', { class: 'gra-q' }, fx(H.q))), box,
      h('div', { class: 'gra-hunt-bar' }, counter, h('span', { class: 'gra-mut' }, 'Dotknij przedmiotu, żeby go zaznaczyć.')),
      goBtn('Zakończ rewizję', () => {
        let hit = 0, miss = 0, fp = 0;
        H.items.forEach((it, j) => { if (it.bad && picked.has(j)) hit++; else if (it.bad) miss++; else if (picked.has(j)) fp++; });
        const total = H.items.filter(x => x.bad).length;
        const res = miss === 0 && fp === 0 ? 'ok' : hit >= total - 1 && fp <= 1 ? 'meh' : 'bad';
        applyStats(res === 'ok' ? [6, 6, 0] : res === 'meh' ? [1, 2, 0] : [-4, -6, 0]);
        if (res === 'ok') gain(15); else if (res === 'meh') gain(5); else R().clean = false;
        r.i++; save();
        const out = shell(c.t);
        out.append(head(c), h('div', { class: 'gra-body' },
          h('div', { class: 'gra-res ' + res }, h('div', { class: 'gra-res-h' }, h('strong', {}, `Znalezione: ${hit} z ${total}` + (fp ? ` · niepotrzebnie zabrane: ${fp}` : '')))),
          bubble('bielik', res === 'ok' ? H.okLine : res === 'meh' ? H.midLine : H.badLine),
          h('div', { class: 'gra-card gra-ex' }, h('div', { class: 'gra-lbl' }, 'Co było w celi'),
            h('ul', { class: 'gra-list' }, H.items.map((it, j) => h('li', { class: it.bad ? (picked.has(j) ? 'hit' : 'miss') : picked.has(j) ? 'fp' : '' },
              `${it.ic} ${it.n} – ${it.x2}`))),
            H.z ? h('div', { class: 'gra-src' }, 'Podstawa: ' + H.z) : null)),
        goBtn('Dalej', play, 'gold'));
      }, 'gold'));
  }

  /* ---------- przegląd decyzji (opinia służbowa) ---------- */
  function reviewPage(c, sc) {
    const r = R();
    const root = shell(c.t);
    root.append(head(c));
    const kary = r.kary.filter(k => k.k !== 'rozmowa');
    const op = r.st.op;
    const verdict = op >= 75 ? 'wyróżniająca' : op >= 50 ? 'pozytywna' : op >= 25 ? 'pozytywna z zastrzeżeniami' : 'negatywna';
    const lines = (sc.review.lines || []).filter(l => cond(l.if)).map(l => fx(l.t));
    root.append(h('div', { class: 'gra-body' },
      h('div', { class: 'gra-card gra-opinia' }, h('div', { class: 'gra-lbl' }, fx(sc.review.title || 'Opinia służbowa')),
        h('div', { class: 'gra-op-v' }, 'Ocena: ', h('b', {}, verdict)),
        h('ul', { class: 'gra-list' }, lines.map(l => h('li', {}, l))),
        h('div', { class: 'gra-mut' }, `Kary dyscyplinarne: ${kary.length ? kary.map(k => KARY[k.k].n).join(', ') : 'brak'}.`)),
      bubble('bielik', op >= 75 ? sc.review.hi : op >= 25 ? sc.review.mid : sc.review.lo)));
    root.append(goBtn('Dalej', () => {
      if (sc.review.gate && op < 25) return ending(sc.review.gate);
      r.i++; save(); play();
    }, 'gold'));
  }

  /* ---------- egzamin końcowy ---------- */
  function examPage(c, sc) {
    const r = R();
    const E = sc.exam;
    const decks = r.path === 'psych' ? E.decks.concat(E.psych || []) : E.decks;
    let pool = DATA.items.filter(x => x.type === 'mcq' && decks.includes(x.deck));
    pool = shuffle(pool);
    const seen = new Set(), items = [];
    for (const it of pool) { const g = it.grupa || it.id; if (seen.has(g)) continue; seen.add(g); items.push(it); if (items.length >= E.n) break; }
    let k = 0, good = 0;
    const step = () => {
      const root = shell(c.t);
      root.append(head(c), h('div', { class: 'gra-quizhead' }, h('span', {}, 'Egzamin na chorążego'), h('span', {}, `${k + 1} / ${items.length} · dobrze: ${good}`)));
      root.append(h('div', { class: 'gra-ex-wrap' }, ...exerciseView(items[k], ok => { if (ok) good++; }, () => {
        k++;
        if (k < items.length) return step();
        const pct = Math.round(good / items.length * 100);
        r.flags.examPct = pct;
        if (pct < E.pass) { save(); return ending('niezdany'); }
        gain(pct >= 91 ? 150 : 100);
        r.i++; save(); play();
      }, k + 1 < items.length ? 'Następne pytanie' : 'Zakończ egzamin')));
    };
    step();
  }

  /* ---------- koniec rozdziału ---------- */
  function chapterDone() {
    const r = R();
    const c = chap(r.ch);
    r.done[c.id] = true;
    if (Object.keys(r.done).length === 2 && state.settings) state.settings.statsAt = 0; // licznik graczy w panelu
    gain(25);
    const nx = nextChapter(c.id);
    if (c.final) return finale();
    r.ch = nx;
    checkpoint();
    save();
    const root = shell(c.t);
    root.append(h('div', { class: 'gra-body gra-center' },
      h('div', { class: 'gra-kick' }, 'Rozdział zaliczony'), h('div', { class: 'gra-h1' }, c.t),
      h('div', { class: 'gra-pts big' }, '+25 pkt'), meters(),
      c.outro ? bubble('bielik', c.outro) : null,
      nx ? h('div', { class: 'gra-mut' }, 'Następnie: ' + chap(nx).t + '. Punkt kontrolny zapisany.') : null),
    goBtn(nx ? 'Dalej' : 'Mapa', nx ? play : hub, 'gold'), goBtn('Mapa', hub, 'ghost'));
  }

  function finale() {
    const r = R();
    r.paths[r.path] = true;
    const kary = r.kary.filter(k => k.k !== 'rozmowa').length;
    let e = kary ? 'przygody' : 'wzorowy';
    if (!kary && r.clean && r.st.op >= 80) e = 'sekret';
    save();
    ending(e);
  }

  /* ---------- zakończenia ---------- */
  function ending(id) {
    const r = R();
    r.ending = id;
    r.endings = r.endings || {};
    r.endings[id] = (r.endings[id] || 0) + 1;
    save();
    showEnding(id);
  }
  function showEnding(id) {
    const r = R();
    const E = D().endings[id] || { t: id, d: '' };
    const root = shell('Zakończenie');
    const bad = !!E.bad;
    root.append(h('div', { class: 'gra-end' + (bad ? ' bad' : '') },
      E.bg ? h('img', { src: `obrazy/gra/${E.bg}.webp`, alt: '' }) : null,
      h('div', { class: 'gra-end-t' }, h('span', { class: 'gra-badge' + (bad ? ' red' : '') }, bad ? 'KONIEC SŁUŻBY' : 'ZAKOŃCZENIE'), h('div', { class: 'gra-h1' }, E.t))));
    const body = h('div', { class: 'gra-body' }, h('div', { class: 'gra-card' }, fx(E.d)));
    if (E.steps) body.append(h('div', { class: 'gra-card gra-steps' }, E.steps.map(s => h('div', { class: 'gra-step on' }, h('i', {}), h('div', {}, h('b', {}, s[0]), h('small', {}, s[1]))))));
    if (id === 'niezdany' || r.flags.examPct != null && !bad) body.append(h('div', { class: 'gra-mut' }, `Wynik egzaminu: ${r.flags.examPct}%`));
    if (E.b) body.append(bubble('bielik', E.b));
    if (E.z) body.append(h('div', { class: 'gra-src' }, 'Podstawa: ' + E.z));
    root.append(body);
    if (bad || id === 'niezdany') {
      root.append(goBtn(id === 'niezdany' ? 'Podejdź do egzaminu jeszcze raz' : 'Wróć do punktu kontrolnego', () => {
        r.ending = null;
        if (r.cp) restore(r.cp);
        play();
      }, 'gold'));
    } else {
      const other = r.path === 'psych' ? 'ochrona' : 'psych';
      if (!r.paths[other] && r.cpRaport) root.append(goBtn(other === 'psych' ? 'A gdyby tak… zostać psychologiem?' : 'A gdyby tak… zostać w ochronie?', () => {
        const keepPaths = r.paths, keepEnd = r.endings;
        r.ending = null;
        restore(r.cpRaport);
        r.paths = keepPaths; r.endings = keepEnd;
        r.flags.forcePath = other;
        save(); play();
      }, 'gold'));
      root.append(goBtn('Mapa', () => { r.ending = null; save(); hub(); }, 'ghost'));
    }
  }

  /* ---------- ścieżka „Zawieszony” ---------- */
  function suspStep() {
    const r = R();
    const S = r.susp;
    const C = D().crimes[S.crime];
    const Z = D().zawieszony;
    const pages = Z[S.v] || Z.A;
    const p = pages[S.step];
    if (!p) return suspEnd();
    const root = shell('Zawieszony');
    root.append(h('div', { class: 'gra-head susp' }, h('div', {}, h('div', { class: 'gra-kick red' }, 'Ścieżka: zawieszony'), h('div', { class: 'gra-ht' }, p.t)), meters(true)));
    root.append(sceneImg(p.bg));
    const body = h('div', { class: 'gra-body' });
    const tx = s => fx(String(s).replace(/\{art\}/g, C.art).replace(/\{czyn\}/g, C.n).replace(/\{kara\}/g, C.kara));
    (p.lines || []).forEach(l => body.append(bubble(l[0], tx(l[1]))));
    if (p.info) body.append(h('div', { class: 'gra-card gra-ex' }, h('div', { class: 'gra-lbl' }, gic('book', 16), ' ', tx(p.info[0])), h('div', {}, tx(p.info[1])), p.info[2] ? h('div', { class: 'gra-src' }, 'Podstawa: ' + p.info[2]) : null));
    root.append(body);
    if (p.c) {
      body.append(h('div', { class: 'gra-q' }, tx(p.c)));
      p.o.filter(o => !o.if || cond(o.if)).forEach((o, j) => body.append(h('button', { type: 'button', class: 'gra-opt', onclick: () => {
        if (o.lie) S.lie = true;
        applyStats(o.d);
        const out = shell('Zawieszony');
        out.append(h('div', { class: 'gra-body' }, h('div', { class: 'gra-res ' + (o.r || 'meh') }, h('div', { class: 'gra-res-h' }, h('strong', {}, tx(o.t)))),
          o.b ? bubble(o.who || 'adwokat', tx(o.b)) : null,
          o.x ? h('div', { class: 'gra-card gra-ex' }, h('div', {}, tx(o.x)), o.z ? h('div', { class: 'gra-src' }, 'Podstawa: ' + o.z) : null) : null),
        goBtn('Dalej', () => { S.step++; save(); play(); }, 'gold'));
      } }, h('span', { class: 'gra-l' }, 'ABC'[j]), h('span', {}, tx(o.t)))));
    } else {
      root.append(goBtn('Dalej', () => { S.step++; save(); play(); }, 'gold'));
    }
  }
  function suspEnd() {
    const r = R();
    const S = r.susp;
    const C = D().crimes[S.crime];
    r.susp = null;
    if (S.v === 'B') {
      // Fałszywe oskarżenie: umorzenie, uchylenie zawieszenia, zwrot zawieszonej części uposażenia.
      applyStats(r.flags.notatka21 ? [-2, 0, 0] : [-10, 0, 0]);
      r.flags.oczyszczony = true;
      if (S.back) jump(chap(S.ch), S.back); else r.i = S.resume;
      save();
      return play();
    }
    if (C.nieumyslne) {
      r.kary.push({ k: 'ost_stan', why: C.n, ch: S.ch });
      applyStats([-15, -5, 0]);
      r.clean = false;
      if (karyWeight() >= KARY_LIMIT) return ending('wydalenie');
      if (S.back) jump(chap(S.ch), S.back); else r.i = S.resume;
      save();
      return play();
    }
    ending(C.end || 'krata');
  }

  window.renderGra = renderGra;
  window.GRA_ENGINE = { version: 1, KARY, cond: e => cond(e) };
})();
