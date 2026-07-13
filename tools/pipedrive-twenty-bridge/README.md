# Pipedrive → Twenty migration bridge

One-off operational scripts to close the gaps found in the Pipedrive → Twenty
migration audit (July 2026). **These run against production CRM data** and must
be executed from an environment with network access to both APIs — they cannot
run inside the Claude Code sandbox (egress policy blocks `api.pipedrive.com` and
the Twenty API host).

## The four gaps this addresses

| # | Gap | Fixed by |
|---|-----|----------|
| 1 | **A whole Pipedrive pipeline ("Public AI Training", stages 30–33) was never migrated** — 101 deals absent from Twenty, including **46 won** deals. | Re-run the **original migration importer** with that pipeline included (full fidelity: value, won/lost, dates, `pipedriveId`). NOT this script. |
| 2 | **Notes migrated onto the Person but never linked to the Opportunity** (`targetOpportunityId` null) — deal context invisible in Twenty. | `pipedrive-twenty-bridge.mjs` — `notes` step |
| 3 | **~15% of notes/people dropped entirely** during migration. | `pipedrive-twenty-bridge.mjs` — `dropped` step |
| 4 | **Pipedrive deal email threads: 0% migrated.** | `pipedrive-twenty-bridge.mjs` — `emails` step |

`reconciliation.csv` is the full deal-level worklist (all 311 Pipedrive deals →
Twenty opportunity match, with `gap_reason`). The 101 rows flagged
`EXCLUDED PIPELINE` are Gap 1 and are recovered by the importer, not this script.

## Before you run

1. **Rotate the API keys.** The keys used during the audit were shared in a chat
   transcript — issue fresh ones and use only those here.
2. Find your **Twenty API base URL** (`TWENTY_API_URL`) — the host your Twenty
   instance serves its REST API from (e.g. `https://api.twenty.com` for cloud, or
   your self-hosted domain). No trailing slash.
3. Node 18+ (uses global `fetch`).

## Run

```bash
# 1. Dry run FIRST — prints every planned write, changes nothing (default)
PIPEDRIVE_API_TOKEN=xxx \
TWENTY_API_URL=https://your-twenty-host \
TWENTY_API_TOKEN=xxx \
node pipedrive-twenty-bridge.mjs --dry-run

# 2. Review the planned actions, then execute
node pipedrive-twenty-bridge.mjs --execute

# Run a subset if you want to stage it
node pipedrive-twenty-bridge.mjs --execute --only=notes
node pipedrive-twenty-bridge.mjs --execute --only=emails,dropped
```

## Safety

- **Idempotent.** Re-running skips notes/targets/emails that already exist
  (matched by note body, existing `noteTargets`, and a `pipedrive_mail_id:` marker
  embedded in imported emails). Safe to run repeatedly.
- Gap 2 (`notes`) only **adds an opportunity target to the existing note** — it
  does not duplicate note bodies.
- Verify the field/endpoint names against your Twenty version before the first
  `--execute` (the REST shape — `/rest/notes`, `/rest/noteTargets`, the
  `pipedriveId[eq]` filter — matches the data model observed in the audit; adjust
  if your schema differs). Always dry-run first.

## Verification after running

Spot-check a few deals from `reconciliation.csv` in the Twenty UI: open the
opportunity and confirm the web-form/chatbot note and any email threads now
appear on the deal, not just the contact.
