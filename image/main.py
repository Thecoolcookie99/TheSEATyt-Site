#!/usr/bin/env python3
"""Usage: python3 apply_changes.py plate.html -> writes plate.patched.html
Every edit must match exactly once, otherwise nothing is written.
"""
import sys
from pathlib import Path

if len(sys.argv) != 2:
    sys.exit("Usage: python3 apply_changes.py plate.html")

src = Path(sys.argv[1])
if not src.is_file():
    sys.exit(f"Input file not found: {src}")

out = src.with_name(src.stem + ".patched" + src.suffix)
t = src.read_text(encoding="utf-8")
E = []


def r(old, new):
    E.append((old, new))


# ---- 1. separate, toggleable snapping for lines ----
# Match the complete settings declaration; the old fragment
# "nodeSnap: true };" does not occur by itself in the source.
r(
    "const SET = { guides: true, grid: false, showGrid: false, gridSize: 50, blend: false, ui: 100, nodeSnap: true };",
    "const SET = { guides: true, grid: false, showGrid: false, gridSize: 50, blend: false, ui: 100, nodeSnap: true, lineSnap: true, lineMode: 'single' };"
)
r(
    "if (SET.nodeSnap) { const n = nearestNode(p); if (n) p = { x: n.x, y: n.y }; }",
    "if (SET.lineSnap) { const n = nearestNode(p); if (n) p = { x: n.x, y: n.y }; }"
)
r(
    "const nd = SET.nodeSnap && !e.shiftKey ? nearestNode(p, o.id) : null;",
    "const nd = SET.lineSnap && !e.shiftKey ? nearestNode(p, o.id) : null;"
)
r(
    "const nd = SET.nodeSnap && !e.shiftKey && !fromC ? nearestNode(p, O.id) : null;",
    "const nd = SET.lineSnap && !e.shiftKey && !fromC ? nearestNode(p, O.id) : null;"
)
r(
    "if (SET.nodeSnap && lastSP && (S.tool === 'brush' || S.tool === 'line') &&",
    "if ((S.tool === 'line' ? SET.lineSnap : SET.nodeSnap) && lastSP && (S.tool === 'brush' || S.tool === 'line') &&"
)
r(
    '<label class="mrow"><input type="checkbox" id="s-nodes"> Snap pen and lines to end points</label>',
    '<label class="mrow"><input type="checkbox" id="s-nodes"> Snap pen to end points</label>\n'
    '  <label class="mrow"><input type="checkbox" id="s-lines"> Snap lines to end points</label>\n'
    '  <label class="mrow">Drawn lines <select id="s-linemode" style="margin-left:auto"><option value="single">One layer</option><option value="group">Separate, grouped</option></select></label>'
)
r(
    "$('#s-nodes').checked = SET.nodeSnap;",
    "$('#s-nodes').checked = SET.nodeSnap; $('#s-lines').checked = SET.lineSnap; $('#s-linemode').value = SET.lineMode;"
)
r(
    "$('#s-nodes').addEventListener('change', e => { SET.nodeSnap = e.target.checked; saveSettings(); syncSettings(); render(); });",
    "$('#s-nodes').addEventListener('change', e => { SET.nodeSnap = e.target.checked; saveSettings(); syncSettings(); render(); });\n"
    "$('#s-lines').addEventListener('change', e => { SET.lineSnap = e.target.checked; saveSettings(); syncSettings(); render(); });\n"
    "$('#s-linemode').addEventListener('change', e => { SET.lineMode = e.target.value; saveSettings(); syncSettings(); });"
)

