# PRD-23: UX Polish — Readability, Contrast, Background Fix

**Owner:** Mateusz
**Est:** 20 min
**Priority:** P0 — judges need to read the screen from 2 meters away

---

## Fixes

### 1. Text contrast — labels too dim
- StatCard labels: `text-zinc-500` → `text-zinc-400` and bigger `text-[11px]`
- StatCard values: already white, good
- StatCard sub text: `text-zinc-500` → `text-zinc-400`
- Table headers: already `text-zinc-500`, bump to `text-zinc-400`
- Description/helper text throughout: ensure minimum `text-zinc-400`

### 2. Dashboard background orbs — make visible
The orbs render behind opaque card backgrounds. Fix: make the card-premium bg slightly transparent so orbs bleed through. Change card-premium from `rgba(24, 24, 27, 0.8)` to `rgba(24, 24, 27, 0.6)`.

### 3. Stat card label tracking too wide
`tracking-widest` is excessive for small text. Change to `tracking-wider`.

### 4. Hub insight card — ensure amber contrast
Check amber text on amber bg is readable.

### 5. Footer too invisible
`text-zinc-600` on dark bg is nearly invisible. Change to `text-zinc-500`.

## Files
- `frontend/src/components/stat-card.tsx`
- `frontend/src/app/globals.css` (card-premium opacity)
- `frontend/src/app/layout.tsx` (footer)
