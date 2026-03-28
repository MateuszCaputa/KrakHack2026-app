# PRD-3: Activity Heatmap Integration

**Owner:** Mateusz
**Est:** 25 min
**Priority:** P1 — other Claude flags as top hackathon priority, PDF requires it
**Status:** pending
**Depends on:** PRD-1

---

## Why

The dataset includes dedicated "Activity Heatmap Export" CSV files (2 files, ~7KB total) that show **copy-paste data flows between specific applications** — e.g. "Chrome copy → Excel paste: 47 times." The PDF says this data is key for identifying automation targets ("zestawienie przepływów copy-paste pomiędzy aplikacjami"). We currently ignore these files completely.

This is low-hanging fruit: tiny files, simple schema, huge demo impact. Shows judges we actually used ALL the provided data.

## Data Schema

Files: `Dataset/Activity Heatmap Export - *.csv`

| Column | Example | Meaning |
|--------|---------|---------|
| `Application(Copy&Cut)` | Chrome | App where data was copied |
| `Application(Paste)` | Excel | App where data was pasted |
| `Count` | 47 | Number of copy-paste operations |

## Tasks

### 3A. Add data model

**File:** `backend/models.py`

```python
class CopyPasteFlow(BaseModel):
    source_app: str
    target_app: str
    count: int
```

Add to `PipelineOutput`:
```python
copy_paste_flows: list[CopyPasteFlow] = []
```

### 3B. Add ingestion function

**File:** `backend/pipeline/ingest.py`

Add `load_activity_heatmap_csvs(directory: str) -> pd.DataFrame`:
- Glob `Activity Heatmap Export*.csv`
- Read and concat
- Return DataFrame with columns: source_app, target_app, count
- If no files found, return empty DataFrame (graceful)

### 3C. Wire into pipeline

**File:** `backend/pipeline/pipeline.py`

After loading Activity Sequence CSVs, also load heatmap:
```python
heatmap_df = load_activity_heatmap_csvs(dataset_directory)
copy_paste_flows = _build_copy_paste_flows(heatmap_df)
```

Attach to PipelineOutput.

### 3D. Add TypeScript type

**File:** `frontend/src/lib/types.ts`

```typescript
export interface CopyPasteFlow {
  source_app: string;
  target_app: string;
  count: number;
}
```

Add to `PipelineOutput`:
```typescript
copy_paste_flows: CopyPasteFlow[];
```

### 3E. Display in frontend

**File:** `frontend/src/components/process-tabs.tsx`

Add a "Cross-App Data Transfers" CollapsibleSection on the Overview tab (after Application Usage), showing:
- Each flow as a row: `Chrome → Excel: 47 operations`
- Bar visualization (width proportional to count, like Application Usage)
- Tooltip: "Copy-paste operations detected between applications from Activity Heatmap data — each flow represents manual data transfer that could be automated"
- Sort by count descending

## Verification

- Confirm `Dataset/Activity Heatmap Export*.csv` files exist
- Run pipeline, check `copy_paste_flows` in response is non-empty
- Frontend Overview tab shows "Cross-App Data Transfers" section
- `cd frontend && npm run build` passes
