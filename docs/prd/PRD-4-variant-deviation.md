# PRD-4: Variant Deviation Highlighting

**Owner:** Mateusz
**Est:** 20 min
**Priority:** P1 — PDF requires "identifying deviations from common paths"
**Status:** pending
**Depends on:** nothing

---

## Why

PDF requires "Odchylenia od głównej ścieżki" (deviations from the main path). We show variants but don't show WHERE they deviate from the happy path. The other Claude flags: "liste warianty, ale nie pokazujemy gdzie konkretne warianty odchylają się od happy path."

Currently all variant steps are the same zinc color. By highlighting steps that differ from the most common variant, we make deviations immediately visible.

## Tasks

### 4A. Identify happy path

In the Variants tab rendering logic, the first variant (sorted by case_count desc) is the happy path. Extract its sequence as a Set for fast lookup.

### 4B. Add "Happy Path" badge

Mark variant #1 with a small badge: green pill saying "Happy Path" next to the percentage.

### 4C. Highlight deviating steps

For all other variants, in the `VariantCard` component:
- Steps that appear in the happy path sequence → keep current zinc style
- Steps that do NOT appear in the happy path → use amber/orange style (`bg-amber-900/30 text-amber-300 border-amber-700`)

This applies both to regular steps and to compressed loop segments.

### 4D. Add deviation count

For each non-happy-path variant, show a small "N deviations" count below the step count.

## Verification

- Variants tab: first variant shows "Happy Path" green badge
- Other variants: steps not in happy path are amber-highlighted
- Visual is clear and not cluttered
- `cd frontend && npm run build` passes
