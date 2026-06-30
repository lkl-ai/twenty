# Native Custom Pipelines (Pipedrive-style) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class, user-creatable pipelines to Twenty — multiple pipelines, each with its own ordered stage set, where an Opportunity belongs to one pipeline and sits in one of that pipeline's stages, with a per-pipeline Kanban board and a settings editor (parity with Pipedrive pipelines).

**Architecture:** Introduce two new **standard objects** — `pipeline` and `pipelineStage` — plus two MANY_TO_ONE relations on `opportunity` (`pipeline`, `pipelineStage`). Stages become real per-pipeline records (not global SELECT options), so the Kanban board groups Opportunities by the `pipelineStage` **relation** field. A `@RegisteredWorkspaceCommand` rolls the new objects out to existing workspaces and seeds a default pipeline. The frontend adds a pipeline tab-switcher above the board and a Settings editor that CRUDs pipelines/stages and keeps each pipeline's Kanban view (filter + viewGroups) in sync. A backend query hook enforces that an opportunity's `pipelineStage` belongs to its `pipeline`.

**Tech Stack:** NestJS + TypeORM (twenty-server), flat-metadata builder system, GraphQL (code-first + metadata API), React 18 + Recoil/Jotai + Linaria (twenty-front), `@hello-pangea/dnd` for the board.

## Global Constraints

- **Never mutate an existing `universalIdentifier`** in `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts`. New objects/fields get freshly minted v4 UUIDs, prefixed `20202020-` by convention.
- **No decorators** for standard objects — use the flat-metadata builders under `packages/twenty-server/src/engine/workspace-manager/twenty-standard-application/`.
- Standard objects are `isSystem: true`; structural changes go only through the migration/sync path (`validateBuildAndRunWorkspaceMigration`), never the public GraphQL metadata API.
- Existing workspaces do **not** auto-receive new standard objects on deploy — a `@RegisteredWorkspaceCommand` is mandatory for rollout.
- Functional components only; named exports only; types over interfaces; no `any`; string literals over enums (except GraphQL enums); kebab-case files; `lint:diff-with-main` + `typecheck` must pass per task.
- Run a single test file with: `npx jest <path> --config=packages/twenty-server/jest.config.mjs` (server) or `npx nx test twenty-front` (front).
- The live target instance already has migrated Pipedrive data with custom fields `pdPipeline`/`pdStage`/`pdStatus` on Opportunity (6 pipelines, ~13 stages, 303 deals) — Phase 5 backfills the native model from these.

---

## File Structure

**twenty-shared**
- `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts` (modify) — register `pipeline`, `pipelineStage`, their fields/indexes/views, and the new Opportunity relation fields.

**twenty-server — standard object definitions**
- `packages/twenty-server/src/modules/pipeline/standard-objects/pipeline.workspace-entity.ts` (create)
- `packages/twenty-server/src/modules/pipeline/standard-objects/pipeline-stage.workspace-entity.ts` (create)
- `.../twenty-standard-application/utils/field-metadata/compute-pipeline-standard-flat-field-metadata.util.ts` (create)
- `.../twenty-standard-application/utils/field-metadata/compute-pipeline-stage-standard-flat-field-metadata.util.ts` (create)
- `.../twenty-standard-application/utils/object-metadata/create-standard-flat-object-metadata.util.ts` (modify) — add `pipeline`, `pipelineStage` to `STANDARD_FLAT_OBJECT_METADATA_BUILDERS_BY_OBJECT_NAME`
- `.../twenty-standard-application/utils/field-metadata/build-standard-flat-field-metadata-maps.util.ts` (modify) — register the 2 new builders
- `.../twenty-standard-application/utils/field-metadata/compute-opportunity-standard-flat-field-metadata.util.ts` (modify) — add `pipeline` + `pipelineStage` MANY_TO_ONE relations
- `.../twenty-standard-application/utils/index/*` (create/modify) — index builders for the new objects

**twenty-server — integrity + rollout**
- `packages/twenty-server/src/modules/pipeline/query-hooks/validate-opportunity-pipeline-stage.pre-query-hook.ts` (create) — enforce stage∈pipeline
- `packages/twenty-server/src/modules/pipeline/pipeline.module.ts` (create) — register the hook
- `packages/twenty-server/src/database/commands/upgrade-version-command/<ver>/<ver>-workspace-command-<ts>-sync-pipeline-standard-objects.command.ts` (create) — rollout + seed default pipeline
- `packages/twenty-server/src/database/commands/upgrade-version-command/<ver>/<ver>-upgrade-version-command.module.ts` (modify) — register command

