# Opportunity outcome date workflows

## Goal

Configure three active workflows in the production LOKAL Twenty workspace so
Opportunity outcome timestamps are maintained server-side, regardless of which
client changes the record.

The workflows must preserve the existing unpublished **Close Lost** workflow.
Database history shows that Joshua Pielago created **Close Lost** on
2026-07-03 at 19:05 UTC, renamed it from an empty name 16 seconds later, and
made no further changes. It has no trigger, steps, published version, runs,
deleted versions, or other audit history. There is no evidence that it ever
implemented outcome-date stamping.

## Implementation approach

Create and activate the workflows through Twenty's GraphQL API using an
existing active administrator API key. This keeps workflow validation,
automated-trigger registration, cache invalidation, and audit behavior inside
Twenty's application services. Do not write workflow rows directly in
Postgres or create another API key.

Create all three workflows as drafts first. Validate and inspect their complete
definitions and registered trigger settings before activation.

Live acceptance exposed an existing server defect in the Update Record action:
`removeUndefinedFromRecord` used `isDefined`, which removes both `undefined`
and explicit `null` values. As a result, an action could report success while
silently dropping a requested nullable-field clear. Correct the utility to
remove only `undefined`, preserve `null` as its own contract requires, and add
a focused regression test. The workflow definitions remain unchanged; rerun
the live matrix after the corrected server build reaches production.

## Shared trigger

Each workflow uses a **Record is created or updated** database-event trigger:

- Object: Opportunity
- Event: `opportunity.upserted`
- Watched fields: exactly `["status"]`

The watched-field scope is the recursion guard. Updates made by these workflows
only touch `wonAt` and `lostAt`, so their own writes cannot enqueue another run.
The transition filter is a second guard against redundant writes that include
an unchanged terminal status.

## Workflow definitions

### Stamp wonAt on win

The filter step has one `AND` group:

- `{{trigger.properties.after.status}} IS WON`
- `{{trigger.properties.before.status}} IS_NOT WON`

The Update Record step targets Opportunity
`{{trigger.properties.after.id}}` and updates exactly:

- `wonAt` = `{{trigger.properties.after.updatedAt}}`
- `lostAt` = `null`

### Stamp lostAt on loss

The filter step has one `AND` group:

- `{{trigger.properties.after.status}} IS LOST`
- `{{trigger.properties.before.status}} IS_NOT LOST`

The Update Record step targets Opportunity
`{{trigger.properties.after.id}}` and updates exactly:

- `lostAt` = `{{trigger.properties.after.updatedAt}}`
- `wonAt` = `null`

### Clear outcome dates on reopen

The filter step has one `AND` group:

- `{{trigger.properties.after.status}} IS OPEN`
- `{{trigger.properties.before.status}} IS_NOT OPEN`

The Update Record step targets Opportunity
`{{trigger.properties.after.id}}` and updates exactly:

- `wonAt` = `null`
- `lostAt` = `null`

## Timestamp semantics

Database-event payloads do not expose a separate event timestamp. The
server-generated `after.updatedAt` value is the timestamp of the status write,
so it is the most precise event-time source available and avoids clock drift
from a later Code step.

The workflows only read `after.updatedAt`. `updatedAt` is never included in an
Update Record action's `objectRecord` or `fieldsToUpdate`.

## Safety and error handling

- Never update `updatedAt`, `closeDate`, or `stage`.
- Never modify, activate, rename, or delete **Close Lost**.
- Use unique step and filter UUIDs for each workflow.
- Leave all new workflows in draft if validation reports an error.
- Before activation, inspect each draft's trigger, filters, action fields, and
  edges, and confirm each automated trigger watches only `status`.
- After activation, inspect workflow runs for failed steps before declaring the
  configuration complete.
- Preserve explicit `null` values in tool and workflow record updates while
  continuing to remove `undefined` values, including inside composite fields.

## Verification

Use a dedicated test Opportunity so no existing deal is repurposed.

1. Before activation, transition the test record from OPEN to WON through
   Twenty's public API and confirm `wonAt` remains null. This is the failing
   baseline.
2. Return it to OPEN and ensure both outcome fields are null.
3. Activate the three validated workflow versions.
4. Transition OPEN to WON and confirm `wonAt` populates within seconds while
   `lostAt` is null.
5. Save the timestamp, edit an unrelated field, and confirm `wonAt` is
   unchanged.
6. Transition WON to OPEN and confirm both timestamps clear.
7. Transition OPEN to LOST and confirm `lostAt` populates while `wonAt` is
   null.
8. Transition LOST to WON and confirm `wonAt` is refreshed and `lostAt`
   clears.
9. Inspect the workflow runs and registered automated triggers.
10. Remove the dedicated test Opportunity after verification.

The live acceptance result must include the observed timestamps and explicitly
confirm the unrelated-field edit did not restamp the win.