# ---- 2. lines drawn in one layer (a path made of separate segments) ----
r(
    "c.beginPath(); let a = pt(0); c.moveTo(a[0], a[1]);",
    "c.beginPath(); let a = pt(0); if (o.segs) { for (let i = 0; i + 1 < P.length; i += 2) { const s = pt(i), t = pt(i + 1); c.moveTo(s[0], s[1]); c.lineTo(t[0], t[1]); } } else c.moveTo(a[0], a[1]);"
)
r(
    "for (let i = 1; i < P.length - 1; i++) { const p = pt(i), q = pt(i + 1);",
    "for (let i = 1; !o.segs && i < P.length - 1; i++) { const p = pt(i), q = pt(i + 1);"
)
r(
    "a = pt(P.length - 1); c.lineTo(a[0], a[1]);",
    "if (!o.segs) { a = pt(P.length - 1); c.lineTo(a[0], a[1]); }"
)
r(
    "if (o.type === 'path' && o.points && o.points.length) ends = [pathPt(o, 0), pathPt(o, o.points.length - 1)];",
    "if (o.type === 'path' && o.points && o.points.length) ends = o.segs ? o.points.map((_, i) => pathPt(o, i)) : [pathPt(o, 0), pathPt(o, o.points.length - 1)];"
)
r(
    "const ok = n => n && n.o.type === 'path' &&",
    "const ok = n => n && n.o.type === 'path' && !n.o.segs &&"
)
r(
    "groupIntoRun(o, lineRun, 'Lines');",
    "if (SET.lineMode === 'single' && o.type === 'line') { mergeLine(o); commit(); break; }\n"
    "      groupIntoRun(o, lineRun, 'Lines');"
)
r(
    "let brushRun = null;",
    """function mergeLine(o) {
  // Each line adds two points to one layer. Replace point arrays rather than mutating
  // them so undo can restore the previous line.
  const a = toWorld(o, { x: -o.w / 2, y: 0 });
  const b = toWorld(o, { x: o.w / 2, y: 0 });
  const pair = [[a.x, a.y], [b.x, b.y]];
  const t = lineRun && byId(lineRun.last);

  if (
    t && t.type === 'path' && t.segs && t.visible && !t.locked &&
    !(t.erase && t.erase.length) &&
    t.stroke === o.stroke && t.strokeWidth === o.strokeWidth
  ) {
    rebuildPath(t, pathDocPts(t).concat(pair));
    S.objects = S.objects.filter(x => x !== o);
    lineRun = { last: t.id, gid: t.group || null };
    return;
  }

  const n = S.objects.filter(x => x.segs).length + 1;
  Object.assign(o, {
    type: 'path',
    segs: true,
    cap: 'round',
    name: 'Lines ' + n,
    fillOn: false
  });
  rebuildPath(o, pair);
  lineRun = { last: o.id, gid: null };
}
let brushRun = null;"""
)
r(
    "function insideObj(o, p) {",
    "function insideObj(o, p) {\n"
    "  if (o.segs && o.points) { const tl = Math.max(8 / S.zoom, (o.strokeWidth || 0) / 2), Q = pathDocPts(o); for (let i = 0; i + 1 < Q.length; i += 2) { const x0 = Q[i][0], y0 = Q[i][1], dx = Q[i + 1][0] - x0, dy = Q[i + 1][1] - y0, L2 = dx * dx + dy * dy || 1, u = clamp(((p.x - x0) * dx + (p.y - y0) * dy) / L2, 0, 1); if (Math.hypot(p.x - x0 - u * dx, p.y - y0 - u * dy) <= tl) return true; } return false; }"
)

# ---- 3. colour picker: close buttons, white fix ----
X = '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'

r(
    '<h4><span class="dot"></span><span id="pk-title">Colour</span></h4>',
    '<h4><span class="dot"></span><span id="pk-title">Colour</span><button type="button" class="ibtn pk-close" data-pk-close aria-label="Close">' + X + '</button></h4>'
)
r(
    '<div class="dual-cols">',
    '<div class="pk-top"><strong>Fill and outline</strong><button type="button" class="ibtn pk-close" data-pk-close aria-label="Close">' + X + '</button></div>\n  <div class="dual-cols">'
)
r(
    "let pickerDismissed = false;",
    "document.addEventListener('click', e => { if (e.target.closest('[data-pk-close]')) { closePicker(); closeDual(); } });\nlet pickerDismissed = false;"
)
# Touch-friendly snapping near the saturation/value edges.
r(
    "area(sv, (x, y) => { P.none = false; P.c.s = clamp(x, 0, 1); P.c.v = clamp(1 - y, 0, 1); });",
    "area(sv, (x, y) => { const sn = n => n < 0.05 ? 0 : n > 0.95 ? 1 : n; P.none = false; P.c.s = sn(clamp(x, 0, 1)); P.c.v = 1 - sn(clamp(y, 0, 1)); });"
)
r(
    "linear-gradient(to top, #000, transparent)",
    "linear-gradient(to top, #000, rgba(0,0,0,0))"
)

