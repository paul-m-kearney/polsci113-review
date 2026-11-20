# -*- coding: utf-8 -*-
"""Build the reviewer's copy of the question bank: POLSCI113_Review_Bank.md and .docx.
Reads bank/question_bank.json (the single source of truth). The review files are output only:
edits made in them are NOT read back, so send changes by item id (for example "REG-300-2: change the clue to ...").
Run: python3 -E bank/build_review_doc.py
"""
import json, os
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
bank = json.load(open(os.path.join(HERE, "question_bank.json"), encoding="utf-8"))
items = bank["items"]
cats = bank["categories"]
LETTERS = "ABCD"

def cell_items(cat, value): return sorted((i for i in items if i["cat"] == cat and i["value"] == value), key=lambda i: i["id"])
finals = sorted((i for i in items if i["cat"] == "FINAL"), key=lambda i: i["id"])
INTRO = [
    "125 questions: 6 categories × 5 point values × 4 questions each (120), plus 5 Final Jeopardy questions.",
    "The last digit of each id is the board number, so the bank makes four complete boards with no repeats.",
    "In team play the clue is shown alone and the host reveals the answer. In solo play the four choices are shown, "
    "in shuffled order. Here the correct choice is always listed first and marked.",
    "To change an item, send its id and the change. This file is rebuilt from the bank, so edits made here are not read back.",
]

# ---------------- Markdown ----------------
md = [f"# POLSCI 113 Review Game: Question Bank", "", f"*{bank['version']}*", ""] + [f"- {t}" for t in INTRO] + [""]
def md_item(i):
    out = [f"**{i['id']}**  (Week {i['week']}, {i['reading']}; slide: {i['slide']})", "", f"Clue: {i['clue']}", "",
           f"Answer: **{i['answer']}**", ""]
    out += [f"- {LETTERS[k]}. {c}{'  ✓' if k == 0 else ''}" for k, c in enumerate(i["choices"])]
    out += ["", f"Why: {i['explain']}", ""]
    return out
for c in cats:
    md += [f"## {c['name']}", ""]
    for v in bank["values"]:
        md += [f"### {v} points", ""]
        for i in cell_items(c["key"], v): md += md_item(i)
md += ["## Final Jeopardy", ""]
for i in finals: md += md_item(i)
open(os.path.join(ROOT, "POLSCI113_Review_Bank.md"), "w", encoding="utf-8").write("\n".join(md))

# ---------------- Word ----------------
NAVY, ORANGE, GRAY = RGBColor(0x01, 0x21, 0x69), RGBColor(0xC8, 0x4E, 0x00), RGBColor(0x6B, 0x6B, 0x6B)
doc = Document()
for s in doc.sections: s.left_margin = s.right_margin = Inches(0.9); s.top_margin = s.bottom_margin = Inches(0.8)
st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(10.5)

def para(text="", bold=False, color=None, size=None, after=4, before=0, italic=False, indent=None):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(after); p.paragraph_format.space_before = Pt(before)
    if indent is not None: p.paragraph_format.left_indent = Inches(indent)
    if text:
        r = p.add_run(text); r.bold = bold; r.italic = italic
        if color is not None: r.font.color.rgb = color
        if size: r.font.size = Pt(size)
    return p

para("POLSCI 113 Review Game: Question Bank", bold=True, color=NAVY, size=20, after=2)
para(bank["version"], color=GRAY, italic=True, after=8)
for t in INTRO:
    p = doc.add_paragraph(t, style="List Bullet"); p.paragraph_format.space_after = Pt(2)

def docx_item(i):
    p = para(before=8, after=1); p.paragraph_format.keep_with_next = True
    r = p.add_run(i["id"]); r.bold = True; r.font.color.rgb = ORANGE
    r = p.add_run(f"   Week {i['week']}, {i['reading']}; slide: {i['slide']}"); r.font.color.rgb = GRAY; r.font.size = Pt(9)
    p = para(after=2); p.paragraph_format.keep_with_next = True
    p.add_run("Clue: ").bold = True; p.add_run(i["clue"])
    p = para(after=2); p.paragraph_format.keep_with_next = True
    p.add_run("Answer: ").bold = True; p.add_run(i["answer"]).bold = True
    for k, c in enumerate(i["choices"]):
        p = para(after=0, indent=0.3); p.paragraph_format.keep_with_next = True
        r = p.add_run(f"{LETTERS[k]}. {c}")
        if k == 0: r.bold = True; p.add_run("   ✓ correct").font.color.rgb = ORANGE
    p = para(after=2, before=2); r = p.add_run("Why: "); r.bold = True; r.font.color.rgb = GRAY
    r = p.add_run(i["explain"]); r.font.color.rgb = GRAY

for c in cats:
    doc.add_page_break()
    para(c["name"], bold=True, color=NAVY, size=16, after=2)
    for v in bank["values"]:
        p = para(f"{v} points", bold=True, color=NAVY, size=12, before=10, after=0); p.paragraph_format.keep_with_next = True
        for i in cell_items(c["key"], v): docx_item(i)
doc.add_page_break()
para("Final Jeopardy", bold=True, color=NAVY, size=16, after=2)
for i in finals: docx_item(i)
doc.save(os.path.join(ROOT, "POLSCI113_Review_Bank.docx"))
print("wrote POLSCI113_Review_Bank.md and .docx:", len(items), "items")
