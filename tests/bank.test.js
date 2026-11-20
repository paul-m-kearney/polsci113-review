// Structural checks on the question bank. Run: node --test tests/bank.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const bank = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'bank', 'question_bank.json'), 'utf8'));
const items = bank.items;
const cats = bank.categories.map(c => c.key);
const board = items.filter(i => i.cat !== 'FINAL');
const finals = items.filter(i => i.cat === 'FINAL');

test('125 items: 120 board + 5 final', () => {
  assert.strictEqual(items.length, 125);
  assert.strictEqual(board.length, 120);
  assert.strictEqual(finals.length, 5);
});
test('six categories, five values, four items per cell', () => {
  assert.strictEqual(cats.length, 6);
  for (const c of cats) for (const v of bank.values) {
    const n = board.filter(i => i.cat === c && i.value === v).length;
    assert.strictEqual(n, 4, `${c}-${v} has ${n}`);
  }
});
test('ids are unique and match category, value and slot', () => {
  assert.strictEqual(new Set(items.map(i => i.id)).size, items.length);
  for (const i of board) assert.match(i.id, new RegExp(`^${i.cat}-${i.value}-[1-4]$`));
  for (const i of finals) assert.match(i.id, /^FIN-[1-5]$/);
});
test('every item has all fields, four unique choices, and a week with material', () => {
  const weeks = new Set([1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14]);
  for (const i of items) {
    for (const f of ['clue', 'answer', 'explain', 'reading', 'slide']) assert.ok(typeof i[f] === 'string' && i[f].trim().length > 2, `${i.id} ${f}`);
    assert.ok(Array.isArray(i.choices) && i.choices.length === 4, `${i.id} choices`);
    assert.strictEqual(new Set(i.choices.map(c => c.trim().toLowerCase())).size, 4, `${i.id} duplicate choices`);
    assert.ok(weeks.has(i.week), `${i.id} week ${i.week}`);
  }
});
test('no duplicate clues', () => {
  assert.strictEqual(new Set(items.map(i => i.clue.trim().toLowerCase())).size, items.length);
});
test('style: no em dashes in player-facing text; en dashes only in numeric ranges', () => {
  for (const i of items) {
    const txt = [i.clue, i.answer, i.explain, i.slide, i.reading, ...i.choices].join(' ');
    assert.ok(!txt.includes('—'), `${i.id} has an em dash`);
    assert.ok(!/[A-Za-z]–|–[A-Za-z]/.test(txt), `${i.id} en dash outside a numeric range`);
  }
});
test('no "all of the above" style choices', () => {
  for (const i of items) for (const c of i.choices) assert.ok(!/all of the above|none of the above|both a and b/i.test(c), i.id);
});
