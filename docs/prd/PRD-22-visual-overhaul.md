# PRD-22: Visual Overhaul — Premium Aesthetic

**Owner:** agent or teammate
**Est:** 45 min
**Priority:** P1 — first impressions win hackathons
**Status:** pending

---

## Why

Every team using shadcn + Tailwind dark mode looks identical: zinc-900 cards, zinc-800 borders, blue-500 accents. Judges see 20 of these. We need to look like a PRODUCT, not a hackathon project. Think Linear, Vercel dashboard, Stripe — clean but distinctive.

## Principles

- **Less is more** — remove visual clutter, not add decoration
- **Depth through light** — subtle glows and gradients instead of flat colors
- **Typography hierarchy** — bigger contrasts between heading sizes
- **Breathing room** — more whitespace, less density
- **One accent color** — pick a distinctive brand color, not generic blue

## Changes

### 1. Brand Color: Blue → Indigo/Violet gradient

Replace generic `blue-500` accent with an indigo-to-violet gradient throughout:

```css
/* globals.css — add custom properties */
:root {
  --accent: 129 140 248; /* indigo-400 */
  --accent-glow: rgba(129, 140, 248, 0.15);
}
```

Active tab underline: `border-indigo-400` instead of `border-blue-500`
Buttons: `bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500`
Progress bars: `bg-gradient-to-r from-indigo-500 to-violet-500`

### 2. Card depth — subtle glow on hover

```css
/* Add to card containers */
.card-glow {
  transition: box-shadow 0.2s ease;
}
.card-glow:hover {
  box-shadow: 0 0 0 1px rgba(129, 140, 248, 0.1), 0 4px 24px rgba(0, 0, 0, 0.3);
}
```

Apply to stat cards, recommendation cards, collapsible sections.

### 3. Health Score — make it the hero

Current: Just a number and a bar. Boring.
New:
- Large circular gauge instead of horizontal bar (or keep bar but add a radial glow behind the number)
- The score number gets a subtle text-shadow glow matching its color
- Sub-scores as mini progress rings or dots instead of plain numbers

```css
.health-glow {
  text-shadow: 0 0 40px currentColor;
}
```

### 4. Stat cards — glass morphism lite

Instead of flat `bg-zinc-900 border border-zinc-800`:
```
bg-zinc-900/80 backdrop-blur-sm border border-zinc-800/50
```

Add a very subtle gradient from top-left:
```
bg-gradient-to-br from-zinc-800/30 to-zinc-900/80
```

### 5. Typography — bigger hierarchy

- Page title "Process Copilot": `text-2xl font-bold` → `text-3xl font-light tracking-tight`
- Tab labels: slightly larger, `text-sm` → `text-[15px]`
- Stat card values: already `text-2xl`, keep
- Section titles: add `tracking-wide` for that premium feel
- Monospace numbers: use `tabular-nums` everywhere for alignment

### 6. Communication Hub card — make it dramatic

This is our killer insight. It should look SPECIAL:
- Full-width amber gradient background (very subtle)
- Left border thick (4px) amber
- The transfer counts should have small animated bars that fill on mount
- Total number pulses once on mount

### 7. Recommended Actions card — priority left borders

Already has colored left borders. Make them thicker (3px → 4px) and add a subtle matching background tint:
- Quick Win: very faint green background
- High Impact: very faint blue background
- Process Fix: very faint amber background

### 8. Tab content transitions

Add a fade-in when switching tabs:
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.tab-content {
  animation: fadeIn 0.25s ease-out;
}
```

### 9. Remove visual noise

- Remove `?` tooltip icons from stat cards in the main row (Cases, Events, Activities, Variants) — these are self-explanatory. Keep tooltips on sub-rows and tables.
- Remove "Export Report" button from above stat cards — move it to a less prominent position (e.g., inside AI Analysis tab or in the page header)
- Simplify filter bar styling — less border, more integrated

### 10. Footer — subtle, not a footer bar

Current footer is heavy. Make it:
```
text-[11px] text-zinc-600 text-center py-4
```
Just the text, no background differentiation.

## Files

- `frontend/src/app/globals.css` — add custom properties, keyframes, utility classes
- `frontend/src/components/stat-card.tsx` — glass morphism, glow
- `frontend/src/components/health-score.tsx` — glow effect on number
- `frontend/src/components/process-tabs.tsx` — tab styling, fade-in, accent colors
- `frontend/src/components/collapsible-section.tsx` — card glow on hover
- `frontend/src/components/category-breakdown.tsx` — gradient bars
- `frontend/src/components/action-card.tsx` — tinted backgrounds per priority
- `frontend/src/components/recommendation-card.tsx` — accent color updates

## Key Constraint

Do NOT change layout or functionality. This is purely visual CSS/className changes. Every component keeps the same structure, just looks better.

## Verification
- Dashboard looks distinctly different from default shadcn template
- Accent color is consistent (indigo-to-violet, not mixed blues)
- Hover effects work on cards
- Tab transitions are smooth
- Health score has visual impact
- `cd frontend && npm run build` passes
- Check on both 1440p and 1080p screens
