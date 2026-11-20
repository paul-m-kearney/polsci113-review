// Game rules for the POLSCI 113 review game. Pure functions, no DOM: used by js/game.js in the browser
// and by tests/logic.test.js in Node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Logic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VERSION = 1;
  const BONUS_MIN_VALUE = 300;      // the bonus wager clue never hides in the 100 or 200 row
  const WAGER_FLOOR = 500;          // a player with less than this may still wager up to this much

  // Small seeded generator (mulberry32) so boards and choice order can be reproduced in tests.
  function rngFrom(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const itemOf = (bank, id) => bank.items.find(i => i.id === id) || null;

  // choice: 1..4 for a fixed board, or 'random' for one item drawn per cell.
  function buildBoard(bank, choice, rng, opts) {
    const cells = {};
    for (const c of bank.categories) {
      cells[c.key] = {};
      for (const v of bank.values) {
        const pool = bank.items.filter(i => i.cat === c.key && i.value === v).sort(byId);
        const item = choice === 'random' ? pick(pool, rng) : pool.find(i => i.id.endsWith('-' + choice));
        if (!item) throw new Error('no item for ' + c.key + ' ' + v + ' board ' + choice);
        cells[c.key][v] = item.id;
      }
    }
    const finals = bank.items.filter(i => i.cat === 'FINAL').sort(byId);
    const finalId = choice === 'random' ? pick(finals, rng).id : finals[(choice - 1) % finals.length].id;
    let bonusId = null;
    if (opts && opts.bonus) {
      const cand = [];
      for (const c of bank.categories) for (const v of bank.values) if (v >= BONUS_MIN_VALUE) cand.push(cells[c.key][v]);
      bonusId = pick(cand, rng);
    }
    return { choice, cells, finalId, bonusId };
  }
  function boardIds(board) {
    const out = [];
    for (const c of Object.keys(board.cells)) for (const v of Object.keys(board.cells[c])) out.push(board.cells[c][v]);
    return out;
  }

  // opts: { mode: 'solo' | 'teams', names: [..], board: 1..4 | 'random', bonus: bool, penalty: bool, seed: int }
  function newGame(bank, opts) {
    const seed = (opts.seed === undefined ? Math.floor(Math.random() * 2 ** 31) : opts.seed) >>> 0;
    const rng = rngFrom(seed);
    const mode = opts.mode === 'teams' ? 'teams' : 'solo';
    const names = mode === 'teams' ? [opts.names && opts.names[0] || 'Team A', opts.names && opts.names[1] || 'Team B'] : ['You'];
    return {
      v: VERSION, seed, mode,
      players: names.map(n => ({ name: String(n).slice(0, 24), score: 0, right: 0, wrong: 0 })),
      settings: { bonus: !!opts.bonus, penalty: mode === 'teams' && !!opts.penalty },
      board: buildBoard(bank, opts.board, rng, { bonus: !!opts.bonus }),
      played: {},            // id -> { done: bool, attempts: [{ p, correct, delta }] }
      turn: 0,               // teams: whose pick it is
      phase: 'board',        // 'board' | 'final' | 'done'
      final: null,           // { attempts: [{ p, wager, correct, delta }] }
    };
  }

  // Order of the four choices for one clue: stable for a given game, different between games.
  function choiceOrder(state, item) {
    let h = state.seed;
    for (const ch of item.id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    return shuffle(item.choices.map((text, i) => ({ text, correct: i === 0 })), rngFrom(h));
  }

  function wagerLimits(score, kind) {
    const max = Math.max(score, WAGER_FLOOR);
    return { min: kind === 'bonus' ? 100 : 0, max };
  }
  function clampWager(w, lim) {
    w = Math.round(Number(w));
    if (!Number.isFinite(w)) w = lim.min;
    return Math.min(lim.max, Math.max(lim.min, w));
  }

  const entry = (state, id) => state.played[id] || (state.played[id] = { done: false, attempts: [] });
  const isPlayed = (state, id) => !!(state.played[id] && state.played[id].done);
  const hasAttempted = (state, id, p) => !!(state.played[id] && state.played[id].attempts.some(a => a.p === p));

  // Record one player's attempt at a board clue. `wager` is set for the bonus clue only.
  // Solo play never loses points on an ordinary clue; a wager is always at risk.
  function markAttempt(state, bank, id, p, correct, wager) {
    const item = itemOf(bank, id);
    if (!item || isPlayed(state, id) || hasAttempted(state, id, p)) return 0;
    const wagered = wager !== undefined && wager !== null;
    const amount = wagered ? clampWager(wager, wagerLimits(state.players[p].score, 'bonus')) : item.value;
    let delta = 0;
    if (correct) delta = amount;
    else if (wagered || state.settings.penalty) delta = -amount;
    const pl = state.players[p];
    pl.score += delta; if (correct) pl.right++; else pl.wrong++;
    entry(state, id).attempts.push({ p, correct: !!correct, delta });
    if (correct) state.turn = p;
    return delta;
  }
  function closeClue(state, id) { entry(state, id).done = true; }
  const remaining = state => boardIds(state.board).filter(id => !isPlayed(state, id)).length;
  const isBoardDone = state => remaining(state) === 0;

  function startFinal(state) { if (state.phase === 'board') { state.phase = 'final'; state.final = { attempts: [] }; } }
  function markFinal(state, p, wager, correct) {
    if (state.phase !== 'final' || state.final.attempts.some(a => a.p === p)) return 0;
    const w = clampWager(wager, wagerLimits(state.players[p].score, 'final'));
    const delta = correct ? w : -w;
    const pl = state.players[p];
    pl.score += delta; if (correct) pl.right++; else pl.wrong++;
    state.final.attempts.push({ p, wager: w, correct: !!correct, delta });
    return delta;
  }
  function finish(state) { state.phase = 'done'; }

  function leaders(state) {
    const top = Math.max(...state.players.map(p => p.score));
    return state.players.map((p, i) => (p.score === top ? i : -1)).filter(i => i >= 0);
  }
  // Clues nobody answered correctly (plus the final, if missed), for the review list.
  function missed(state, bank) {
    const out = [];
    for (const id of boardIds(state.board)) {
      const e = state.played[id];
      if (e && e.done && !e.attempts.some(a => a.correct)) out.push(itemOf(bank, id));
    }
    if (state.final && state.final.attempts.length && !state.final.attempts.some(a => a.correct)) out.push(itemOf(bank, state.board.finalId));
    return out.filter(Boolean);
  }
  function setScore(state, p, score) {
    const n = Math.round(Number(score));
    if (Number.isFinite(n) && state.players[p]) state.players[p].score = n;
  }

  // Returns a saved game if it is usable with this bank, otherwise null.
  function restore(raw, bank) {
    let s;
    try { s = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { return null; }
    if (!s || s.v !== VERSION || !s.board || !Array.isArray(s.players) || !s.players.length) return null;
    if (!['board', 'final', 'done'].includes(s.phase)) return null;
    const ids = new Set(bank.items.map(i => i.id));
    let cellIds;
    try { cellIds = boardIds(s.board); } catch (e) { return null; }
    if (cellIds.length !== bank.categories.length * bank.values.length) return null;
    if (!cellIds.every(id => ids.has(id)) || !ids.has(s.board.finalId)) return null;
    if (s.board.bonusId && !ids.has(s.board.bonusId)) return null;
    if (!s.played || typeof s.played !== 'object') return null;
    return s;
  }

  return { VERSION, WAGER_FLOOR, rngFrom, shuffle, itemOf, buildBoard, boardIds, newGame, choiceOrder, wagerLimits,
    clampWager, isPlayed, hasAttempted, markAttempt, closeClue, remaining, isBoardDone, startFinal, markFinal, finish,
    leaders, missed, setScore, restore };
});
