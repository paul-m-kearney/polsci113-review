# Plan: POLSCI 113 review game ("Jeopardy"-style), 125-question bank

**Status:** APPROVED 2026-11-20. Step 1 (bank) and step 2 (game) built and tested 2026-11-20. Remaining: commit, push to GitHub, turn on Pages (waits for Paul).

## Context
Paul wants an end-of-term review game for POLSCI 113 (America in the World). It has to work in two ways: one student reviewing alone, and two teams competing in class on one projected screen. It will be hosted free on GitHub Pages, the same way as his FamilyChores site.

The material comes from the 14 weeks in `/Volumes/MicroSD/Duke/TA Folder`. There is no material for Weeks 4 and 13.

Paul's decisions:
- **Solo mode:** multiple choice, scored automatically.
- **Team mode:** one shared screen; the host marks who answered and whether it was right.
- **Hosting:** GitHub Pages.
- **Order of work:** the question bank comes first, as a readable document for Paul to review. The game is built only after he approves the bank.

## Sources (all read-only)
1. **Primary: the deck build scripts**, `TA Folder/build_week{1,2,3,5,6,7,8,9,10,11,12,14}_deck.py`. Their slide text and speaker notes were already fact-checked, and they record the corrections made to the outlines. Use the corrected facts, never the outline errors. Examples:
   - Waltz: war becomes less likely as deterrent capabilities *increase*.
   - Mearsheimer: a nuclear-free Europe is his *most dangerous* case, not his prescription.
2. **Secondary:**
   - the Week outlines and notes (`.docx`);
   - the Week 11 reading notes;
   - `make_week14_timeline.py` (corrected Iraq and Afghanistan dates);
   - `Week1_Icebreaker_Questions_1-50.md`.
3. **Excluded:**
   - the NYT news quizzes, which are current events rather than course concepts;
   - grade sheets and reports;
   - midterm exam files, so no exam items are copied;
   - `high.pdf` and `mid.pdf`.

