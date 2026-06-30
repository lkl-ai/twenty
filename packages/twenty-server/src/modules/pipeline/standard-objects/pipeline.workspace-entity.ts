import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PipelineStageWorkspaceEntity } from 'src/modules/pipeline/standard-objects/pipeline-stage.workspace-entity';

export class PipelineWorkspaceEntity extends BaseWorkspaceEntity {
  name: string;
  position: number;
  isDefault: boolean;
  pipelineStages: EntityRelation<PipelineStageWorkspaceEntity[]>;
  opportunities: EntityRelation<OpportunityWorkspaceEntity[]>;
}
