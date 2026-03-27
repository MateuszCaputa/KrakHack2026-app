# Data Directory

## Sample Data

- `sample_event_log.csv` — Fake event log with 8 cases for development and testing. Contains:
  - **Happy path** (CASE-001, 003, 004, 006, 008): Submit → Review → Approval → Doc Prep → QC → Final Approval → Close
  - **Correction loop** (CASE-002, 007): Request sent back for correction, then resubmitted
  - **QC failure loop** (CASE-003): Quality check fails, doc re-prepared
  - **Rejection** (CASE-005): Rejected at initial review, short path
  - Columns: `case_id`, `activity`, `timestamp`, `user`, `department`, `cost`

## Real Data

Real event log CSVs from the hackathon task pack go here. They are gitignored (too large to commit).