## Categories → weeks (6 categories)
| Category | Weeks and readings |
|---|---|
| Paradigms of International Relations | W1 Waltz's anarchy, realism vs. liberalism; W2 Nye & Welch, Krasner's sovereignties, Keck & Sikkink, Mearsheimer; W3 Art on fungibility, Nye on soft power; W12 Fukuyama and Huntington as paradigm applications |
| International Regimes | W7 Frankel, Rodrik, Martin & Simmons, GATT/WTO; W9 Johns, Simmons, Keohane, Raustiala & Jeronimo, the UN Charter; W12 the NPT and Sagan's consensus findings |
| Economic Tools | W6 Gilpin's three conceptions, Rodrik's trilemma; W10 Haass & O'Sullivan, Feaver & Lorber, Farrell & Newman (weaponized interdependence) |
| The Security Dilemma | W5 Jervis's four worlds, Walt's balance of threat, Fearon's bargaining (information and commitment problems), Lake; W1 anarchy |
| Nuclear Revolution | W11 deterrence, balance of terror, Cuban Missile Crisis, just war and deterrence; W12 Waltz vs. proliferation worries, preventive vs. pre-emptive war, Sagan on supply and demand |
| Grab Bag | W3 nationalism (Lind, Lieven & McDougall, Etzioni); W8 morality (Thucydides, Carr, Hafner-Burton, Nye's three views); W11 Cold War history; W12 Mearsheimer, Fukuyama and Huntington; W14 Iraq, Afghanistan, Chenoweth, Walter, Crenshaw/Cronin |

## Bank structure (125 items)
- **Board items:** 6 categories × 5 point values (100–500) × 4 items each = 120. This yields four complete, non-overlapping boards; "random board" picks one item per cell.
- **Final round:** 5 cross-category synthesis items, used for Final Jeopardy.
- **Difficulty by value:**
  - 100: a term or definition;
  - 200: matching a scholar to an argument;
  - 300: applying a concept to a case;
  - 400: comparing or distinguishing two ideas;
  - 500: the tricky distinctions students most often mix up.
- **Fields for each item:**
  - `id`, `category`, `value`, `week`, `source` (reading and slide);
  - `clue`, the open-ended prompt for team play;
  - `answer`, a short canonical answer for the host;
  - `choices`, four options for solo play (the answer plus 3 plausible distractors from the same week, no "all of the above");
  - `explain`, a 1–2 sentence explanation shown after answering.
- **Style rules:**
  - no em dashes;
  - clues are written as questions; Jeopardy's "answer in the form of a question" is not enforced;
  - nothing is stated beyond what the course materials support.

## Step 1: Draft and review the bank (this approval)
1. Write the bank as `question_bank.json`, the single source of truth.
2. Build a review document, `POLSCI113_Review_Bank.md` and a `.docx` copy, grouped by category and value. Each item shows its clue, answer, choices, explanation and source, so Paul can edit it in Word.
3. **Independent accuracy check.** One subagent, which never sees my reasoning, checks every item against the cited build script or outline. It reports items that are:
   - unsupported or wrong;
   - ambiguous, with more than one defensible answer;
   - weak, because a distractor is also correct or obviously silly.

   I fix what it flags, then report the remaining doubts to Paul.
4. Run automatic checks:
   - exactly 125 items;
   - 4 per category and value cell;
   - 5 final items;
   - unique ids;
   - the answer appears among the choices exactly once;
   - no duplicate clues;
   - no em dashes.
5. Show Paul a short on-screen summary with counts and flagged items, and the paths to the review files. **Stop for his edits and approval.**

## Step 2: Build the game (after the bank is approved)
**Folder:** `/Users/x95281/PolSci113-Review/`, on the native disk, a git repo set up for GitHub Pages like FamilyChores. It is plain HTML, CSS and JS with no build step and no backend.

**Files:**
- `index.html`;
- `css/style.css`;
- `js/bank.js`, generated from `question_bank.json` as `window.BANK=…` so the game also opens from a local file;
- `js/game.js`;
- `README.md` with deploy steps;
- `tests/`.

**Setup screen:**
- Mode: Solo or Two Teams, with editable team names.
- Board: Board 1–4 or Random.
- Toggles: Daily Doubles on or off; subtract points for wrong answers in team mode.

**Board:** a 6 × 5 grid. Played cells grey out. Scores are always visible.

**Clue view:**
- **Team mode:** a large clue. The host clicks "Show answer," then marks Team A ✓/✗, Team B ✓/✗, or No one.
- **Solo mode:** four choice buttons. The game shows right or wrong, the explanation and the source week, and scores automatically.

**Daily Double:** one per board. The player wagers up to their score, or up to 500 if their score is lower.

**Final Jeopardy:**
- **Team mode:** each team enters its wager and the host marks each answer.
- **Solo mode:** the player wagers, then answers as multiple choice.

**End screen:** the winner. In solo mode it also shows a "Review what you missed" list with explanations and source weeks.

**Usability:**
- Saves the game in progress to localStorage, wrapped in try/catch.
- Keyboard shortcuts for projecting: Space reveals the answer, 1–4 pick a choice, Esc goes back to the board.
- Large type and high contrast that read well from the back of a classroom.
- The team view works on a laptop or projector, and the solo view works on a phone.
- Duke blue and orange to match the decks.

**Content limits:** no student names and no student data, so a public repo is fine under FERPA.

## Verification
- **Bank checks:** the step 1 automatic checks run under `node --test tests/bank.test.js`.
- **Logic unit tests** (`node --test`):
  - scoring, including subtraction for wrong answers;
  - Daily Double wager limits;
  - Final Jeopardy wagers;
  - random board selection, one item per cell with no repeats;
  - restoring saved state.
- **UI drivers:** headless Chrome plus `python3 -m http.server`, reusing the FamilyChores pattern in `/Users/x95281/FamilyChores/tests/`. They play a full team game and a full solo game end to end and take screenshots at projector size (1920×1080) and phone size (390×844).
- **Visual check:** I look at the screenshots myself for overflow, legibility and contrast.
- **Deploy:** the README covers creating the GitHub repo, pushing, and turning on Pages. Pushing and making anything public happen only on Paul's go-ahead. A live smoke test follows once the site is up.
- **Logging:** a session report entry and a memory note for the new project.
