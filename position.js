// Where the notch sits along the top of a monitor. The notch is placed by its centre ("anchor", a screen x).
// The window is as wide as the open panel needs, so the anchor stays at least half that far in from the screen's
// edges: the panel always fits, and the pill can reach to within that distance of a corner.
const WIDEST = 560
const SNAP = 28 // dropping the notch this close to the middle of a monitor puts it exactly there

const centre = b => b.x + b.width / 2
const clampAnchor = (x, b) => Math.min(b.x + b.width - WIDEST / 2, Math.max(b.x + WIDEST / 2, x))
const snapAnchor = (x, b) => Math.abs(x - centre(b)) <= SNAP ? centre(b) : x
const windowRect = (anchor, b, s) => ({ x: Math.round(clampAnchor(anchor, b) - s.width / 2), y: b.y, width: s.width, height: s.height })

// Saved as a fraction of a monitor's width, so it survives resolution changes; the monitor is remembered by id.
const toSaved = (anchor, b, id) => ({ id, frac: (anchor - b.x) / b.width })
const fromSaved = (saved, displays, primary) => {
  const d = displays.find(d => d.id === saved?.id) || primary
  return { display: d, anchor: typeof saved?.frac === 'number' ? d.bounds.x + saved.frac * d.bounds.width : centre(d.bounds) }
}

module.exports = { WIDEST, clampAnchor, snapAnchor, windowRect, centre, toSaved, fromSaved }

if (require.main === module) {
  const assert = require('assert')
  const b = { x: 0, y: 0, width: 1920, height: 1080 }, right = { x: 1920, y: 0, width: 1280, height: 1024 }
  assert.equal(clampAnchor(-50, b), 280); assert.equal(clampAnchor(5000, b), 1920 - 280); assert.equal(clampAnchor(900, b), 900)
  assert.equal(snapAnchor(975, b), 960); assert.equal(snapAnchor(1000, b), 1000, 'too far from the middle to snap')
  assert.deepEqual(windowRect(960, b, { width: 520, height: 230 }), { x: 700, y: 0, width: 520, height: 230 })
  assert.deepEqual(windowRect(100, b, { width: 560, height: 720 }), { x: 0, y: 0, width: 560, height: 720 }, 'near the edge it stays on screen')
  assert.equal(windowRect(2500, right, { width: 520, height: 230 }).x, 2240, 'a second monitor to the right')
  const d1 = { id: 1, bounds: b }, d2 = { id: 2, bounds: right }
  const saved = toSaved(2560, right.bounds || right, 2)
  assert.deepEqual(fromSaved(saved, [d1, d2], d1), { display: d2, anchor: 2560 })
  assert.equal(fromSaved(saved, [d1], d1).display, d1, 'a monitor that is gone falls back to the main one')
  assert.equal(fromSaved(null, [d1], d1).anchor, 960)
  console.log('position.js ok')
}
