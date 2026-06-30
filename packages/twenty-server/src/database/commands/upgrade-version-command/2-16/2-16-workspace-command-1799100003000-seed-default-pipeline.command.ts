import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';
import { IsNull } from 'typeorm';

import { ActiveOrSuspendedWorkspaceCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { findFlatEntityByUniversalIdentifier } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type RolePermissionConfig } from 'src/engine/twenty-orm/types/role-permission-config';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PipelineStageWorkspaceEntity } from 'src/modules/pipeline/standard-objects/pipeline-stage.workspace-entity';
import { type PipelineWorkspaceEntity } from 'src/modules/pipeline/standard-objects/pipeline.workspace-entity';

// Legacy opportunity stage → pipeline stage seed data.
// Mirrors the SELECT options in compute-opportunity-standard-flat-field-metadata.util.ts.
const LEGACY_STAGE_SEEDS = [
  { value: 'NEW', label: 'New', position: 0, color: 'red' },
  { value: 'SCREENING', label: 'Screening', position: 1, color: 'purple' },
  { value: 'MEETING', label: 'Meeting', position: 2, color: 'sky' },
  { value: 'PROPOSAL', label: 'Proposal', position: 3, color: 'turquoise' },
  { value: 'CUSTOMER', label: 'Customer', position: 4, color: 'yellow' },
] as const;

const BYPASS_PERMISSIONS: RolePermissionConfig = {
  shouldBypassPermissionChecks: true,
};

@RegisteredWorkspaceCommand('2.16.0', 1799100003000)
@Command({
  name: 'upgrade:2-16:seed-default-pipeline',
  description:
    'Seed a default Pipeline + PipelineStage records and backfill existing opportunities',
})
export class SeedDefaultPipelineCommand extends ActiveOrSuspendedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly twentyORMGlobalManager: GlobalWorkspaceOrmManager,
    private readonly workspaceCacheService: WorkspaceCacheService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    // Guard: skip workspaces that do not yet have the pipeline object
    // (i.e. Task 7 hasn't run for them yet).
    const { flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatObjectMetadataMaps',
      ]);

    const pipelineObject =
      findFlatEntityByUniversalIdentifier<FlatObjectMetadata>({
        flatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier: STANDARD_OBJECTS.pipeline.universalIdentifier,
      });

    if (!isDefined(pipelineObject)) {
      this.logger.log(
        `pipeline object not found for workspace ${workspaceId}, skipping seed`,
      );

      return;
    }

    const pipelineStageObject =
      findFlatEntityByUniversalIdentifier<FlatObjectMetadata>({
        flatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier:
          STANDARD_OBJECTS.pipelineStage.universalIdentifier,
      });

    if (!isDefined(pipelineStageObject)) {
      this.logger.log(
        `pipelineStage object not found for workspace ${workspaceId}, skipping seed`,
      );

      return;
    }

    const pipelineRepository =
      await this.twentyORMGlobalManager.getRepository<PipelineWorkspaceEntity>(
        workspaceId,
        'pipeline',
        BYPASS_PERMISSIONS,
      );

    // Idempotency: if any pipeline already exists, skip creation.
    const existingPipelines = await pipelineRepository.find();

    if (existingPipelines.length > 0) {
      this.logger.log(
        `Workspace ${workspaceId} already has ${existingPipelines.length} pipeline(s), skipping seed`,
      );

      return;
    }

    if (isDryRun) {
      this.logger.log(
        `[DRY RUN] Would seed default pipeline + ${LEGACY_STAGE_SEEDS.length} stages for workspace ${workspaceId}`,
      );

      return;
    }

    // Create the default pipeline record.
    const savedPipeline = (await pipelineRepository.save({
      name: 'Default',
      isDefault: true,
      position: 0,
    } as unknown as PipelineWorkspaceEntity)) as PipelineWorkspaceEntity;

    this.logger.log(
      `Created default pipeline ${savedPipeline.id} for workspace ${workspaceId}`,
    );

    // Create pipeline stage records linked to the default pipeline.
    const pipelineStageRepository =
      await this.twentyORMGlobalManager.getRepository<PipelineStageWorkspaceEntity>(
        workspaceId,
        'pipelineStage',
        BYPASS_PERMISSIONS,
      );

    const savedStages: PipelineStageWorkspaceEntity[] = [];

    for (const seed of LEGACY_STAGE_SEEDS) {
      const savedStage = (await pipelineStageRepository.save({
        name: seed.label,
        position: seed.position,
        color: seed.color,
        pipelineId: savedPipeline.id,
      } as unknown as PipelineStageWorkspaceEntity)) as PipelineStageWorkspaceEntity;

      savedStages.push(savedStage);
    }

    this.logger.log(
      `Created ${savedStages.length} pipeline stages for workspace ${workspaceId}`,
    );

    // Build a stage lookup map: legacy stage value → savedStage id.
    const stageValueToStageId = new Map<string, string>(
      LEGACY_STAGE_SEEDS.map((seed, index) => [
        seed.value,
        savedStages[index].id,
      ]),
    );

    const firstStageId = savedStages[0]?.id;

    // Backfill existing opportunities that have no pipelineId yet.
    const opportunityRepository =
      await this.twentyORMGlobalManager.getRepository<OpportunityWorkspaceEntity>(
        workspaceId,
        'opportunity',
        BYPASS_PERMISSIONS,
      );

    const opportunities = await opportunityRepository.find({
      where: {
        pipelineId: IsNull(),
      } as unknown as Record<string, unknown>,
    });

    let backfilledCount = 0;

    for (const opportunity of opportunities) {
      const legacyStage = opportunity.stage as string;
      const matchedStageId =
        stageValueToStageId.get(legacyStage) ?? firstStageId;

      if (!isDefined(matchedStageId)) {
        continue;
      }

      await opportunityRepository.update(
        opportunity.id,
        {
          pipelineId: savedPipeline.id,
          pipelineStageId: matchedStageId,
        } as unknown as Record<string, unknown>,
      );

      backfilledCount++;
    }

    this.logger.log(
      `Backfilled ${backfilledCount} opportunities for workspace ${workspaceId}`,
    );
  }
}
