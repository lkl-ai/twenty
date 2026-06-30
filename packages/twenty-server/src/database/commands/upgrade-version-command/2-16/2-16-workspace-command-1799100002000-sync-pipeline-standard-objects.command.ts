import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';

import { ActiveOrSuspendedWorkspaceCommandRunner } from 'src/database/commands/command-runners/active-or-suspended-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import {
  getExistingOrStandardFlatEntityOrThrow,
  getStandardFlatEntitiesToCreateOrThrow,
} from 'src/database/commands/upgrade-version-command/2-10/utils/get-standard-flat-entities-to-create-or-throw.util';
import { buildNavigationCommandMenuItemOperationsOrThrow } from 'src/database/commands/upgrade-version-command/2-10/utils/build-navigation-command-menu-item-operations-or-throw.util';
import { buildOpportunityFieldRenameUpdatesForPipeline } from 'src/database/commands/upgrade-version-command/2-16/utils/pipeline-name-collision.util';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatIndexMetadata } from 'src/engine/metadata-modules/flat-index-metadata/types/flat-index-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const getUniversalIdentifiers = (
  entitiesByName: Record<string, { universalIdentifier: string }>,
): string[] =>
  Object.values(entitiesByName).map((entity) => entity.universalIdentifier);

// pipeline object
const PIPELINE_OBJECT_METADATA_UNIVERSAL_IDENTIFIERS = [
  STANDARD_OBJECTS.pipeline.universalIdentifier,
];

const PIPELINE_FIELD_METADATA_UNIVERSAL_IDENTIFIERS = [
  ...getUniversalIdentifiers(STANDARD_OBJECTS.pipeline.fields),
];

const PIPELINE_INDEX_UNIVERSAL_IDENTIFIERS = getUniversalIdentifiers(
  STANDARD_OBJECTS.pipeline.indexes,
);

// pipelineStage object
const PIPELINE_STAGE_OBJECT_METADATA_UNIVERSAL_IDENTIFIERS = [
  STANDARD_OBJECTS.pipelineStage.universalIdentifier,
];

const PIPELINE_STAGE_FIELD_METADATA_UNIVERSAL_IDENTIFIERS = [
  ...getUniversalIdentifiers(STANDARD_OBJECTS.pipelineStage.fields),
];

const PIPELINE_STAGE_INDEX_UNIVERSAL_IDENTIFIERS = getUniversalIdentifiers(
  STANDARD_OBJECTS.pipelineStage.indexes,
);

// opportunity pipeline/pipelineStage relation fields
const OPPORTUNITY_PIPELINE_FIELD_METADATA_UNIVERSAL_IDENTIFIERS = [
  STANDARD_OBJECTS.opportunity.fields.pipeline.universalIdentifier,
  STANDARD_OBJECTS.opportunity.fields.pipelineStage.universalIdentifier,
];

const OPPORTUNITY_PIPELINE_INDEX_UNIVERSAL_IDENTIFIERS = [
  STANDARD_OBJECTS.opportunity.indexes.pipelineIdIndex.universalIdentifier,
  STANDARD_OBJECTS.opportunity.indexes.pipelineStageIdIndex.universalIdentifier,
];

