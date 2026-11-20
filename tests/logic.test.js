// Rule tests for js/logic.js. Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../js/logic.js');
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bank', 'question_bank.json'), 'utf8'));
const game = (o = {}) => L.newGame(bank, Object.assign({ mode: 'teams', names: ['Blue', 'Orange'], board: 1, bonus: true, penalty: true, seed: 7 }, o));
const firstId = (s, cat, v) => s.board.cells[cat][v];
const plainId = s => L.boardIds(s.board).find(id => id !== s.board.bonusId);

test('js/bank.js is in step with the bank', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'js', 'bank.js'), 'utf8');
  const built = JSON.parse(js.slice(js.indexOf('window.BANK=') + 12, js.lastIndexOf(';')).replace(/<\\\//g, '</'));
  assert.deepStrictEqual(built.items, bank.items);
  assert.deepStrictEqual(built.categories, bank.categories);
});
test('fixed boards 1 to 4 fill every cell and share no clues', () => {
  const seen = new Set();
  for (const b of [1, 2, 3, 4]) {
    const ids = L.boardIds(game({ board: b }).board);
    assert.strictEqual(ids.length, 30);
    for (const id of ids) { assert.ok(id.endsWith('-' + b)); assert.ok(!seen.has(id)); seen.add(id); }
  }
  assert.strictEqual(seen.size, 120);
  assert.deepStrictEqual([1, 2, 3, 4].map(b => game({ board: b }).board.finalId), ['FIN-1', 'FIN-2', 'FIN-3', 'FIN-4']);
});
test('random board: one clue per cell with the right category and value, mixed across boards', () => {
  let mixed = false;
  for (let seed = 1; seed <= 25; seed++) {
    const s = game({ board: 'random', seed });
    for (const c of bank.categories) for (const v of bank.values) {
      const it = L.itemOf(bank, s.board.cells[c.key][v]);
      assert.strictEqual(it.cat, c.key); assert.strictEqual(it.value, v);
    }
    assert.strictEqual(new Set(L.boardIds(s.board)).size, 30);
    assert.strictEqual(L.itemOf(bank, s.board.finalId).cat, 'FINAL');
    if (new Set(L.boardIds(s.board).map(id => id.slice(-1))).size > 1) mixed = true;
  }
  assert.ok(mixed);
});
test('bonus clue: one per board, never in the 100 or 200 row, absent when switched off', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = game({ board: 'random', seed });
    assert.ok(L.boardIds(s.board).includes(s.board.bonusId));
    assert.ok(L.itemOf(bank, s.board.bonusId).value >= 300);
  }
  assert.strictEqual(game({ bonus: false }).board.bonusId, null);
});
test('same seed gives the same game; choice order is stable, complete, and has one correct choice', () => {
  assert.deepStrictEqual(game({ board: 'random', seed: 99 }).board, game({ board: 'random', seed: 99 }).board);
  const s = game(); const positions = new Set();
  for (const it of bank.items) {
    const o = L.choiceOrder(s, it);
    assert.deepStrictEqual(o, L.choiceOrder(s, it));
    assert.strictEqual(o.filter(c => c.correct).length, 1);
    assert.strictEqual(o.find(c => c.correct).text, it.choices[0]);
    assert.deepStrictEqual(o.map(c => c.text).sort(), it.choices.slice().sort());
    positions.add(o.findIndex(c => c.correct));
  }
  assert.strictEqual(positions.size, 4, 'the correct choice should land in every position somewhere in the bank');
});
test('team scoring: right adds, wrong subtracts when the penalty is on, and the right team picks next', () => {
  const s = game(); const id = plainId(s); const v = L.itemOf(bank, id).value;
  assert.strictEqual(L.markAttempt(s, bank, id, 0, false), -v);
  assert.strictEqual(L.markAttempt(s, bank, id, 0, true), 0, 'a team cannot answer the same clue twice');
  assert.strictEqual(L.markAttempt(s, bank, id, 1, true), v);
  assert.deepStrictEqual(s.players.map(p => p.score), [-v, v]);
  assert.strictEqual(s.turn, 1);
  L.closeClue(s, id);
  assert.ok(L.isPlayed(s, id));
  assert.strictEqual(L.markAttempt(s, bank, id, 0, true), 0, 'a closed clue cannot be scored again');
  assert.strictEqual(L.remaining(s), 29);
});
test('no penalty: wrong answers cost nothing for teams when switched off, and never in solo play', () => {
  const t = game({ penalty: false }); const id = plainId(t);
  assert.strictEqual(L.markAttempt(t, bank, id, 0, false), 0);
  assert.strictEqual(t.players[0].wrong, 1);
  const s = game({ mode: 'solo', penalty: true });
  assert.strictEqual(s.players.length, 1); assert.strictEqual(s.settings.penalty, false);
  assert.strictEqual(L.markAttempt(s, bank, plainId(s), 0, false), 0);
  assert.strictEqual(s.players[0].score, 0);
});
test('wagers: limits, clamping, and a wager is always at risk', () => {
  assert.deepStrictEqual(L.wagerLimits(0, 'bonus'), { min: 100, max: 500 });
  assert.deepStrictEqual(L.wagerLimits(-300, 'bonus'), { min: 100, max: 500 });
  assert.deepStrictEqual(L.wagerLimits(1800, 'bonus'), { min: 100, max: 1800 });
  assert.deepStrictEqual(L.wagerLimits(1800, 'final'), { min: 0, max: 1800 });
  assert.strictEqual(L.clampWager('99999', L.wagerLimits(1200, 'bonus')), 1200);
  assert.strictEqual(L.clampWager('-5', L.wagerLimits(1200, 'bonus')), 100);
  assert.strictEqual(L.clampWager('abc', L.wagerLimits(1200, 'final')), 0);
  const s = game({ mode: 'solo' }); s.players[0].score = 900;
  assert.strictEqual(L.markAttempt(s, bank, s.board.bonusId, 0, false, 5000), -900, 'solo still loses a wager, capped at the score');
  const t = game({ penalty: false }); t.players[1].score = 200;
  assert.strictEqual(L.markAttempt(t, bank, t.board.bonusId, 1, true, 400), 400);
  assert.strictEqual(t.players[1].score, 600);
});
test('a full game: board, final round, winner, and the missed list', () => {
  const s = game({ bonus: false }); const ids = L.boardIds(s.board);
  ids.forEach((id, n) => { if (n % 3 === 0) L.markAttempt(s, bank, id, n % 2, true); else if (n % 3 === 1) L.markAttempt(s, bank, id, 0, false); L.closeClue(s, id); });
  assert.ok(L.isBoardDone(s));
  assert.strictEqual(L.missed(s, bank).length, 20);
  assert.strictEqual(L.markFinal(s, 0, 100, true), 0, 'no final scoring before the final round starts');
  L.startFinal(s);
  const before = s.players.map(p => p.score);
  assert.strictEqual(L.markFinal(s, 0, 99999, false), -Math.max(before[0], 500));
  assert.strictEqual(L.markFinal(s, 0, 100, true), 0, 'one final answer per team');
  assert.strictEqual(L.markFinal(s, 1, 300, true), 300);
  L.finish(s);
  assert.strictEqual(s.phase, 'done');
  assert.deepStrictEqual(L.leaders(s), [1]);
  assert.strictEqual(L.missed(s, bank).length, 20, 'the final was answered correctly by one team');
  const tie = game(); assert.deepStrictEqual(L.leaders(tie), [0, 1]);
});
test('edit scores and restore a saved game; reject damaged or stale saves', () => {
  const s = game(); L.setScore(s, 0, '750'); L.setScore(s, 1, 'x');
  assert.deepStrictEqual(s.players.map(p => p.score), [750, 0]);
  const back = L.restore(JSON.stringify(s), bank);
  assert.deepStrictEqual(back, s);
  assert.strictEqual(L.restore('not json', bank), null);
  assert.strictEqual(L.restore(null, bank), null);
  assert.strictEqual(L.restore(JSON.stringify(Object.assign({}, s, { v: 0 })), bank), null);
  const stale = JSON.parse(JSON.stringify(s)); stale.board.cells.PAR[100] = 'PAR-100-9';
  assert.strictEqual(L.restore(stale, bank), null);
});