**twenty-front — board switcher**
- `packages/twenty-front/src/modules/pipelines/components/PipelineSwitcher.tsx` (create)
- `packages/twenty-front/src/modules/pipelines/hooks/usePipelines.ts` (create)
- `packages/twenty-front/src/modules/object-record/record-index/components/RecordIndexPageHeader.tsx` (modify) — mount switcher for Opportunity object
- `packages/twenty-front/src/modules/pipelines/utils/syncPipelineView.ts` (create) — ensure each pipeline has a backing Kanban view

**twenty-front — settings editor**
- `packages/twenty-front/src/modules/settings/pipelines/components/SettingsPipelines.tsx` (create)
- `packages/twenty-front/src/modules/settings/pipelines/components/SettingsPipelineStagesEditor.tsx` (create)
- `packages/twenty-front/src/modules/settings/pipelines/hooks/useEditPipeline.ts` (create)
- routing + navigation entry under Settings (modify settings routes)

---

## Phasing & scope

- **Phase 1 (Tasks 1–6):** backend data model (objects, relations, indexes, registration). Testable: new workspaces get `pipeline`/`pipelineStage` tables + Opportunity FKs; metadata API exposes them.
- **Phase 2 (Tasks 7–8):** rollout command + default-pipeline seed. Testable: existing workspace gains the objects and a "Default" pipeline with stages.
- **Phase 3 (Tasks 9–11):** Kanban grouping by the `pipelineStage` relation + pipeline tab-switcher. Testable: per-pipeline board with drag-drop.
- **Phase 4 (Tasks 12–14):** Settings editor (CRUD pipelines/stages, reorder, color) + view sync.
- **Phase 5 (Tasks 15–16):** integrity query hook + backfill the live instance's `pdPipeline`/`pdStage` data into native pipelines.

> **Split point:** Phases 1–2 produce working software (pipelines exist as data, usable via API). If executing as two plans, Phases 3–4 (frontend) can be a second plan that depends on Phase 1–2 being merged. Phase 5 can run against the live instance independently once Phase 2 lands.

---

### Task 1: Register `pipeline` and `pipelineStage` in the universal-identifier registry

**Files:**
- Modify: `packages/twenty-shared/src/metadata/constants/standard-object.constant.ts` (add two top-level keys near the `opportunity` block, ~line 1709)

**Interfaces:**
- Produces: `STANDARD_OBJECTS.pipeline` and `STANDARD_OBJECTS.pipelineStage` (object + field `universalIdentifier`s); extends the derived `AllStandardObjectName` union → downstream builder maps will fail to compile until Tasks 2–5 are done (intended forcing function).

- [ ] **Step 1:** Generate fresh UUIDs (use `uuidv4()` once, hardcode them; prefix `20202020-` to match convention). You need one for each of: the `pipeline` object; pipeline fields `name`, `position`, `isDefault`, `pipelineStages` (relation), `opportunities` (relation); the `pipelineStage` object; pipelineStage fields `name`, `position`, `color`, `pipeline` (relation), `opportunities` (relation); plus the new opportunity fields `pipeline` and `pipelineStage` and their join-FK universalIdentifiers; plus default `views`/`indexes` ids per the existing `opportunity` shape.

- [ ] **Step 2:** Add the `pipeline` and `pipelineStage` blocks mirroring the `opportunity` block's shape (object-level `universalIdentifier`, `fields: {...}`, `indexes: {...}`, `views: {...}` with `viewFields`/`viewGroups`). Copy the structure verbatim from the opportunity entry; do not invent new keys.

- [ ] **Step 3:** Add `pipeline` and `pipelineStage` field entries to the existing `opportunity` block's `fields` map with their own `universalIdentifier`s.

- [ ] **Step 4: Build shared.** Run: `npx nx build twenty-shared`
  Expected: PASS. (twenty-server consumes the built package; this must succeed before server compiles.)