# ---- 4. mobile: side panel becomes a bottom sheet ----
r(
    "if (S.sel.length && panels.classList.contains('hidden-panel')) { panels.classList.remove('hidden-panel'); drivePanelResize(false); }",
    "if (innerWidth > 820 && S.sel.length && panels.classList.contains('hidden-panel')) { panels.classList.remove('hidden-panel'); drivePanelResize(false); syncPanelClass(); }"
)
r(
    "function togglePanels() { panels.classList.toggle('hidden-panel'); drivePanelResize(true); }",
    "function syncPanelClass() { document.body.classList.toggle('panel-open', !panels.classList.contains('hidden-panel')); }\n"
    "function togglePanels() { panels.classList.toggle('hidden-panel'); syncPanelClass(); drivePanelResize(true); }"
)
r(
    "function openPanelsMobile() { if (panels.classList.contains('hidden-panel')) { panels.classList.remove('hidden-panel'); drivePanelResize(false); } }",
    "function openPanelsMobile() { if (panels.classList.contains('hidden-panel')) { panels.classList.remove('hidden-panel'); syncPanelClass(); drivePanelResize(false); } }"
)
r(
    "function closePanelsMobile() { if (innerWidth <= 820 && !panels.classList.contains('hidden-panel')) { panels.classList.add('hidden-panel'); drivePanelResize(false); } }",
    "function closePanelsMobile() { if (innerWidth <= 820 && !panels.classList.contains('hidden-panel')) { panels.classList.add('hidden-panel'); syncPanelClass(); drivePanelResize(false); } }"
)
# Editing text on the canvas shouldn't throw a sheet over it.
r(
    "  positionInlineEdit();\n  openPanelsMobile();\n",
    "  positionInlineEdit();\n"
)

# ---- 5. text: resized, emptied, retyped text keeps its uniform scale ----
r(
    "const sx = o.iw ? o.w / o.iw : 1, sy = o.ih ? o.h / o.ih : 1;",
    "const sy = o.ih ? o.h / o.ih : 1; let sx = o.iw ? o.w / o.iw : 1;\n"
    "  // Text scales uniformly. An emptied box collapses its width (clamped to 1px), so trust the height's scale instead.\n"
    "  if (o.lockAspect || !o.iw || o.iw <= (o.strokeWidth || 0) + 1.5) sx = sy;"
)

CSS = """
.pk-close{margin-left:auto;padding:4px}
.picker.dual .pk-top{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px 8px 12px;background:var(--panel);border-bottom:1px solid var(--line);font-size:13px}
.picker .pre::after{box-shadow:inset 0 0 0 1px rgba(128,128,128,.5)}
.picker .sv{box-shadow:0 0 0 1px rgba(128,128,128,.5)}
@media (max-width:820px){
  .panels{position:fixed;left:0;right:0;bottom:0;width:auto;height:min(50vh,460px);border-left:0;border-top:1px solid var(--line);border-radius:16px 16px 0 0;box-shadow:0 -12px 32px rgba(0,0,0,.35);z-index:50;padding-bottom:env(safe-area-inset-bottom,0px);transition:transform .22s cubic-bezier(.25,.8,.25,1)}
  .panels.hidden-panel{width:auto;min-width:0;transform:translateY(105%);visibility:hidden;transition:transform .22s cubic-bezier(.25,.8,.25,1),visibility 0s .22s}
  .panels.hidden-panel>*{min-width:0}
  body.panel-open .quickbar{bottom:calc(min(50vh,460px) + 12px)}
  body.panel-open .zoomdock{display:none}
  .zoomdock{bottom:auto;top:10px}
  .ibtn{padding:9px}
  .layer{padding:8px 6px}
  .picker .pre{height:26px}
  .sv{height:150px}
  input[type=text],input[type=number],select,textarea{font-size:16px}
  .top{overflow-x:auto;scrollbar-width:none}
}
</style>
"""

r("</style>", CSS)

# Validate every edit against the original file before making any changes.
# This prevents writing an output file if any replacement is missing or ambiguous.
errors = []
for old, new in E:
    count = t.count(old)
    if count != 1:
        errors.append((count, old))

if errors:
    for count, old in errors:
        print(
            "Expected exactly 1 match, found %d for:\n%s\n"
            % (count, old[:200]),
            file=sys.stderr
        )
    sys.exit("No output written; fix the unmatched replacement(s).")

# Apply only after all replacements have been validated against the original.
for old, new in E:
    t = t.replace(old, new, 1)

out.write_text(t, encoding="utf-8")
print("Wrote", out)