#!/usr/bin/env python3
"""Apply the four Plate editor edits.

Usage: python patch_plate.py plate.html [out.html]
Each edit must match exactly once, otherwise nothing is written.
"""
import sys

src_path = sys.argv[1]
out_path = sys.argv[2] if len(sys.argv) > 2 else src_path.replace('.html', '') + '-edited.html'
s = open(src_path, encoding='utf-8').read()

EDITS = [
 # 1. Lasso in "select layers" mode hands over to the Move tool with the selection kept
 ("""S.sel = expandSel(ids); syncAll();""",
  """S.sel = expandSel(ids); if (ids.length) setTool('select', { keepSel: true }); syncAll();"""),

 # 2a. Copy / cut work from the live selection whatever tool is active
 ("""case 'copy': if (sel.length) { clip = sel.map(o => ({ ...o })); pasteN = 0; toast(`Copied ${sel.length} layer${sel.length > 1 ? 's' : ''}`); } break;""",
  """case 'copy': { const c = tgts && tgts.length ? tgts : selObjs(); if (c.length) { clip = c.map(o => ({ ...o })); pasteN = 0; toast(`Copied ${c.length} layer${c.length > 1 ? 's' : ''}`); } break; }"""),
 ("""case 'cut': if (sel.length) { clip = sel.map(o => ({ ...o })); pasteN = -1; S.objects = S.objects.filter(o => !S.sel.includes(o.id)); S.sel = []; commit(); } break;""",
  """case 'cut': { const c = tgts && tgts.length ? tgts : selObjs(); if (c.length) { const ids = c.map(o => o.id); clip = c.map(o => ({ ...o })); pasteN = 0; S.objects = S.objects.filter(o => !ids.includes(o.id)); S.sel = S.sel.filter(id => !ids.includes(id)); commit(); } break; }"""),
 # 2b. Native copy/cut events, so they don't depend on keydown or focus
 ("""/* ---------- drag & drop ---------- */""",
  """document.addEventListener('copy', e => { if (isTyping(e.target) || !S.sel.length) return; e.preventDefault(); act('copy'); });
document.addEventListener('cut', e => { if (isTyping(e.target) || !S.sel.length) return; e.preventDefault(); act('cut'); });

/* ---------- drag & drop ---------- */"""),

 # 3. Paste lands exactly on top of the original
 ("""cloneSet(clip, 20 * pasteN, true)""", """cloneSet(clip, 0, true)"""),

 # 4. New text keeps the same on-screen size at any zoom level
 ("""font: S.style.font, fontSize: S.style.fontSize, bold: S.style.bold,""",
  """font: S.style.font, fontSize: clamp(Math.round(S.style.fontSize / S.zoom), 4, Math.max(4, Math.round(S.doc.h * 0.5))), bold: S.style.bold,"""),
]

for i, (old, new) in enumerate(EDITS, 1):
    n = s.count(old)
    if n != 1:
        sys.exit(f'Edit {i}: expected 1 match, found {n}. Nothing written.')
    s = s.replace(old, new)

open(out_path, 'w', encoding='utf-8').write(s)
print('Wrote', out_path)