@RegisteredWorkspaceCommand('2.16.0', 1799100002000)
@Command({
  name: 'upgrade:2-16:sync-pipeline-standard-objects',
  description:
    'Create the Pipeline and PipelineStage standard metadata in existing workspaces',
})
export class SyncPipelineStandardObjectsCommand extends ActiveOrSuspendedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const isDryRun = options.dryRun ?? false;

    const {
      flatObjectMetadataMaps,
      flatFieldMetadataMaps,
      flatIndexMaps,
      flatCommandMenuItemMaps,
    } = await this.workspaceCacheService.getOrRecompute(workspaceId, [
      'flatObjectMetadataMaps',
      'flatFieldMetadataMaps',
      'flatIndexMaps',
      'flatCommandMenuItemMaps',
    ]);

    const opportunityObjectMetadata =
      flatObjectMetadataMaps.byUniversalIdentifier[
        STANDARD_OBJECTS.opportunity.universalIdentifier
      ];

    if (!opportunityObjectMetadata) {
      this.logger.warn(
        `opportunity object not found for workspace ${workspaceId}, skipping Pipeline standard metadata sync`,
      );

      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const now = new Date().toISOString();

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now,
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const fieldMetadataRenameUpdates =
      buildOpportunityFieldRenameUpdatesForPipeline({
        flatFieldMetadataMaps,
        now,
      });

    const pipelineObjectMetadataForNavigation =
      getExistingOrStandardFlatEntityOrThrow<FlatObjectMetadata>({
        standardFlatEntityMaps:
          standardAllFlatEntityMaps.flatObjectMetadataMaps,
        existingFlatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier: STANDARD_OBJECTS.pipeline.universalIdentifier,
      });

    const pipelineStageObjectMetadataForNavigation =
      getExistingOrStandardFlatEntityOrThrow<FlatObjectMetadata>({
        standardFlatEntityMaps:
          standardAllFlatEntityMaps.flatObjectMetadataMaps,
        existingFlatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier: STANDARD_OBJECTS.pipelineStage.universalIdentifier,
      });

    const navigationCommandMenuItemOperations =
      buildNavigationCommandMenuItemOperationsOrThrow({
        existingFlatCommandMenuItemMaps: flatCommandMenuItemMaps,
        objectMetadatasForNavigation: [
          pipelineObjectMetadataForNavigation,
          pipelineStageObjectMetadataForNavigation,
        ],
        applicationId: twentyStandardFlatApplication.id,
        workspaceId,
        now,
        renamedCollisionObjectMetadatas: [],
      });

    const allFlatEntityOperationByMetadataName = {
      objectMetadata: {
        flatEntityToCreate: [
          ...getStandardFlatEntitiesToCreateOrThrow<FlatObjectMetadata>({
            standardFlatEntityMaps:
              standardAllFlatEntityMaps.flatObjectMetadataMaps,
            existingFlatEntityMaps: flatObjectMetadataMaps,
            universalIdentifiers:
              PIPELINE_OBJECT_METADATA_UNIVERSAL_IDENTIFIERS,
          }),
          ...getStandardFlatEntitiesToCreateOrThrow<FlatObjectMetadata>({
            standardFlatEntityMaps:
              standardAllFlatEntityMaps.flatObjectMetadataMaps,
            existingFlatEntityMaps: flatObjectMetadataMaps,
            universalIdentifiers:
              PIPELINE_STAGE_OBJECT_METADATA_UNIVERSAL_IDENTIFIERS,
          }),
        ],
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      fieldMetadata: {
        flatEntityToCreate: [
          ...getStandardFlatEntitiesToCreateOrThrow<FlatFieldMetadata>({
            standardFlatEntityMaps:
              standardAllFlatEntityMaps.flatFieldMetadataMaps,
            existingFlatEntityMaps: flatFieldMetadataMaps,
            universalIdentifiers: PIPELINE_FIELD_METADATA_UNIVERSAL_IDENTIFIERS,
          }),
          ...getStandardFlatEntitiesToCreateOrThrow<FlatFieldMetadata>({
            standardFlatEntityMaps:
              standardAllFlatEntityMaps.flatFieldMetadataMaps,
            existingFlatEntityMaps: flatFieldMetadataMaps,
            universalIdentifiers:
              PIPELINE_STAGE_FIELD_METADATA_UNIVERSAL_IDENTIFIERS,
          }),
          ...getStandardFlatEntitiesToCreateOrThrow<FlatFieldMetadata>({
            standardFlatEntityMaps:
              standardAllFlatEntityMaps.flatFieldMetadataMaps,
            existingFlatEntityMaps: flatFieldMetadataMaps,
            universalIdentifiers:
              OPPORTUNITY_PIPELINE_FIELD_METADATA_UNIVERSAL_IDENTIFIERS,
          }),
        ],
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      index: {
        flatEntityToCreate: [
          ...getStandardFlatEntitiesToCreateOrThrow<FlatIndexMetadata>({
            standardFlatEntityMaps: standardAllFlatEntityMaps.flatIndexMaps,
            existingFlatEntityMaps: flatIndexMaps,
            universalIdentifiers: PIPELINE_INDEX_UNIVERSAL_IDENTIFIERS,
          }),
          ...getStandardFlatEntitiesToCreateOrThrow<FlatIndexMetadata>({
            standardFlatEntityMaps: standardAllFlatEntityMaps.flatIndexMaps,
            existingFlatEntityMaps: flatIndexMaps,
            universalIdentifiers: PIPELINE_STAGE_INDEX_UNIVERSAL_IDENTIFIERS,
          }),
          ...getStandardFlatEntitiesToCreateOrThrow<FlatIndexMetadata>({
            standardFlatEntityMaps: standardAllFlatEntityMaps.flatIndexMaps,
            existingFlatEntityMaps: flatIndexMaps,
            universalIdentifiers:
              OPPORTUNITY_PIPELINE_INDEX_UNIVERSAL_IDENTIFIERS,
          }),
        ],
        flatEntityToDelete: [],
        flatEntityToUpdate: [],
      },
      commandMenuItem: navigationCommandMenuItemOperations,
    };

    const totalOperationCount =
      fieldMetadataRenameUpdates.length +
      Object.values(allFlatEntityOperationByMetadataName).reduce(
        (total, operations) =>
          total +
          operations.flatEntityToCreate.length +
          operations.flatEntityToUpdate.length,
        0,
      );

    if (totalOperationCount === 0) {
      this.logger.log(
        `Pipeline standard metadata already exists for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    if (isDryRun) {
      if (fieldMetadataRenameUpdates.length > 0) {
        this.logger.log(
          `[DRY RUN] Would rename ${fieldMetadataRenameUpdates.length} opportunity field name collision(s) for workspace ${workspaceId}`,
        );
      }

      this.logger.log(
        `[DRY RUN] Would apply ${totalOperationCount} Pipeline standard metadata operations for workspace ${workspaceId}`,
      );

      return;
    }

    // Renames must commit before the create: a combined create + rename
    // migration trips the name unique index.
    const collisionRenameMigrations = fieldMetadataRenameUpdates.map(
      (flatFieldMetadata) => ({
        applicationUniversalIdentifier:
          flatFieldMetadata.applicationUniversalIdentifier,
        allFlatEntityOperationByMetadataName: {
          fieldMetadata: {
            flatEntityToCreate: [],
            flatEntityToDelete: [],
            flatEntityToUpdate: [flatFieldMetadata],
          },
        },
      }),
    );

    for (const {
      applicationUniversalIdentifier,
      allFlatEntityOperationByMetadataName,
    } of collisionRenameMigrations) {
      const renameResult =
        await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
          {
            isSystemBuild: true,
            applicationUniversalIdentifier,
            workspaceId,
            allFlatEntityOperationByMetadataName,
          },
        );

      if (renameResult.status === 'fail') {
        throw new Error(
          `Failed to rename Pipeline field name collision for workspace ${workspaceId}: ${JSON.stringify(
            renameResult,
            null,
            2,
          )}`,
        );
      }
    }

    const validateAndBuildResult =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          isSystemBuild: true,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
          workspaceId,
          allFlatEntityOperationByMetadataName,
        },
      );

    if (validateAndBuildResult.status === 'fail') {
      throw new Error(
        `Failed to create Pipeline standard objects for workspace ${workspaceId}: ${JSON.stringify(
          validateAndBuildResult,
          null,
          2,
        )}`,
      );
    }

    this.logger.log(
      `Applied ${totalOperationCount} Pipeline standard metadata operations for workspace ${workspaceId}`,
    );
  }
}
