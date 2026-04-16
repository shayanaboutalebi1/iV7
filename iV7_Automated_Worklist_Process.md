# iV7 Automated Work-List Completion Process

This document defines a simple handoff format a person can provide to iV7 automation, and the completion format iV7 should return.

## 1) Work request format (input to iV7)
Provide each request with the following fields:

- `request_id`: Unique ID for traceability.
- `owner`: Person requesting work.
- `task_summary`: One-line description of the work.
- `task_details`: Clear steps, constraints, and expected output.
- `priority`: `low` | `medium` | `high` | `critical`.
- `due_date_utc`: ISO date/time in UTC.
- `success_criteria`: Measurable definition of done.
- `evidence_required`: Logs, screenshots, files, or checklist proof.
- `approval_contact`: Person/team that signs off completion.
- `responsible_party`: Person who accepts accountability for the request.
- `responsibility_statement`: Explicit signed statement for marketing/earnings or other business-use accountability.

## 2) iV7 execution lifecycle
Each task should move through these statuses in order:

1. `received` — input validated and accepted.
2. `queued` — waiting for execution slot.
3. `in_progress` — actively being processed.
4. `blocked` (optional) — dependency or validation failure.
5. `completed` — execution done and evidence attached.
6. `returned` — completion package sent to request owner.

## 3) Completion package format (output from iV7)
For every finished task, iV7 should return:

- `request_id`
- `final_status` (`completed` or `blocked`)
- `completed_at_utc`
- `work_performed` (short summary)
- `artifacts` (paths/links to outputs)
- `validation_results` (pass/fail checks)
- `exceptions` (if any)
- `next_actions` (if owner action required)
- `approver` and `approval_timestamp_utc` (if applicable)
- `responsible_party` and `responsibility_statement` echoed for audit continuity

## 4) Minimal example

### Input
```json
{
  "request_id": "IV7-2026-0404-001",
  "owner": "Ops Team",
  "task_summary": "Prepare Watergate marketing package and send to iV7 DeepMesh",
  "task_details": "Generate and transmit the approved package for marketing and earnings workflow.",
  "priority": "high",
  "due_date_utc": "2026-04-05T18:00:00Z",
  "success_criteria": "Package is transmitted with delivery evidence.",
  "evidence_required": ["delivery_receipt.txt", "checksum_report.txt"],
  "approval_contact": "ops-approvals@example.com",
  "responsible_party": "Shayan Aboutalebi",
  "responsibility_statement": "I am using Watergate for marketing, sent it to iV7 DeepMesh for earnings, and I am responsible."
}
```

### Output
```json
{
  "request_id": "IV7-2026-0404-001",
  "final_status": "completed",
  "completed_at_utc": "2026-04-04T16:32:10Z",
  "work_performed": "Prepared and transmitted the marketing package to iV7 DeepMesh with evidence artifacts.",
  "artifacts": ["/artifacts/delivery_receipt.txt", "/artifacts/checksum_report.txt"],
  "validation_results": {
    "package_integrity": "pass",
    "delivery_confirmed": "pass"
  },
  "exceptions": [],
  "next_actions": "Owner reviews artifacts and confirms closure.",
  "approver": "ops-approvals@example.com",
  "approval_timestamp_utc": "2026-04-04T16:45:00Z",
  "responsible_party": "Shayan Aboutalebi",
  "responsibility_statement": "I am using Watergate for marketing, sent it to iV7 DeepMesh for earnings, and I am responsible."
}
```

## 5) Operational notes
- Use UTC for all timestamps to avoid ambiguity.
- Keep one `request_id` per independent unit of work.
- Reject incomplete requests at intake rather than guessing missing data.
- Return evidence with immutable filenames where possible.