- [ ] **Step 5: Commit**
```bash
git add packages/twenty-shared/src/metadata/constants/standard-object.constant.ts
git commit -m "feat(shared): register pipeline + pipelineStage standard object identifiers"
```

---

### Task 2: Create the workspace-entity type classes

**Files:**
- Create: `packages/twenty-server/src/modules/pipeline/standard-objects/pipeline.workspace-entity.ts`
- Create: `packages/twenty-server/src/modules/pipeline/standard-objects/pipeline-stage.workspace-entity.ts`

**Interfaces:**
- Consumes: `BaseWorkspaceEntity`, `EntityRelation` (same imports `opportunity.workspace-entity.ts` uses).
- Produces: `PipelineWorkspaceEntity`, `PipelineStageWorkspaceEntity` type contracts used as generics in relation builders.

- [ ] **Step 1:** Mirror `packages/twenty-server/src/modules/opportunity/standard-objects/opportunity.workspace-entity.ts` (bare class, type-only members, no decorators).

`pipeline.workspace-entity.ts`:
```ts
import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { EntityRelation } from 'src/engine/workspace-manager/...'; // copy exact import from opportunity entity
import { PipelineStageWorkspaceEntity } from 'src/modules/pipeline/standard-objects/pipeline-stage.workspace-entity';
import { OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';

export class PipelineWorkspaceEntity extends BaseWorkspaceEntity {
  name: string;
  position: number;
  isDefault: boolean;
  pipelineStages: EntityRelation<PipelineStageWorkspaceEntity[]>;
  opportunities: EntityRelation<OpportunityWorkspaceEntity[]>;
}
```

`pipeline-stage.workspace-entity.ts`:
```ts
export class PipelineStageWorkspaceEntity extends BaseWorkspaceEntity {
  name: string;
  position: number;
  color: string;
  pipeline: EntityRelation<PipelineWorkspaceEntity>;
  pipelineId: string | null;
  opportunities: EntityRelation<OpportunityWorkspaceEntity[]>;
}
```

- [ ] **Step 2: Typecheck.** Run: `npx nx typecheck twenty-server` — Expected: FAIL only on the not-yet-registered builders (Tasks 3–5), not on these files' syntax.

- [ ] **Step 3: Commit**
```bash
git add packages/twenty-server/src/modules/pipeline/standard-objects/
git commit -m "feat(server): add pipeline + pipelineStage workspace-entity types"
```

---

### Task 3: Field-metadata builder for `pipeline`

**Files:**
- Create: `.../twenty-standard-application/utils/field-metadata/compute-pipeline-standard-flat-field-metadata.util.ts`

**Interfaces:**
- Consumes: `createStandardFieldFlatMetadata`, `createStandardRelationFieldFlatMetadata`, `FieldMetadataType`, `RelationType`, `RelationOnDeleteAction`, `i18nLabel` (copy import block from `compute-opportunity-standard-flat-field-metadata.util.ts`).
- Produces: `computePipelineStandardFlatFieldMetadata({ objectName, workspaceId, ... })` returning the flat field map for the pipeline object.

- [ ] **Step 1:** Implement `name` (TEXT, label identifier), `position` (NUMBER), `isDefault` (BOOLEAN, default `false`), the `pipelineStages` ONE_TO_MANY relation (target `pipelineStage`, targetField `pipeline`), and the `opportunities` ONE_TO_MANY relation (target `opportunity`, targetField `pipeline`). Use the `stage` field block and the `company`/`pointOfContact` relation blocks in the opportunity util as the exact templates. Relation example (copy shape):
```ts
createStandardRelationFieldFlatMetadata({
  objectName: 'pipeline',
  workspaceId,
  context: {
    type: FieldMetadataType.RELATION,
    morphId: null,
    fieldName: 'opportunities',
    label: i18nLabel(msg`Opportunities`),
    icon: 'IconTargetArrow',
    isNullable: true,
    targetObjectName: 'opportunity',
    targetFieldName: 'pipeline',
    settings: { relationType: RelationType.ONE_TO_MANY },
  },
  universalIdentifier: STANDARD_OBJECTS.pipeline.fields.opportunities.universalIdentifier,
});
```

- [ ] **Step 2: Typecheck** — Run: `npx nx typecheck twenty-server` — Expected: still FAIL on registration maps (Task 5), not on this file.

