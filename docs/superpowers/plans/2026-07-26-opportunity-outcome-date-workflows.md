# Opportunity Outcome Date Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create, activate, and live-test three production Twenty workflows that maintain Opportunity `wonAt` and `lostAt` on genuine status transitions.

**Architecture:** Use Twenty's public GraphQL API with an existing active administrator API key so all changes pass through application validation, trigger synchronization, and cache invalidation. Build drafts first, verify their stored definitions, activate only valid versions, and exercise the workflows with a dedicated disposable Opportunity. Preserve the unrelated **Close Lost** draft unchanged. If live testing exposes a server defect that prevents explicit nullable-field clears, fix it with a focused regression test, merge it, wait for the production deployment, and rerun the matrix.

**Tech Stack:** Twenty GraphQL API, Railway CLI, Node.js, PostgreSQL read-only verification, Twenty workflow engine

---

### Task 1: Establish a failing live baseline

**Files:**
- Create temporarily: `.context/opportunity-outcome-workflows.mjs`
- Reference: `docs/superpowers/specs/2026-07-26-opportunity-outcome-date-workflows-design.md`

- [ ] **Step 1: Capture the immutable Close Lost baseline**

Query the workflow, all versions, and timeline events. Record its ID, name,
creator, timestamps, empty trigger, empty steps, draft status, and lack of runs
in the script's verification output.

- [ ] **Step 2: Build authenticated GraphQL helpers**

The temporary script must:

1. Read `APP_SECRET` only from the Railway-injected process environment.
2. Derive the legacy API-key HMAC secret as
   `sha256(APP_SECRET + workspaceId + "API_KEY")`.
3. Sign an HS256 JWT with `sub`, `workspaceId`, `type: "API_KEY"`, the active
   administrator API-key ID in `jti`, and a 30-minute expiry.
4. Never print the token, `APP_SECRET`, database URL, or Railway variables.
5. Send GraphQL requests to `https://crm.lkl.ai/graphql`.

- [ ] **Step 3: Create a dedicated OPEN test Opportunity**

Create an Opportunity named
`Workflow acceptance test - outcome dates - 2026-07-26` with `status: OPEN`,
`wonAt: null`, and `lostAt: null`. Store its returned ID only in memory and in
the local script output needed for cleanup.

- [ ] **Step 4: Verify the failing baseline**

Update the test Opportunity to `status: WON`, poll it for 15 seconds, and
assert:

```text
status = WON
wonAt = null
lostAt = null
```

This establishes RED: no server-side workflow currently stamps the outcome.
Return the record to OPEN with both date fields explicitly null before building
the workflows.

### Task 2: Create three workflow drafts

**Files:**
- Modify temporarily: `.context/opportunity-outcome-workflows.mjs`

- [ ] **Step 1: Create uniquely named workflow records**

Create exactly:

```text
Stamp wonAt on win
Stamp lostAt on loss
Clear outcome dates on reopen
```

Abort if any workflow already exists with one of these names; do not create
duplicates or modify an existing record.

- [ ] **Step 2: Configure each database-event trigger**

Each trigger definition must use:

```json
{
  "name": "Record is created or updated",
  "type": "DATABASE_EVENT",
  "settings": {
    "eventName": "opportunity.upserted",
    "fields": ["status"],
    "outputSchema": {}
  }
}
```

Use unique UUIDs for the filter and update steps. Connect
`trigger -> filter -> update`.

- [ ] **Step 3: Configure the win filter and action**

The filter has one AND group containing:

```text
{{trigger.properties.after.status}} IS WON
{{trigger.properties.before.status}} IS_NOT WON
```

The update targets `{{trigger.properties.after.id}}` and contains only:

```json
{
  "objectName": "opportunity",
  "objectRecord": {
    "wonAt": "{{trigger.properties.after.updatedAt}}",
    "lostAt": null
  },
  "fieldsToUpdate": ["wonAt", "lostAt"]
}
```

- [ ] **Step 4: Configure the loss filter and action**

The filter has one AND group containing:

```text
{{trigger.properties.after.status}} IS LOST
{{trigger.properties.before.status}} IS_NOT LOST
```

The update targets `{{trigger.properties.after.id}}` and contains only:

```json
{
  "objectName": "opportunity",
  "objectRecord": {
    "lostAt": "{{trigger.properties.after.updatedAt}}",
    "wonAt": null
  },
  "fieldsToUpdate": ["lostAt", "wonAt"]
}
```

- [ ] **Step 5: Configure the reopen filter and action**

The filter has one AND group containing:

```text
{{trigger.properties.after.status}} IS OPEN
{{trigger.properties.before.status}} IS_NOT OPEN
```

The update targets `{{trigger.properties.after.id}}` and contains only:

```json
{
  "objectName": "opportunity",
  "objectRecord": {
    "wonAt": null,
    "lostAt": null
  },
  "fieldsToUpdate": ["wonAt", "lostAt"]
}
```

### Task 3: Validate, inspect, and publish

**Files:**
- Modify temporarily: `.context/opportunity-outcome-workflows.mjs`

