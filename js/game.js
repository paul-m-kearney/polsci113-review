// Interface for the POLSCI 113 review game. Rules live in js/logic.js; questions in js/bank.js.
(function () {
  'use strict';
  const BANK = window.BANK, L = window.Logic;
  const app = document.getElementById('app'), dlg = document.getElementById('dlg');
  const KEY_GAME = 'ps113:game', KEY_SETUP = 'ps113:setup';

  // ---------- storage (the page must still work when storage is blocked) ----------
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window or blocked */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
  };

  // ---------- state ----------
  let G = null;                                  // the game in progress (saved after every change)
  let ui = { screen: 'setup' };                  // what is on screen right now (never saved)
  let setup = { mode: 'solo', teams: 2, names: L.TEAM_NAMES.slice(), board: 'random', bonus: true, penalty: true };
  try { Object.assign(setup, JSON.parse(store.get(KEY_SETUP) || '{}')); } catch (e) { /* keep defaults */ }
  // Settings saved by the two-team version have two names and no team count: fill in the rest.
  setup.teams = Math.min(L.MAX_TEAMS, Math.max(L.MIN_TEAMS, Number(setup.teams) || L.MIN_TEAMS));
  setup.names = L.TEAM_NAMES.map((d, i) => (Array.isArray(setup.names) && setup.names[i]) || d);
  const ORDINAL = ['First', 'Second', 'Third', 'Fourth'];
  const saved = () => L.restore(store.get(KEY_GAME), BANK);
  const save = () => { if (G) store.set(KEY_GAME, JSON.stringify(G)); };

  // ---------- helpers ----------
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pts = n => (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('en-US');
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('en-US');
  const catOf = key => BANK.categories.find(c => c.key === key);
  const item = id => L.itemOf(BANK, id);
  const solo = () => G.mode === 'solo';
  const source = it => `Week ${it.week} · ${esc(it.reading)}`;
  const badge = (done, correct, picked, i) => (done && correct ? '✓' : done && picked ? '✗' : i + 1);

  function ask(title, body, okLabel) {
    return new Promise(resolve => {
      dlg.innerHTML = `<form method="dialog" class="dlg-form"><h2 id="dlgTitle">${esc(title)}</h2><p>${esc(body)}</p>
        <div class="row end"><button value="cancel" class="btn ghost">Cancel</button><button value="ok" class="btn primary">${esc(okLabel)}</button></div></form>`;
      dlg.onclose = () => resolve(dlg.returnValue === 'ok');
      dlg.returnValue = ''; dlg.showModal();
    });
  }

  // ---------- shared pieces ----------
  function scorebar() {
    if (solo()) {
      const p = G.players[0], tried = p.right + p.wrong;
      return `<div class="scorebar"><div class="chip"><span class="chip-name">Score</span><span class="chip-score">${pts(p.score)}</span></div>
        <div class="chip quiet"><span class="chip-name">Correct</span><span class="chip-score">${p.right} of ${tried}</span></div></div>`;
    }
    return `<div class="scorebar">${G.players.map((p, i) => `<div class="chip team${i}${G.phase === 'board' && G.turn === i ? ' picking' : ''}">
      <span class="chip-name">${esc(p.name)}</span><span class="chip-score">${pts(p.score)}</span>
      ${G.phase === 'board' && G.turn === i ? '<span class="chip-tag">picks next</span>' : ''}</div>`).join('')}</div>`;
  }
  function answerPanel(it) {
    return `<div class="answer" role="status"><span class="answer-label">Answer</span><p class="answer-text">${esc(it.answer)}</p>
      <p class="answer-why">${esc(it.explain)}</p><p class="answer-src">${source(it)}</p></div>`;
  }

  // Team play: the four choices on screen for everyone to read. The host still marks the answers;
  // once the answer is shown, the correct choice lights up and the others fade.
  function shownChoices(it, revealed) {
    return `<div class="choices shown" aria-label="Choices">${L.choiceOrder(G, it).map((c, i) =>
      `<div class="choice static${revealed ? (c.correct ? ' right' : ' dim') : ''}"><span class="choice-key">${revealed && c.correct ? '✓' : i + 1}</span><span>${esc(c.text)}</span></div>`).join('')}</div>`;
  }

  // ---------- setup ----------
  function renderSetup() {
    const s = saved(), resumable = s && s.phase !== 'done';
    const boards = [1, 2, 3, 4, 'random'];
    app.innerHTML = `<section class="setup">
      <h1>Ready to review?</h1>
      <p class="lede">Thirty clues across six categories, then one final round. Play alone to study, or split the room into as many as four teams.</p>
      ${resumable ? `<div class="resume"><span>You have a game in progress (${esc(s.players.map(p => p.name + ' ' + pts(p.score)).join(', '))}).</span>
        <button class="btn primary" data-act="resume">Resume game</button></div>` : ''}
      <h2>How are you playing?</h2>
      <div class="modes">
        <button class="mode" data-act="mode" data-v="solo" aria-pressed="${setup.mode === 'solo'}"><strong>Solo review</strong><span>Multiple choice, scored for you, with explanations.</span></button>
        <button class="mode" data-act="mode" data-v="teams" aria-pressed="${setup.mode === 'teams'}"><strong>Teams</strong><span>Two to four teams on one shared screen. Everyone sees the clue and four choices; a host marks the answers.</span></button>
      </div>
      ${setup.mode === 'teams' ? `<h2>How many teams?</h2>
      <div class="seg" role="group" aria-label="Number of teams">
        ${[2, 3, 4].map(n => `<button data-act="teams" data-v="${n}" aria-pressed="${setup.teams === n}">${n} teams</button>`).join('')}
      </div>
      <div class="names">${setup.names.slice(0, setup.teams).map((nm, i) =>
        `<label>${ORDINAL[i]} team<input id="name${i}" maxlength="24" value="${esc(nm)}"></label>`).join('')}</div>` : ''}
      <h2>Which board?</h2>
      <div class="seg" role="group" aria-label="Board">
        ${boards.map(b => `<button data-act="board" data-v="${b}" aria-pressed="${String(setup.board) === String(b)}">${b === 'random' ? 'Random mix' : 'Board ' + b}</button>`).join('')}
      </div>
      <p class="hint">Boards 1 to 4 share no clues. Random mix draws one clue per square from all four.</p>
      <h2>Options</h2>
      <label class="check"><input type="checkbox" id="optBonus" ${setup.bonus ? 'checked' : ''}> Hide one bonus wager clue on the board</label>
      ${setup.mode === 'teams' ? `<label class="check"><input type="checkbox" id="optPenalty" ${setup.penalty ? 'checked' : ''}> Wrong answers lose the clue's points</label>` : ''}
      <div class="row"><button class="btn primary big" data-act="start" data-primary>Start game</button></div>
      <details class="how"><summary>How to play</summary>
        <ul>
          <li><strong>Solo:</strong> pick a square, choose one of four answers, and read the explanation. Wrong answers cost nothing, except on a wager.</li>
          <li><strong>Teams:</strong> two to four teams. The team that picks reads the clue aloud, and the four choices are on screen for everyone. The host marks teams right or wrong until one is right (or no one is), then shows the answer. A correct answer wins the next pick.</li>
          <li><strong>Bonus wager:</strong> one hidden square lets the player or picking team bet up to their score (or up to 500 if they have less).</li>
          <li><strong>Final round:</strong> one clue that ties several weeks together. Everyone wagers before seeing it.</li>
          <li><strong>Keys:</strong> Space shows the answer or continues, 1 to 4 pick a choice, Esc goes back.</li>
        </ul></details>
    </section>`;
  }
  function readSetup() {
    setup.names = setup.names.map((nm, i) => { const el = document.getElementById('name' + i); return el ? el.value.trim() || L.TEAM_NAMES[i] : nm; });
    const b = document.getElementById('optBonus'), p = document.getElementById('optPenalty');
    if (b) setup.bonus = b.checked;
    if (p) setup.penalty = p.checked;
    store.set(KEY_SETUP, JSON.stringify(setup));
  }

  // ---------- board ----------
  function renderBoard() {
    const done = L.isBoardDone(G);
    const cols = BANK.categories.map(c => `<div class="cat"><div class="cat-name"><span class="long">${esc(c.name)}</span><span class="short">${esc(c.short || c.name)}</span></div>
      ${BANK.values.map(v => {
        const id = G.board.cells[c.key][v], e = G.played[id], played = L.isPlayed(G, id);
        const mark = played && solo() ? (e.attempts.some(a => a.correct) ? '✓' : '✗') : '';
        return `<button class="cell${played ? ' played' : ''}" data-act="open" data-id="${id}" ${played ? 'disabled' : ''}
          aria-label="${esc(c.name)}, ${v} points${played ? ', played' : ''}">${played ? `<span class="cell-mark">${mark}</span>` : v}</button>`;
      }).join('')}</div>`).join('');
    app.innerHTML = `<section class="game">${scorebar()}
      ${done ? `<div class="banner"><span>The board is cleared.</span><button class="btn primary" data-act="final" data-primary>Go to the final round</button></div>` : ''}
      <div class="board">${cols}</div>
      <div class="row foot">
        <span class="left-count">${L.remaining(G)} clues left</span>
        ${!done ? '<button class="btn ghost" data-act="final">Skip to final round</button>' : ''}
        ${!solo() ? '<button class="btn ghost" data-act="scores">Edit scores</button>' : ''}
        <button class="btn ghost" data-act="quit">Quit game</button>
      </div></section>`;
  }

  // ---------- clue ----------
  function openClue(id) {
    if (L.isPlayed(G, id)) return;
    const bonus = id === G.board.bonusId;
    ui = { screen: 'clue', id, bonus, wager: null, bonusPlayer: solo() ? 0 : G.turn, revealed: false, resolved: false, picked: null, deltas: [] };
    render();
  }
  function resolveClue() { L.closeClue(G, ui.id); ui.revealed = true; ui.resolved = true; save(); }
  function renderClue() {
    const it = item(ui.id), cat = catOf(it.cat), who = G.players[ui.bonusPlayer];
    const head = `<div class="clue-head"><span class="clue-cat">${esc(cat.name)}</span><span class="clue-val">${ui.bonus ? 'Bonus wager' : it.value + ' points'}</span></div>`;
    if (ui.bonus && ui.wager === null) {
      const lim = L.wagerLimits(who.score, 'bonus');
      app.innerHTML = `<section class="game">${scorebar()}<div class="clue">${head}
        <h1 class="bonus-title">Bonus wager</h1>
        <p class="clue-note">${solo() ? 'How much will you bet on this clue?' : esc(who.name) + ' found the bonus clue. Only they answer. How much will they bet?'}</p>
        <form class="wager" data-form="wager"><label for="wagerIn">Wager (${lim.min} to ${pts(lim.max)})</label>
          <input id="wagerIn" type="number" inputmode="numeric" min="${lim.min}" max="${lim.max}" step="50" value="${Math.min(lim.max, Math.max(lim.min, it.value))}" required>
          <button class="btn primary" data-primary>Lock it in</button></form></div></section>`;
      return;
    }
    let body;
    if (solo()) {
      const order = L.choiceOrder(G, it);
      body = `<div class="choices">${order.map((c, i) => {
        let cls = 'choice';
        if (ui.resolved) cls += c.correct ? ' right' : (ui.picked === i ? ' wrong' : ' dim');
        return `<button class="${cls}" data-act="choose" data-i="${i}" ${ui.resolved ? 'disabled' : ''}><span class="choice-key">${badge(ui.resolved, c.correct, ui.picked === i, i)}</span><span>${esc(c.text)}</span></button>`;
      }).join('')}</div>
      ${ui.resolved ? `<p class="verdict ${ui.deltas[0] > 0 ? 'good' : 'bad'}" role="status">${ui.deltas[0] > 0 ? 'Correct. ' + signed(ui.deltas[0]) : 'Not quite.' + (ui.deltas[0] < 0 ? ' ' + signed(ui.deltas[0]) : '')}</p>${answerPanel(it)}
        <div class="row"><button class="btn primary big" data-act="continue" data-primary>Continue</button></div>` : ''}`;
    } else {
      const players = ui.bonus ? [ui.bonusPlayer] : G.players.map((_, i) => i);
      const marks = players.map(i => {
        const tried = L.hasAttempted(G, ui.id, i), a = tried && G.played[ui.id].attempts.find(x => x.p === i);
        if (tried) return `<div class="mark done team${i}"><span>${esc(G.players[i].name)}</span><strong class="${a.correct ? 'good' : 'bad'}">${a.correct ? '✓' : '✗'} ${signed(a.delta)}</strong></div>`;
        if (ui.resolved) return `<div class="mark done team${i}"><span>${esc(G.players[i].name)}</span><strong>no answer</strong></div>`;
        return `<div class="mark team${i}"><span>${esc(G.players[i].name)}</span>
          <button class="btn good" data-act="mark" data-p="${i}" data-c="1">✓ Right</button>
          <button class="btn bad" data-act="mark" data-p="${i}" data-c="0">✗ Wrong</button></div>`;
      }).join('');
      body = `${shownChoices(it, ui.revealed)}${ui.revealed ? answerPanel(it) : `<div class="row"><button class="btn primary big" data-act="reveal" data-primary>Show answer</button></div>`}
        <div class="marks">${marks}</div>
        <div class="row">${ui.resolved ? '<button class="btn primary big" data-act="continue" data-primary>Back to the board</button>'
          : (ui.bonus ? '' : '<button class="btn ghost" data-act="noone">No one got it</button>')}</div>`;
    }
    app.innerHTML = `<section class="game">${scorebar()}<div class="clue">${head}
      ${ui.bonus ? `<p class="clue-note">${solo() ? 'Your wager' : esc(who.name) + "'s wager"}: ${pts(ui.wager)}</p>` : ''}
      <p class="clue-text">${esc(it.clue)}</p>${body}</div></section>`;
  }
  function choose(i) {
    if (ui.resolved) return;
    const it = item(ui.id), order = L.choiceOrder(G, it);
    if (!order[i]) return;
    ui.picked = i;
    ui.deltas = [L.markAttempt(G, BANK, ui.id, 0, order[i].correct, ui.bonus ? ui.wager : undefined)];
    resolveClue(); render();
  }
  function mark(p, correct) {
    if (ui.resolved || L.hasAttempted(G, ui.id, p)) return;
    L.markAttempt(G, BANK, ui.id, p, correct, ui.bonus ? ui.wager : undefined);
    const players = ui.bonus ? [ui.bonusPlayer] : G.players.map((_, i) => i);
    if (correct || players.every(i => L.hasAttempted(G, ui.id, i))) resolveClue(); else save();
    render();
  }

  // ---------- final round ----------
  async function goFinal() {
    if (!L.isBoardDone(G) && !(await ask('Skip to the final round?', `${L.remaining(G)} clues are still on the board. You will not be able to come back to them.`, 'Go to the final round'))) return;
    L.startFinal(G); save(); ui = { screen: 'final', step: 'intro', wager: null, picked: null, delta: 0 }; render();
  }
  function renderFinal() {
    const it = item(G.board.finalId);
    const head = `<div class="clue-head"><span class="clue-cat">Final round</span><span class="clue-val">Across the whole course</span></div>`;
    let body = '';
    if (ui.step === 'intro') {
      if (solo()) {
        const lim = L.wagerLimits(G.players[0].score, 'final');
        body = `<h1 class="bonus-title">Final round</h1><p class="clue-note">One clue that ties several weeks together. Wager before you see it.</p>
          <form class="wager" data-form="finalwager"><label for="wagerIn">Wager (0 to ${pts(lim.max)})</label>
          <input id="wagerIn" type="number" inputmode="numeric" min="0" max="${lim.max}" step="50" value="${Math.min(lim.max, Math.max(0, G.players[0].score))}" required>
          <button class="btn primary" data-primary>Show the clue</button></form>`;
      } else {
        body = `<h1 class="bonus-title">Final round</h1><p class="clue-note">One clue that ties several weeks together. Each team writes down its wager now, before seeing the clue.</p>
          <div class="marks">${G.players.map((p, i) => `<div class="mark done team${i}"><span>${esc(p.name)}</span><strong>can wager up to ${pts(L.wagerLimits(p.score, 'final').max)}</strong></div>`).join('')}</div>
          <div class="row"><button class="btn primary big" data-act="fclue" data-primary>Wagers are in: show the clue</button></div>`;
      }
    } else if (solo()) {
      const order = L.choiceOrder(G, it), done = ui.step === 'result';
      body = `<p class="clue-note">Your wager: ${pts(ui.wager)}</p><p class="clue-text">${esc(it.clue)}</p>
        <div class="choices">${order.map((c, i) => {
          let cls = 'choice'; if (done) cls += c.correct ? ' right' : (ui.picked === i ? ' wrong' : ' dim');
          return `<button class="${cls}" data-act="fchoose" data-i="${i}" ${done ? 'disabled' : ''}><span class="choice-key">${badge(done, c.correct, ui.picked === i, i)}</span><span>${esc(c.text)}</span></button>`;
        }).join('')}</div>
        ${done ? `<p class="verdict ${ui.delta > 0 ? 'good' : 'bad'}" role="status">${ui.delta > 0 ? 'Correct. ' : 'Not quite. '}${signed(ui.delta)}</p>${answerPanel(it)}
          <div class="row"><button class="btn primary big" data-act="results" data-primary>See your results</button></div>` : ''}`;
    } else {
      body = `<p class="clue-text">${esc(it.clue)}</p>${shownChoices(it, ui.step !== 'clue')}`;
      if (ui.step === 'clue') body += `<p class="clue-note">Teams write down their answers. Then:</p><div class="row"><button class="btn primary big" data-act="fanswer" data-primary>Show answer</button></div>`;
      else body += `${answerPanel(it)}<form class="final-form" data-form="finalteams">
        <div class="final-teams">${G.players.map((p, i) => { const lim = L.wagerLimits(p.score, 'final'); return `<fieldset class="mark team${i}"><legend>${esc(p.name)}</legend>
          <label>Wager <input type="number" inputmode="numeric" name="w${i}" min="0" max="${lim.max}" step="50" value="0" required></label>
          <label class="radio"><input type="radio" name="c${i}" value="1" required> ✓ Right</label>
          <label class="radio"><input type="radio" name="c${i}" value="0"> ✗ Wrong</label></fieldset>`; }).join('')}</div>
        <div class="row"><button class="btn primary big" data-primary>Finish the game</button></div></form>`;
    }
    app.innerHTML = `<section class="game">${scorebar()}<div class="clue final">${head}${body}</div></section>`;
  }
  function finalChoose(i) {
    if (ui.step !== 'clue') return;
    const order = L.choiceOrder(G, item(G.board.finalId));
    if (!order[i]) return;
    ui.picked = i; ui.delta = L.markFinal(G, 0, ui.wager, order[i].correct); ui.step = 'result'; save(); render();
  }

  // ---------- end ----------
  function renderEnd() {
    const lead = L.leaders(G), miss = L.missed(G, BANK);
    let headline, sub;
    if (solo()) {
      const p = G.players[0], tried = p.right + p.wrong;
      headline = `You scored ${pts(p.score)}`;
      sub = tried ? `${p.right} of ${tried} correct` : 'No clues answered';
    } else {
      const names = lead.map(i => esc(G.players[i].name));
      if (lead.length === 1) headline = `Winner: ${names[0]}`;
      else if (lead.length === G.players.length) headline = "It's a tie!";
      else headline = `Tie for first: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      sub = G.players.slice().sort((a, b) => b.score - a.score).map(p => `${esc(p.name)} ${pts(p.score)}`).join(' · ');
    }
    app.innerHTML = `<section class="end"><h1>${headline}</h1><p class="lede">${sub}</p>
      <div class="row"><button class="btn primary big" data-act="again" data-primary>Play again</button><button class="btn ghost" data-act="tosetup">Change settings</button></div>
      <h2>${solo() ? 'Review what you missed' : 'Clues nobody got'}</h2>
      ${miss.length ? `<ol class="review">${miss.map(it => `<li><p class="rev-clue">${esc(it.clue)}</p><p class="rev-ans">${esc(it.answer)}</p>
        <p class="rev-why">${esc(it.explain)}</p><p class="rev-src">${it.cat === 'FINAL' ? 'Final round' : esc(catOf(it.cat).name)} · ${source(it)}</p></li>`).join('')}</ol>`
        : `<p class="hint">${solo() ? 'Nothing to review: you got every clue you tried.' : 'Every clue was answered correctly by someone.'}</p>`}
    </section>`;
  }

  // ---------- dialogs ----------
  function editScores() {
    dlg.innerHTML = `<form method="dialog" class="dlg-form"><h2 id="dlgTitle">Edit scores</h2><p>Fix a marking mistake by typing the correct totals.</p>
      ${G.players.map((p, i) => `<label>${esc(p.name)}<input type="number" step="50" id="sc${i}" value="${p.score}"></label>`).join('')}
      <div class="row end"><button value="cancel" class="btn ghost">Cancel</button><button value="ok" class="btn primary">Save scores</button></div></form>`;
    dlg.onclose = () => {
      if (dlg.returnValue === 'ok') { G.players.forEach((_, i) => L.setScore(G, i, document.getElementById('sc' + i).value)); save(); render(); }
    };
    dlg.returnValue = ''; dlg.showModal();
  }

  // ---------- render + events ----------
  function render() {
    ({ setup: renderSetup, board: renderBoard, clue: renderClue, final: renderFinal, end: renderEnd })[ui.screen]();
    document.body.dataset.screen = ui.screen;
    const primary = app.querySelector('[data-primary]'), input = app.querySelector('.wager input');
    if (input) { input.focus(); input.select(); } else if (primary) primary.focus({ preventScroll: true }); else app.focus({ preventScroll: true });
    // Once an answer is on screen, make sure it and the next button are in view; otherwise start at the top.
    const ans = app.querySelector('.verdict') || app.querySelector('.answer');
    if (ans && primary && primary.getBoundingClientRect().bottom > window.innerHeight) {
      const tall = primary.getBoundingClientRect().bottom - ans.getBoundingClientRect().top + 32 > window.innerHeight;
      (tall ? ans : primary).scrollIntoView({ block: tall ? 'start' : 'end' });
    } else if (ui.screen !== 'board') window.scrollTo(0, 0);
  }
  function startGame() {
    readSetup();
    G = L.newGame(BANK, { mode: setup.mode, teams: setup.teams, names: setup.names.slice(0, setup.teams), board: setup.board === 'random' ? 'random' : Number(setup.board), bonus: setup.bonus, penalty: setup.penalty });
    save(); ui = { screen: 'board' }; render();
  }
  function continueFromClue() { ui = { screen: 'board' }; render(); }

  app.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const act = b.dataset.act;
    if (act === 'mode') { readSetup(); setup.mode = b.dataset.v; store.set(KEY_SETUP, JSON.stringify(setup)); render(); }
    else if (act === 'teams') { readSetup(); setup.teams = Number(b.dataset.v); store.set(KEY_SETUP, JSON.stringify(setup)); render(); }
    else if (act === 'board') { readSetup(); setup.board = b.dataset.v; store.set(KEY_SETUP, JSON.stringify(setup)); render(); }
    else if (act === 'start') startGame();
    else if (act === 'resume') { G = saved(); if (G) { ui = G.phase === 'final' ? { screen: 'final', step: 'intro', wager: null, picked: null, delta: 0 } : { screen: 'board' }; render(); } }
    else if (act === 'open') openClue(b.dataset.id);
    else if (act === 'reveal') { ui.revealed = true; render(); }
    else if (act === 'mark') mark(Number(b.dataset.p), b.dataset.c === '1');
    else if (act === 'noone') { resolveClue(); render(); }
    else if (act === 'choose') choose(Number(b.dataset.i));
    else if (act === 'continue') continueFromClue();
    else if (act === 'final') goFinal();
    else if (act === 'scores') editScores();
    else if (act === 'quit') { if (await ask('Quit this game?', 'The scores and the board will be cleared.', 'Quit game')) { G = null; store.del(KEY_GAME); ui = { screen: 'setup' }; render(); } }
    else if (act === 'fclue') { ui.step = 'clue'; render(); }
    else if (act === 'fanswer') { ui.step = 'answer'; render(); }
    else if (act === 'fchoose') finalChoose(Number(b.dataset.i));
    else if (act === 'results') { L.finish(G); save(); ui = { screen: 'end' }; render(); }
    else if (act === 'again') startGame();
    else if (act === 'tosetup') { G = null; store.del(KEY_GAME); ui = { screen: 'setup' }; render(); }
  });
  app.addEventListener('submit', e => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    if (f.dataset.form === 'wager') { ui.wager = L.clampWager(f.querySelector('input').value, L.wagerLimits(G.players[ui.bonusPlayer].score, 'bonus')); render(); }
    else if (f.dataset.form === 'finalwager') { ui.wager = L.clampWager(f.querySelector('input').value, L.wagerLimits(G.players[0].score, 'final')); ui.step = 'clue'; render(); }
    else if (f.dataset.form === 'finalteams') {
      const d = new FormData(f);
      G.players.forEach((_, i) => L.markFinal(G, i, d.get('w' + i), d.get('c' + i) === '1'));
      L.finish(G); save(); ui = { screen: 'end' }; render();
    }
  });
  document.addEventListener('keydown', e => {
    if (dlg.open || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target, typing = t.matches && t.matches('input, textarea, select'), onButton = t.matches && t.matches('button, summary, a');
    if (typing) return;
    const go = (e.key === ' ' || e.key === 'Enter') && !onButton;     // a focused button already handles Space and Enter
    if (ui.screen === 'clue') {
      if (/^[1-4]$/.test(e.key) && solo() && !(ui.bonus && ui.wager === null)) { e.preventDefault(); choose(Number(e.key) - 1); }
      else if (go && ui.resolved) { e.preventDefault(); continueFromClue(); }
      else if (go && !solo() && !ui.revealed && !(ui.bonus && ui.wager === null)) { e.preventDefault(); ui.revealed = true; render(); }
      else if (e.key === 'Escape') {
        if (ui.resolved) continueFromClue();
        else if (!ui.bonus && !ui.revealed && !(G.played[ui.id] && G.played[ui.id].attempts.length)) { ui = { screen: 'board' }; render(); }   // nothing shown or recorded yet: put the clue back
      }
    } else if (ui.screen === 'final' && solo() && ui.step === 'clue' && /^[1-4]$/.test(e.key)) { e.preventDefault(); finalChoose(Number(e.key) - 1); }
  });

  // ---------- start ----------
  const s0 = saved();
  if (s0 && s0.phase === 'done') { G = s0; ui = { screen: 'end' }; }
  render();
  window.__game = { get state() { return G; }, get ui() { return ui; } };   // read-only peek for the test drivers
})();