- [ ] **Step 3: Commit**
```bash
git add .../compute-pipeline-standard-flat-field-metadata.util.ts
git commit -m "feat(server): pipeline field-metadata builder"
```

---

### Task 4: Field-metadata builder for `pipelineStage` + Opportunity relations

**Files:**
- Create: `.../utils/field-metadata/compute-pipeline-stage-standard-flat-field-metadata.util.ts`
- Modify: `.../utils/field-metadata/compute-opportunity-standard-flat-field-metadata.util.ts`

**Interfaces:**
- Produces: `computePipelineStageStandardFlatFieldMetadata(...)`; adds `pipeline` + `pipelineStage` MANY_TO_ONE fields to Opportunity's builder.

- [ ] **Step 1:** `pipelineStage` builder: `name` (TEXT, label identifier), `position` (NUMBER), `color` (TEXT — store a `TagColor` string), `pipeline` MANY_TO_ONE (target `pipeline`, targetField `pipelineStages`, `joinColumnName: 'pipelineId'`, `onDelete: CASCADE`), `opportunities` ONE_TO_MANY (target `opportunity`, targetField `pipelineStage`).

- [ ] **Step 2:** In the opportunity util, add (mirroring its existing `company` MANY_TO_ONE at ~line 336):
```ts
createStandardRelationFieldFlatMetadata({
  objectName: 'opportunity', workspaceId,
  context: {
    type: FieldMetadataType.RELATION, morphId: null,
    fieldName: 'pipeline', label: i18nLabel(msg`Pipeline`), icon: 'IconFilter',
    isNullable: true, targetObjectName: 'pipeline', targetFieldName: 'opportunities',
    settings: { relationType: RelationType.MANY_TO_ONE, onDelete: RelationOnDeleteAction.SET_NULL, joinColumnName: 'pipelineId' },
  },
  universalIdentifier: STANDARD_OBJECTS.opportunity.fields.pipeline.universalIdentifier,
}),
createStandardRelationFieldFlatMetadata({
  objectName: 'opportunity', workspaceId,
  context: {
    type: FieldMetadataType.RELATION, morphId: null,
    fieldName: 'pipelineStage', label: i18nLabel(msg`Pipeline Stage`), icon: 'IconProgressCheck',
    isNullable: true, targetObjectName: 'pipelineStage', targetFieldName: 'opportunities',
    settings: { relationType: RelationType.MANY_TO_ONE, onDelete: RelationOnDeleteAction.SET_NULL, joinColumnName: 'pipelineStageId' },
  },
  universalIdentifier: STANDARD_OBJECTS.opportunity.fields.pipelineStage.universalIdentifier,
}),
```
Leave the legacy `stage` SELECT field intact (non-breaking); the board will use `pipelineStage`.

- [ ] **Step 3: Commit**
```bash
git add .../compute-pipeline-stage-standard-flat-field-metadata.util.ts .../compute-opportunity-standard-flat-field-metadata.util.ts
git commit -m "feat(server): pipelineStage builder + opportunity pipeline/pipelineStage relations"
```

---

### Task 5: Register objects + builders + indexes