- [ ] **Step 1: Validate each draft**

Call Twenty's workflow validation mutation for each draft. Abort before
activation if any validation result contains an error.

- [ ] **Step 2: Inspect exact stored definitions**

Read each draft back and assert:

```text
eventName = opportunity.upserted
fields = ["status"]
filter count = 2
filter group operator = AND
action object = opportunity
action fieldsToUpdate contains only wonAt and/or lostAt
action objectRecord has no updatedAt, closeDate, or stage key
```

Also re-read **Close Lost** and assert it still matches the Task 1 baseline.

- [ ] **Step 3: Activate each version**

Activate the three validated drafts one at a time. After each activation,
confirm the workflow's `lastPublishedVersionId` matches that version and the
version status is ACTIVE.

- [ ] **Step 4: Inspect registered automated triggers**

Read the three `workflowAutomatedTrigger` records and assert each is a
DATABASE_EVENT trigger with:

```text
eventName = opportunity.upserted
fields = ["status"]
```

### Task 4: Run the live acceptance matrix

**Files:**
- Modify temporarily: `.context/opportunity-outcome-workflows.mjs`
- Modify:
  `packages/twenty-server/src/engine/core-modules/record-crud/utils/remove-undefined-from-record.util.ts`
- Create:
  `packages/twenty-server/src/engine/core-modules/record-crud/utils/__tests__/remove-undefined-from-record.util.spec.ts`

- [ ] **Step 1: Verify win stamping**

Transition the test Opportunity from OPEN to WON, poll until `wonAt` is
non-null, and assert `lostAt` is null. Save the exact `wonAt`.

- [ ] **Step 2: Verify unrelated edits do not restamp**

Change only the test Opportunity name, wait at least five seconds, and assert
the exact saved `wonAt` value is unchanged.

- [ ] **Step 3: Verify reopening**

Transition WON to OPEN, poll until both `wonAt` and `lostAt` are null, and
assert both fields remain null.

If the filter and Update Record step complete but a nullable field remains set,
trace the value through `UpdateRecordWorkflowAction` and `UpdateRecordService`.
Add a failing unit test proving that `removeUndefinedFromRecord` must remove
`undefined` while preserving explicit `null`, make the smallest correction,
and verify the focused test before merging and deploying.

- [ ] **Step 4: Verify loss stamping**

Transition OPEN to LOST, poll until `lostAt` is non-null, and assert `wonAt`
is null.

- [ ] **Step 5: Verify terminal-to-terminal transition**

Transition LOST to WON, poll until `wonAt` is newer than the earlier saved win
timestamp, and assert `lostAt` is null.

- [ ] **Step 6: Inspect workflow runs**

Read the runs created for the dedicated test Opportunity and assert that all
executed update steps completed without errors. Confirm unrelated-name edits
did not create a run for any of the three workflows.

- [ ] **Step 7: Verify through Twenty's own UI**

Open the dedicated Opportunity at `https://crm.lkl.ai` in the in-app browser,
visually confirm the WON state and populated Won at field, change it to OPEN,
and visually confirm both outcome dates clear within seconds.

- [ ] **Step 8: Clean up the test record**

Delete only the dedicated Opportunity created in Task 1. Confirm it no longer
appears in an API lookup by ID. Do not delete workflow runs or alter any
pre-existing Opportunity.

### Task 5: Verify repository artifacts and merge

**Files:**
- Verify: `docs/superpowers/specs/2026-07-26-opportunity-outcome-date-workflows-design.md`
- Verify: `docs/superpowers/plans/2026-07-26-opportunity-outcome-date-workflows.md`
- Verify:
  `packages/twenty-server/src/engine/core-modules/record-crud/utils/remove-undefined-from-record.util.ts`
- Verify:
  `packages/twenty-server/src/engine/core-modules/record-crud/utils/__tests__/remove-undefined-from-record.util.spec.ts`

- [ ] **Step 1: Run repository verification**

Run:

```bash
git diff --check origin/main...
git status --short
```

Expected: no whitespace errors and only the approved documentation plus the
focused null-preservation fix and regression test.

- [ ] **Step 2: Commit the implementation plan**

Commit the plan with:

```bash
git add docs/superpowers/plans/2026-07-26-opportunity-outcome-date-workflows.md
git commit -m "docs: plan opportunity outcome workflows"
```

- [ ] **Step 3: Push and open a PR**

Push `stamp-opportunity-outcome-dates` and open a PR against `main` describing
the live workflow configuration, null-preservation fix, and acceptance
evidence.

- [ ] **Step 4: Request required Gemini review**

Comment `@gemini review` on the PR and wait at least five minutes. Address any
actionable review feedback. If Gemini does not respond within five minutes,
perform and record a self-review before merging.

- [ ] **Step 5: Merge and verify**

Merge only after checks pass and the Gemini wait or self-review requirement is
satisfied. Confirm the PR state is MERGED, wait for the corrected server build
to reach Railway production, rerun the full live acceptance matrix, and confirm
the production workflows remain ACTIVE.
