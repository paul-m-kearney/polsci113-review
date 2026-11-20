// Plays the real site in headless Chrome through the DevTools protocol: one full two-team game at projector
// size, then one full solo game at phone size. Needs:
//   python3 -m http.server 8766            (in the project folder)
//   Chrome --headless=new --remote-debugging-port=9334
// Run: node tests/ui-drive.mjs <folder-for-screenshots>
import fs from 'node:fs';
const SHOTS = process.argv[2] || '.'; const BASE = 'http://127.0.0.1:8766/index.html'; const CDP = 'http://127.0.0.1:9334';
fs.mkdirSync(SHOTS, { recursive: true });
for (const o of await (await fetch(CDP + '/json/list')).json()) if (o.type === 'page' && o.url.includes('8766')) await fetch(CDP + '/json/close/' + o.id);
const t = await (await fetch(CDP + '/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pending = new Map(); const pageErrors = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') pageErrors.push(m.params.args.map(a => a.value || a.description).join(' ')); };
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error('page error: ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text) + '\n in: ' + expr.slice(0, 160)); return r.result.result.value; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async name => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${SHOTS}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
let fails = 0; const check = (name, cond, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond ? '' : '  ' + extra)); if (!cond) fails++; };
const KEYS = { ' ': ['Space', 32], Escape: ['Escape', 27], Enter: ['Enter', 13], 1: ['Digit1', 49], 2: ['Digit2', 50], 3: ['Digit3', 51], 4: ['Digit4', 52] };
const key = async k => { const [code, vk] = KEYS[k]; const p = { key: k, code, windowsVirtualKeyCode: vk, text: k.length === 1 ? k : k === 'Enter' ? '\r' : undefined };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p }); await sleep(60); };
const click = async sel => { const ok = await ev(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (!b) return false; b.click(); return true; })()`); await sleep(60); return ok; };
const text = sel => ev(`(document.querySelector(${JSON.stringify(sel)}) || {}).textContent || ''`);
const count = sel => ev(`document.querySelectorAll(${JSON.stringify(sel)}).length`);
const state = () => ev(`JSON.parse(JSON.stringify(window.__game.state))`);
const screen = () => ev(`document.body.dataset.screen`);
const noOverflow = async label => check(`no sideways scrolling: ${label}`, await ev(`document.documentElement.scrollWidth <= window.innerWidth + 1`), await ev(`document.documentElement.scrollWidth + ' > ' + window.innerWidth`));
const scores = async () => (await state()).players.map(p => p.score);
const fresh = async (w, h, mobile) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  await send('Page.navigate', { url: BASE }); await sleep(500); await ev(`localStorage.clear()`); await send('Page.reload', { ignoreCache: true }); await sleep(600); };

await send('Runtime.enable'); await send('Page.enable');

// ===================== A. two teams at projector size =====================
await fresh(1920, 1080, false);
check('setup screen shows first', (await screen()) === 'setup');
check('no resume banner on a clean start', (await count('.resume')) === 0);
await click('[data-act=mode][data-v=teams]');
check('team names appear in team mode', (await count('#name0')) === 1 && (await count('#optPenalty')) === 1);
await ev(`document.getElementById('name0').value = 'Realists'; document.getElementById('name1').value = 'Liberals';`);
await click('[data-act=board][data-v="1"]');
check('names survive choosing a board', (await ev(`document.getElementById('name0').value`)) === 'Realists');
check('Board 1 selected', (await ev(`document.querySelector('[data-act=board][data-v="1"]').getAttribute('aria-pressed')`)) === 'true');
await shot('01-setup-teams'); await noOverflow('setup');
await click('[data-act=start]');
check('board screen after start', (await screen()) === 'board');
check('6 categories and 30 open cells', (await count('.cat')) === 6 && (await count('.cell:not(.played)')) === 30);
check('both team chips at 0', (await ev(`[...document.querySelectorAll('.chip-score')].map(e => e.textContent).join()`)) === '0,0');
check('first team picks first', /Realists/.test(await text('.chip.picking')));
let s = await state();
check('fixed board 1 loaded', Object.values(s.board.cells.PAR).every(x => x.endsWith('-1')) && s.board.finalId === 'FIN-1');
await shot('02-board-teams'); await noOverflow('board');

// a plain clue: wrong, then the other team right
const plain = (st, n = 0) => Object.values(st.board.cells).flatMap(c => Object.values(c)).filter(x => x !== st.board.bonusId && !(st.played[x] && st.played[x].done))[n];
let cid = plain(s);
const bank = await ev(`window.BANK.items.map(i => ({ id: i.id, value: i.value, clue: i.clue, answer: i.answer }))`);
const B = Object.fromEntries(bank.map(i => [i.id, i]));
await click(`[data-id="${cid}"]`);
check('clue screen opens with the clue text', (await screen()) === 'clue' && (await text('.clue-text')) === B[cid].clue);
check('answer is hidden at first', (await count('.answer')) === 0);
await shot('03-clue-teams-hidden');
await click('[data-act=mark][data-p="0"][data-c="0"]');
check('wrong answer subtracts and keeps the clue open', (await scores())[0] === -B[cid].value && (await count('[data-act=mark]')) === 2 && (await count('.answer')) === 0);
await key(' ');
check('Space shows the answer', (await text('.answer-text')) === B[cid].answer);
await click('[data-act=mark][data-p="1"][data-c="1"]');
check('right answer adds and resolves the clue', (await scores())[1] === B[cid].value && (await count('[data-act=continue]')) === 1 && (await count('[data-act=mark]')) === 0);
await shot('04-clue-teams-answer'); await noOverflow('clue with answer');
await key(' ');
check('Space returns to the board', (await screen()) === 'board');
check('cell is now played and disabled', await ev(`document.querySelector('[data-id="${cid}"]').disabled`) && (await count('.cell.played')) === 1);
check('the team that was right picks next', /Liberals/.test(await text('.chip.picking')));

// Esc puts an untouched clue back
s = await state(); cid = plain(s);
await click(`[data-id="${cid}"]`); await key('Escape');
check('Esc on an untouched clue puts it back', (await screen()) === 'board' && !(await ev(`document.querySelector('[data-id="${cid}"]').disabled`)));
// no one got it
await click(`[data-id="${cid}"]`); const before = await scores(); await click('[data-act=noone]');
check('"No one got it" shows the answer and changes no score', (await count('.answer')) === 1 && JSON.stringify(await scores()) === JSON.stringify(before));
await click('[data-act=continue]');

// bonus wager clue
s = await state(); const bonus = s.board.bonusId;
check('a bonus clue is hidden in the 300 to 500 rows', !!bonus && B[bonus].value >= 300);
await click(`[data-id="${bonus}"]`);
check('bonus clue asks the picking team for a wager first', (await count('.wager input')) === 1 && (await count('.clue-text')) === 0 && /Liberals/.test(await text('.clue-note')));
check('wager limit is 500 when the team has less', (await ev(`document.querySelector('.wager input').max`)) === '500');
await shot('05-bonus-wager');
await ev(`(() => { const i = document.querySelector('.wager input'); i.value = '400'; i.form.requestSubmit(); })()`); await sleep(80);
check('only the wagering team can be marked on a bonus clue', (await count('[data-act=mark]')) === 2 && (await count('[data-act=noone]')) === 0 && (await count('.mark')) === 1);
const b4 = (await scores())[1]; await click('[data-act=mark][data-c="1"]');
check('bonus wager is added', (await scores())[1] === b4 + 400);
await click('[data-act=continue]');

// edit scores, then reload and resume
await click('[data-act=scores]');
check('edit scores dialog opens', await ev(`document.getElementById('dlg').open`));
await ev(`(() => { document.getElementById('sc0').value = '300'; const f = document.querySelector('#dlg form'); f.requestSubmit(f.querySelector('button[value=ok]')); })()`); await sleep(120);
check('edited score is saved', (await scores())[0] === 300 && /300/.test(await text('.chip.team0 .chip-score')));
const snap = JSON.stringify(await state());
await send('Page.reload', { ignoreCache: true }); await sleep(600);
check('after a reload the setup screen offers to resume', (await screen()) === 'setup' && (await count('[data-act=resume]')) === 1);
await click('[data-act=resume]');
check('resume restores the same game', (await screen()) === 'board' && JSON.stringify(await state()) === snap && (await count('.cell.played')) === 3);

// clear the board
for (let n = 0; n < 40; n++) { s = await state(); cid = plain(s); if (!cid) break; await click(`[data-id="${cid}"]`); await click(`[data-act=mark][data-p="${n % 2}"][data-c="1"]`); await key('Enter'); }
check('board cleared: banner offers the final round', (await count('.cell:not(.played)')) === 0 && (await count('.banner [data-act=final]')) === 1);
await shot('06-board-cleared');
await click('.banner [data-act=final]');
check('final round opens without a confirm when the board is done', (await screen()) === 'final' && !(await ev(`document.getElementById('dlg').open`)));
check('final intro shows each team its wager limit', (await count('.mark')) === 2);
await shot('07-final-intro');
await click('[data-act=fclue]');
check('final clue shown, answer hidden', (await text('.clue-text')) === B['FIN-1'].clue && (await count('.answer')) === 0);
await click('[data-act=fanswer]');
check('final answer and scoring form shown', (await text('.answer-text')) === B['FIN-1'].answer && (await count('.final-form fieldset')) === 2);
const pre = await scores();
await ev(`(() => { const f = document.querySelector('.final-form'); f.w0.value = '200'; f.w1.value = '999999'; f.querySelector('[name=c0][value="1"]').checked = true; f.querySelector('[name=c1][value="0"]').checked = true; })()`);
await shot('08-final-scoring'); await noOverflow('final scoring');
await ev(`document.querySelector('.final-form').requestSubmit()`); await sleep(120);
check('a wager above the team limit is refused by the form', (await screen()) === 'final' && JSON.stringify(await scores()) === JSON.stringify(pre));
await ev(`(() => { const f = document.querySelector('.final-form'); f.w1.value = '1000'; f.requestSubmit(); })()`); await sleep(120);
const post = await scores();
check('final wagers applied: right adds, wrong subtracts', post[0] === pre[0] + 200 && post[1] === pre[1] - 1000, JSON.stringify([pre, post]));
check('end screen names the winner', (await screen()) === 'end' && (await text('.end h1')) === 'Winner: ' + (post[0] > post[1] ? 'Realists' : 'Liberals'));
check('end screen lists the clue nobody got', (await count('.review li')) === 1);
await shot('09-end-teams'); await noOverflow('end');
await send('Page.reload', { ignoreCache: true }); await sleep(500);
check('a finished game reopens on its results', (await screen()) === 'end');

// ===================== B. solo at phone size =====================
await fresh(390, 844, true);
check('[phone] setup, solo is the default', (await ev(`document.querySelector('[data-act=mode][data-v=solo]').getAttribute('aria-pressed')`)) === 'true' && (await count('#name0')) === 0 && (await count('#optPenalty')) === 0);
await shot('10-phone-setup'); await noOverflow('phone setup');
await click('[data-act=board][data-v=random]'); await click('[data-act=start]');
s = await state();
check('[phone] solo game with one player', s.mode === 'solo' && s.players.length === 1 && (await count('.cell')) === 30);
await shot('11-phone-board'); await noOverflow('phone board');
const correctIndex = idv => ev(`window.Logic.choiceOrder(window.__game.state, window.Logic.itemOf(window.BANK, ${JSON.stringify(idv)})).findIndex(c => c.correct)`);
cid = plain(s); await click(`[data-id="${cid}"]`);
check('[phone] four choices, no answer shown', (await count('.choice')) === 4 && (await count('.answer')) === 0);
await shot('12-phone-clue'); await noOverflow('phone clue');
let ci = await correctIndex(cid); await key(String(ci + 1));
check('[phone] number key picks the right choice and scores it', (await scores())[0] === B[cid].value && (await count('.choice.right')) === 1 && (await count('.choice.wrong')) === 0 && /Correct/.test(await text('.verdict')));
check('[phone] answer and explanation shown', (await text('.answer-text')) === B[cid].answer && (await text('.answer-why')).length > 10);
await shot('13-phone-correct'); await noOverflow('phone answered');
await click('[data-act=continue]');
check('[phone] played cell shows a tick', (await text(`[data-id="${cid}"]`)).trim() === '✓');
s = await state(); cid = plain(s); await click(`[data-id="${cid}"]`); ci = await correctIndex(cid);
const sc = (await scores())[0]; await click(`[data-act=choose][data-i="${(ci + 1) % 4}"]`);
check('[phone] wrong choice costs nothing and is marked', (await scores())[0] === sc && (await count('.choice.wrong')) === 1 && (await count('.choice.right')) === 1 && /Not quite/.test(await text('.verdict')));
await shot('14-phone-wrong'); await click('[data-act=continue]');
check('[phone] played cell shows a cross', (await text(`[data-id="${cid}"]`)).trim() === '✗');
s = await state();
await click(`[data-id="${s.board.bonusId}"]`);
check('[phone] bonus clue asks for a wager', (await count('.wager input')) === 1);
await ev(`(() => { const i = document.querySelector('.wager input'); i.value = '300'; i.form.requestSubmit(); })()`); await sleep(80);
ci = await correctIndex(s.board.bonusId); const sb = (await scores())[0]; await click(`[data-act=choose][data-i="${(ci + 2) % 4}"]`);
check('[phone] a lost wager is subtracted even in solo', (await scores())[0] === sb - 300);
await click('[data-act=continue]');
await click('[data-act=final]');
check('[phone] skipping to the final asks first', await ev(`document.getElementById('dlg').open`));
await shot('15-phone-confirm');
await ev(`(() => { const f = document.querySelector('#dlg form'); f.requestSubmit(f.querySelector('button[value=cancel]')); })()`); await sleep(120);
check('[phone] cancel keeps the board', (await screen()) === 'board');
await click('[data-act=final]'); await ev(`(() => { const f = document.querySelector('#dlg form'); f.requestSubmit(f.querySelector('button[value=ok]')); })()`); await sleep(150);
check('[phone] final round opens with a wager', (await screen()) === 'final' && (await count('.wager input')) === 1);
await ev(`(() => { const i = document.querySelector('.wager input'); i.value = '100'; i.form.requestSubmit(); })()`); await sleep(80);
s = await state(); ci = await correctIndex(s.board.finalId); const sf = (await scores())[0];
await shot('16-phone-final'); await noOverflow('phone final');
await click(`[data-act=fchoose][data-i="${ci}"]`);
check('[phone] final wager won', (await scores())[0] === sf + 100 && /Correct/.test(await text('.verdict')));
await click('[data-act=results]');
check('[phone] results with a review list of missed clues', (await screen()) === 'end' && /You scored/.test(await text('.end h1')) && (await count('.review li')) === 2);
await shot('17-phone-end'); await noOverflow('phone end');
await click('[data-act=again]');
check('[phone] play again starts a new solo game', (await screen()) === 'board' && (await scores())[0] === 0 && (await count('.cell.played')) === 0);

// ===================== C. solo on a laptop, for the screenshot =====================
await fresh(1366, 768, false);
await click('[data-act=start]'); s = await state(); await noOverflow('laptop board'); await shot('18-laptop-board');
const longest = Object.values(s.board.cells).flatMap(c => Object.values(c)).filter(x => x !== s.board.bonusId).sort((a, b) => B[b].clue.length - B[a].clue.length)[0];
await click(`[data-id="${longest}"]`); await shot('19-laptop-clue-longest');
check('[laptop] longest clue fits without sideways scrolling', await ev(`document.documentElement.scrollWidth <= window.innerWidth + 1`));
await key('1'); await sleep(150); await shot('20-laptop-answered');
check('[laptop] after answering, the Continue button is on screen', await ev(`(() => { const r = document.querySelector('[data-act=continue]').getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; })()`));
check('[laptop] tick and cross badges are drawn in the choices', /[\u2713]/.test(await ev(`[...document.querySelectorAll('.choice.right .choice-key')].map(e => e.textContent).join('')`)));

check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
ws.close(); process.exit(fails ? 1 : 0);