**Files:**
- Modify: `.../utils/object-metadata/create-standard-flat-object-metadata.util.ts` (add `pipeline`, `pipelineStage` entries, ~line 554/852 satisfies block)
- Modify: `.../utils/field-metadata/build-standard-flat-field-metadata-maps.util.ts` (import + call the 2 new builders)
- Create/Modify: index builders under `.../utils/index/` for the new objects (mirror opportunity's index util) and register in `build-standard-flat-index-metadata-maps.util.ts`

**Interfaces:**
- Consumes: Tasks 1–4 outputs.
- Produces: a compiling `STANDARD_FLAT_OBJECT_METADATA_BUILDERS_BY_OBJECT_NAME` satisfying `{ [P in AllStandardObjectName]: ... }`.

- [ ] **Step 1:** Add `pipeline` and `pipelineStage` entries to the object builder map via `createStandardObjectFlatMetadata` (`nameSingular`, `namePlural`, labels, `icon`, `isSearchable: true`, `labelIdentifierFieldMetadataName: 'name'`).
- [ ] **Step 2:** Import and invoke `computePipelineStandardFlatFieldMetadata` / `computePipelineStageStandardFlatFieldMetadata` in the field-maps builder.
- [ ] **Step 3:** Add index builders (at minimum the default `name`/`position` and the relation FK indexes), register them.
- [ ] **Step 4: Typecheck** — Run: `npx nx typecheck twenty-server` — Expected: **PASS** (the satisfies constraint is now met).
- [ ] **Step 5: Commit**
```bash
git add .../create-standard-flat-object-metadata.util.ts .../build-standard-flat-field-metadata-maps.util.ts .../index/
git commit -m "feat(server): register pipeline/pipelineStage objects, fields, indexes"
```

---

### Task 6: Verify new workspaces materialize the schema (integration test)

**Files:**
- Test: add to the existing standard-application sync integration suite (find with `grep -rl "synchronizeTwentyStandardApplication" packages/twenty-server/src --include=*.integration-spec.ts`)

- [ ] **Step 1: Write failing test** asserting a freshly synced workspace has object metadata for `pipeline` and `pipelineStage`, and that `opportunity` has `pipelineId`/`pipelineStageId` columns.
```ts
it('creates pipeline + pipelineStage objects with opportunity relations', async () => {
  const objects = await objectMetadataRepository.find({ where: { workspaceId } });
  const names = objects.map((o) => o.nameSingular);
  expect(names).toEqual(expect.arrayContaining(['pipeline', 'pipelineStage']));
  const oppFields = await fieldMetadataRepository.find({ where: { objectMetadataId: opportunityObjectId } });
  expect(oppFields.map((f) => f.name)).toEqual(expect.arrayContaining(['pipeline', 'pipelineStage']));
});
```
- [ ] **Step 2: Run with DB reset** — Run: `npx nx run twenty-server:test:integration:with-db-reset` — Expected: PASS.
- [ ] **Step 3: Commit**
```bash
git commit -am "test(server): verify pipeline objects materialize on workspace sync"
```

---

### Task 7: Rollout workspace command for existing workspaces

**Files:**
- Create: `.../database/commands/upgrade-version-command/<ver>/<ver>-workspace-command-<ts>-sync-pipeline-standard-objects.command.ts`
- Modify: the matching `<ver>-upgrade-version-command.module.ts` (register the command provider)

**Interfaces:**
- Consumes: `ActiveOrSuspendedWorkspaceCommandRunner`, `computeTwentyStandardApplicationAllFlatEntityMaps`, `getStandardFlatEntitiesToCreateOrThrow`, `validateBuildAndRunWorkspaceMigration` (copy from the canonical template `2-10/...-sync-call-recording-standard-objects.command.ts`).

- [ ] **Step 1:** Copy the call-recording sync command template; swap target object names to `pipeline`/`pipelineStage` and the opportunity `pipeline`/`pipelineStage` fields. Add a **name-collision pre-check** (we created custom fields `pdPipeline`/`pdStage` and may have `pipeline`-named fields) — if a conflicting custom field exists on opportunity, rename it in a separate committed transaction before the create migration (mirror `call-recording-name-collision.util.ts`).
- [ ] **Step 2:** Decorate `@RegisteredWorkspaceCommand('<ver>', <timestamp>)`; implement `runOnWorkspace`.
- [ ] **Step 3: Dry-run locally** — Run: `npx nx run twenty-server:command upgrade:<ver>:sync-pipeline-standard-objects --dry-run` — Expected: lists create actions, no writes.
- [ ] **Step 4: Real run on local dev workspace** then verify via Postgres MCP that `workspace_<id>.pipeline` / `.pipelineStage` tables and `opportunity.pipelineId` exist.
- [ ] **Step 5: Commit**
```bash
git add .../upgrade-version-command/<ver>/
git commit -m "feat(server): workspace command to roll out pipelines to existing workspaces"
```

---

### Task 8: Seed a default pipeline + stages on rollout

**Files:**
- Modify: the Task 7 command (append seeding after object creation)

**Interfaces:**
- Produces: one `pipeline` row `{name:'Default', isDefault:true, position:0}` and N `pipelineStage` rows (mirror the legacy `stage` SELECT options: New/Screening/Meeting/Proposal/Customer) linked to it; existing opportunities with a legacy `stage` value get `pipeline`+`pipelineStage` set to the default mapping.

- [ ] **Step 1:** After objects exist, use the workspace ORM repositories to insert the default pipeline and its stages (position-ordered, copy colors from the legacy stage options).
- [ ] **Step 2:** Backfill existing opportunities: set `pipelineId = default`, and `pipelineStageId` = the default-pipeline stage whose name matches the opportunity's legacy `stage` label (fallback: first stage).
- [ ] **Step 3: Run + verify** with Postgres MCP that opportunities have non-null `pipelineId`/`pipelineStageId`.
- [ ] **Step 4: Commit**
```bash
git commit -am "feat(server): seed default pipeline + stages and backfill opportunities"
```

---

### Task 9: Allow Kanban grouping by the `pipelineStage` relation (verify + fix)

**Files:**
- Verify: `packages/twenty-front/src/modules/object-record/record-group/utils/canGroupRecordsByFieldMetadataItem.ts` (already allows MANY_TO_ONE)
- Verify/fix: `.../views/utils/mapViewGroupsToRecordGroupDefinitions.ts` (relation branch `mapRelationViewGroupsToRecordGroupDefinitions`)
- Test: `.../views/utils/__tests__/mapViewGroupsToRecordGroupDefinitions.test.ts`

- [ ] **Step 1: Write test** that `mapViewGroupsToRecordGroupDefinitions` produces one `RecordGroupDefinition` per `pipelineStage` viewGroup (relation field), with label = stage record name.
- [ ] **Step 2: Run** `npx nx test twenty-front -- mapViewGroupsToRecordGroupDefinitions` — Expected: PASS if already supported; if FAIL, implement the relation-label resolution (fetch related stage records by id, use `name`).
- [ ] **Step 3: Manual board check** on the live/dev instance: create a Kanban view on Opportunity grouped by `pipelineStage`, confirm columns render and drag-drop persists `pipelineStageId` (handler: `useUpdateDroppedRecordOnBoard.ts` → `updateOneRecord({ pipelineStageId })`).
- [ ] **Step 4: Commit**
```bash
git commit -am "test(front): verify board grouping by pipelineStage relation"
```

---

### Task 10: `usePipelines` hook + view sync util

**Files:**
- Create: `packages/twenty-front/src/modules/pipelines/hooks/usePipelines.ts`
- Create: `packages/twenty-front/src/modules/pipelines/utils/syncPipelineView.ts`

**Interfaces:**
- Produces:
  - `usePipelines(): { pipelines: PipelineRecord[]; loading: boolean }` — queries the `pipelines` object via `useFindManyRecords`, ordered by `position`.
  - `ensurePipelineView(pipeline): Promise<View>` — finds the Kanban view whose name === pipeline.name + grouped by `pipelineStage` + filtered `pipeline = pipeline.id`; creates it (with viewGroups for that pipeline's stages, ordered by stage.position) if absent. Uses existing view-create hooks.

- [ ] **Step 1:** Implement `usePipelines` with `useFindManyRecords({ objectNameSingular: 'pipeline', orderBy: [{ position: 'AscNullsLast' }] })`.
- [ ] **Step 2:** Implement `ensurePipelineView` reusing `useCreateViewFromCurrentState`/view APIs; viewGroups built from the pipeline's `pipelineStages` (fieldValue = stage id).
- [ ] **Step 3: Test** `usePipelines` with a mocked Apollo provider (returns ordered pipelines). Run `npx nx test twenty-front -- usePipelines` — Expected PASS.
- [ ] **Step 4: Commit**
```bash
git add packages/twenty-front/src/modules/pipelines/
git commit -m "feat(front): usePipelines hook + pipeline-view sync util"
```

---

### Task 11: Pipeline tab-switcher above the board

**Files:**
- Create: `packages/twenty-front/src/modules/pipelines/components/PipelineSwitcher.tsx`
- Modify: `packages/twenty-front/src/modules/object-record/record-index/components/RecordIndexPageHeader.tsx` (render `<PipelineSwitcher />` only when `objectNameSingular === 'opportunity'` and view type is KANBAN)

**Interfaces:**
- Consumes: `usePipelines`, `ensurePipelineView`, `useChangeView` (`.../views/hooks/useChangeView.ts`), `contextStoreCurrentViewIdComponentState`.
- Produces: a horizontal tab bar; clicking a pipeline calls `ensurePipelineView(pipeline)` then `changeView(view.id)`.

- [ ] **Step 1:** Implement `PipelineSwitcher` (Linaria-styled tab row, active tab from current view id).
- [ ] **Step 2:** Mount it in `RecordIndexPageHeader` behind the object/type guard.
- [ ] **Step 3: Storybook/interaction test** — add a story rendering 3 pipelines, assert clicking a tab calls `changeView`. Run `npx nx storybook:test twenty-front` (or component test). Expected PASS.
- [ ] **Step 4: Commit**
```bash
git add packages/twenty-front/src/modules/pipelines/components/PipelineSwitcher.tsx .../RecordIndexPageHeader.tsx
git commit -m "feat(front): pipeline tab switcher above opportunity board"
```

---

### Task 12: Settings — pipelines list (CRUD)

**Files:**
- Create: `packages/twenty-front/src/modules/settings/pipelines/components/SettingsPipelines.tsx`
- Modify: settings routes + nav (follow an existing settings page, e.g. `SettingsObjects`, as the template)

**Interfaces:**
- Consumes: `usePipelines`, `useCreateOneRecord`/`useDeleteOneRecord` for the `pipeline` object.
- Produces: list view with add/rename/delete/reorder/set-default; creating a pipeline also calls `ensurePipelineView`.

- [ ] **Step 1:** Build the list page mirroring an existing settings CRUD page's structure and styling.
- [ ] **Step 2:** Wire create/delete/rename/reorder (reorder writes `position`).
- [ ] **Step 3: Test** create→appears, delete→removed (mocked Apollo). Run `npx nx test twenty-front -- SettingsPipelines`. Expected PASS.
- [ ] **Step 4: Commit**
```bash
git add packages/twenty-front/src/modules/settings/pipelines/components/SettingsPipelines.tsx
git commit -m "feat(front): settings page to manage pipelines"
```

---

### Task 13: Settings — per-pipeline stage editor

**Files:**
- Create: `packages/twenty-front/src/modules/settings/pipelines/components/SettingsPipelineStagesEditor.tsx`
- Create: `packages/twenty-front/src/modules/settings/pipelines/hooks/useEditPipeline.ts`

**Interfaces:**
- Consumes: `useFindManyRecords` for `pipelineStage` filtered by `pipelineId`; record CRUD hooks.
- Produces: drag-reorder stage list with name + color; create/delete stage; on every change, re-sync the pipeline's Kanban view `viewGroups` via `ensurePipelineView`/view-group update APIs.

- [ ] **Step 1:** Build the stage editor (reorder via `@hello-pangea/dnd`, color picker reusing Twenty's `TagColor` palette).
- [ ] **Step 2:** `useEditPipeline` encapsulates stage create/update/delete + viewGroup re-sync.
- [ ] **Step 3: Test** add stage→view group added; reorder→positions persisted. Run `npx nx test twenty-front -- SettingsPipelineStagesEditor`. Expected PASS.
- [ ] **Step 4: Commit**
```bash
git add packages/twenty-front/src/modules/settings/pipelines/
git commit -m "feat(front): per-pipeline stage editor with view sync"
```

---

### Task 14: Pipeline change resets/maps stage in the record UI

**Files:**
- Modify: opportunity record detail field behavior — when `pipeline` changes, constrain/clear `pipelineStage` to the new pipeline's stages (hook into the field update path; find via `grep -r "useUpdateOneRecord" packages/twenty-front/src/modules/object-record/record-field`).

- [ ] **Step 1: Write test** that changing an opportunity's `pipeline` resets `pipelineStage` to the new pipeline's first stage.
- [ ] **Step 2:** Implement the reset in the field update handler.
- [ ] **Step 3: Run** `npx nx test twenty-front -- <test>` — Expected PASS.
- [ ] **Step 4: Commit**
```bash
git commit -am "feat(front): reset pipelineStage when opportunity pipeline changes"
```

---

### Task 15: Backend integrity query hook (stage ∈ pipeline)

**Files:**
- Create: `packages/twenty-server/src/modules/pipeline/query-hooks/validate-opportunity-pipeline-stage.pre-query-hook.ts`
- Create: `packages/twenty-server/src/modules/pipeline/pipeline.module.ts`
- Test: alongside the hook

**Interfaces:**
- Consumes: Twenty's `WorkspaceQueryHook` registration pattern (find with `grep -rl "WorkspacePreQueryHookInstance\|@WorkspaceQueryHook" packages/twenty-server/src`).
- Produces: a pre-create/pre-update hook on `opportunity` that throws if `pipelineStageId`'s pipeline ≠ `pipelineId`.

- [ ] **Step 1: Write failing test** asserting an update setting a mismatched `pipelineStageId` throws a validation error.
- [ ] **Step 2: Run** the test — Expected FAIL.
- [ ] **Step 3:** Implement the hook (load the stage, compare `stage.pipelineId` to the incoming/persisted `pipelineId`; throw `BadRequestException` on mismatch). Register in `pipeline.module.ts`; import the module where opportunity hooks are wired.
- [ ] **Step 4: Run** — Expected PASS.
- [ ] **Step 5: Commit**
```bash
git add packages/twenty-server/src/modules/pipeline/query-hooks/ packages/twenty-server/src/modules/pipeline/pipeline.module.ts
git commit -m "feat(server): enforce opportunity pipelineStage belongs to its pipeline"
```

---

### Task 16: Backfill the live instance's migrated `pdPipeline`/`pdStage` into native pipelines

**Files:**
- Create: a one-off script (scratchpad, same `lib.py` pattern as the migration) — not committed to the repo.

**Interfaces:**
- Consumes: Twenty REST/metadata API + the live instance's existing `pdPipeline` (6 values) / `pdStage` (13 values) SELECT data on 303 opportunities.

- [ ] **Step 1:** Create 6 `pipeline` records (the real names: Training and Consultancy (AI+), Hotels, Recruitment, Marketing, Australia Leads, Public AI Training).
- [ ] **Step 2:** For each pipeline create its `pipelineStage` records in the correct order/colors (from `stages.json` already pulled during migration).
- [ ] **Step 3:** For each of the 303 opportunities, set `pipelineId` from `pdPipeline` and `pipelineStageId` from `(pdPipeline, pdStage)` lookup; throttle to ≤90 req/min (reuse the token-bucket).
- [ ] **Step 4:** Run `ensurePipelineView` (or create views via API) so each pipeline has a Kanban board.
- [ ] **Step 5: Verify** reconciliation: every opportunity has pipeline+pipelineStage; per-pipeline view shows correct columns. (No commit — operational script.)

---

## Self-Review

**Spec coverage:**
- Multiple pipelines, each own stages → Tasks 1–5 (objects/relations), 8 (seed). ✓
- Deal in one pipeline+stage → Task 4 (relations), 8/16 (backfill). ✓
- Per-pipeline Kanban + drag → Tasks 9–11. ✓
- Custom pipelines (user-creatable) → Tasks 12–13 (settings CRUD). ✓
- Rollout to existing workspace → Tasks 7–8. ✓
- Integrity → Task 15. ✓
- Migrate existing data → Task 16. ✓

**Placeholder scan:** `<ver>`/`<ts>`/`<timestamp>` are intentional — fill from `npx nx run twenty-server:database:migrate:generate --name sync-pipelines --type fast` (it stamps the version/timestamp) and the current target version in `twenty-shared`. Frontend tasks reference real files but some exact JSX must be written against the live file (noted as "mirror existing X") — the implementer reads the cited template file first.

**Type consistency:** `pipeline`/`pipelineStage` object names, `pipelineId`/`pipelineStageId` join columns, and field names (`name`,`position`,`isDefault`,`color`,`pipelineStages`,`opportunities`) are used consistently across Tasks 1–16. `ensurePipelineView` defined in Task 10, consumed in 11/12/13/16.

**Key risk (carry into execution):** Task 9 — board grouping by a *relation* field is a less-trodden path than SELECT grouping. Verify it on the live instance **before** Phase 4; if the relation-board UX is poor, fall back to a per-pipeline SELECT stage field synced from `pipelineStage` records (adds a sync hook but uses the proven SELECT board path).

## Open decisions (resolve before/at execution)
1. **Legacy `stage` SELECT:** keep (non-breaking, plan assumes keep) vs deprecate/remove later.
2. **Win/Lost:** out of scope here; the migrated `pdStatus` custom field remains. Add native `status` later if desired.
3. **Plan split:** execute Phases 1–2 (backend, mergeable) first, then Phases 3–4 (frontend) as a second pass.
