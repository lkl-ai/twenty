import { BadRequestException, Injectable } from '@nestjs/common';

import { isDefined } from 'twenty-shared/utils';

import { type WorkspacePreQueryHookInstance } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/interfaces/workspace-query-hook.interface';
import {
  type CreateOneResolverArgs,
  type ResolverArgs,
  type UpdateOneResolverArgs,
} from 'src/engine/api/graphql/workspace-resolver-builder/interfaces/workspace-resolvers-builder.interface';

import { WorkspaceQueryHook } from 'src/engine/api/graphql/workspace-query-runner/workspace-query-hook/decorators/workspace-query-hook.decorator';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PipelineStageWorkspaceEntity } from 'src/modules/pipeline/standard-objects/pipeline-stage.workspace-entity';

// The join-column scalar IDs are stored at runtime even though the typed
// entity class only declares the relation object.
type OpportunityRecord = OpportunityWorkspaceEntity & {
  pipelineId: string | null;
  pipelineStageId: string | null;
};

type OpportunityPayload = Partial<OpportunityRecord>;

// Shared validation logic — used by both createOne and updateOne hooks.
export async function validatePipelineStageConsistency({
  workspaceId,
  incomingPipelineId,
  incomingPipelineStageId,
  existingOpportunityId,
  globalWorkspaceOrmManager,
}: {
  workspaceId: string;
  incomingPipelineId: string | null | undefined;
  incomingPipelineStageId: string | null | undefined;
  existingOpportunityId: string | undefined;
  globalWorkspaceOrmManager: GlobalWorkspaceOrmManager;
}): Promise<void> {
  // Nothing to validate if stage is null/undefined — no constraint to violate.
  if (!isDefined(incomingPipelineStageId)) {
    return;
  }

  // Resolve the effective pipelineId: prefer the incoming value; fall back to
  // the persisted one (needed for partial updates that only change the stage).
  let effectivePipelineId: string | null | undefined = incomingPipelineId;

  if (!isDefined(effectivePipelineId) && isDefined(existingOpportunityId)) {
    const opportunityRepository =
      await globalWorkspaceOrmManager.getRepository<OpportunityRecord>(
        workspaceId,
        'opportunity',
      );

    const existing = await opportunityRepository.findOne({
      where: { id: existingOpportunityId } as unknown as Record<
        string,
        unknown
      >,
    });

    effectivePipelineId = existing?.pipelineId ?? null;
  }

  // If there is no pipeline on this opportunity, the stage is a free-float —
  // allow it.
  if (!isDefined(effectivePipelineId)) {
    return;
  }

  // Load the pipeline stage and verify it belongs to the effective pipeline.
  const pipelineStageRepository = await globalWorkspaceOrmManager.getRepository<
    PipelineStageWorkspaceEntity & { pipelineId: string | null }
  >(workspaceId, 'pipelineStage');

  const stage = await pipelineStageRepository.findOne({
    where: {
      id: incomingPipelineStageId,
    } as unknown as Record<string, unknown>,
  });

  if (!isDefined(stage)) {
    throw new BadRequestException(
      `Pipeline stage ${incomingPipelineStageId} not found`,
    );
  }

  if (stage.pipelineId !== effectivePipelineId) {
    throw new BadRequestException(
      `Pipeline stage ${incomingPipelineStageId} does not belong to pipeline ${effectivePipelineId}`,
    );
  }
}

@Injectable()
@WorkspaceQueryHook('opportunity.createOne')
export class ValidateOpportunityPipelineStageCreateOnePreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: CreateOneResolverArgs<OpportunityPayload>,
  ): Promise<ResolverArgs> {
    await validatePipelineStageConsistency({
      workspaceId: authContext.workspace.id,
      incomingPipelineId: payload.data.pipelineId,
      incomingPipelineStageId: payload.data.pipelineStageId,
      existingOpportunityId: undefined,
      globalWorkspaceOrmManager: this.globalWorkspaceOrmManager,
    });

    return payload;
  }
}

@Injectable()
@WorkspaceQueryHook('opportunity.updateOne')
export class ValidateOpportunityPipelineStageUpdateOnePreQueryHook implements WorkspacePreQueryHookInstance {
  constructor(
    private readonly globalWorkspaceOrmManager: GlobalWorkspaceOrmManager,
  ) {}

  async execute(
    authContext: WorkspaceAuthContext,
    _objectName: string,
    payload: UpdateOneResolverArgs<OpportunityPayload>,
  ): Promise<ResolverArgs> {
    await validatePipelineStageConsistency({
      workspaceId: authContext.workspace.id,
      incomingPipelineId: payload.data.pipelineId,
      incomingPipelineStageId: payload.data.pipelineStageId,
      existingOpportunityId: payload.id,
      globalWorkspaceOrmManager: this.globalWorkspaceOrmManager,
    });

    return payload;
  }
}
