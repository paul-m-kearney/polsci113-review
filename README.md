# POLSCI 113 Review Game

A quiz-show review game for POLSCI 113, America in the World (Duke, Fall 2026). Thirty clues in six categories, one hidden bonus wager clue, and a final round. It runs in any browser with no install, no accounts, and no server.

## Ways to play

- **Solo review.** Pick a square and choose one of four answers. The game scores it and shows the answer, a short explanation, and the week and reading it comes from. Wrong answers cost nothing, except on a wager. At the end you get a list of what you missed.
- **Teams (two to four).** One shared screen, with a host at the keyboard. Choose 2, 3, or 4 teams and name them on the setup screen. The host reads the clue, marks teams right or wrong, and shows the answer. A wrong answer loses the clue's points (this can be switched off) and the other teams may try, until one is right or every team has missed. The team that answers correctly picks next.

Other rules:

- **Boards.** Boards 1 to 4 share no clues. "Random mix" draws one clue per square from all four.
- **Bonus wager.** One square in the 300 to 500 rows is a bonus clue. The player, or the team that picked it, bets from 100 up to their score, or up to 500 if they have less.
- **Final round.** One clue that ties several weeks together. Everyone wagers before seeing it (teams write the wager down; the host types it in afterward).
- **Keys.** Space shows the answer or continues, 1 to 4 pick a choice, Esc puts an untouched clue back.
- **Fixing a mistake.** In team play, "Edit scores" lets the host type the correct totals.
- A game in progress is saved in the browser, so a reload or a closed tab can be resumed on the same device.

## Files

| Path | What it is |
|---|---|
| `index.html`, `css/style.css` | The page and its styling |
| `js/logic.js` | The rules: boards, scoring, wagers, saving |
| `js/game.js` | The screens and controls |
| `js/bank.js` | The questions, generated from the bank (do not edit by hand) |
| `bank/question_bank.json` | The question bank, the single source of truth (125 questions) |
| `bank/build_bank_js.py` | Rebuilds `js/bank.js` from the bank |
| `bank/build_review_doc.py` | Rebuilds a readable Word and Markdown copy of the bank |
| `tests/` | Automatic checks |

## Changing a question

1. Edit `bank/question_bank.json`. In `choices`, the first entry is always the correct one; the game shuffles them.
2. Run `python3 bank/build_bank_js.py` (and `python3 bank/build_review_doc.py` for the readable copy; that one needs `python-docx`).
3. Run `node --test tests/*.test.js`.

Each question id ends in its board number (for example `SEC-300-2` is on Board 2), and each category needs four questions at each value.

## Running it on your own computer

Open `index.html` in a browser. Or, from this folder, run `python3 -m http.server 8766` and visit `http://127.0.0.1:8766`.

## Tests

- `node --test tests/*.test.js` checks the bank's structure and the rules (20 tests).
- `node tests/ui-drive.mjs <folder>` plays a full two-team game, a four-team game, and a full solo game in headless Chrome and saves screenshots. It needs the local server above on port 8766 and Chrome started with `--headless=new --remote-debugging-port=9334`.

## Putting it online with GitHub Pages

1. Create a new public repository on GitHub (for example `polsci113-review`).
2. From this folder: `git add -A`, `git commit -m "POLSCI 113 review game"`, `git branch -M main`, `git remote add origin https://github.com/<your-user>/polsci113-review.git`, `git push -u origin main`.
3. On GitHub: Settings, then Pages, then "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
4. After a minute or two the game is at `https://<your-user>.github.io/polsci113-review/`.

Things to know before publishing:

- The answers are in `js/bank.js`, which anyone can read in a public repository or in the browser. That is fine for a review game, but do not reuse these questions on a graded quiz.
- The site holds no student names or student data.

## Sources

The questions come from the weekly discussion decks for Weeks 1 to 14 (there is no material for Weeks 4 and 13). News quizzes, exams, and grade files were not used.
