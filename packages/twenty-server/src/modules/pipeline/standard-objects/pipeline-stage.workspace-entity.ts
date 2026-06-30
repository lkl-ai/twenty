import { BaseWorkspaceEntity } from 'src/engine/twenty-orm/base.workspace-entity';
import { type EntityRelation } from 'src/engine/workspace-manager/workspace-migration/types/entity-relation.interface';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PipelineWorkspaceEntity } from 'src/modules/pipeline/standard-objects/pipeline.workspace-entity';

export class PipelineStageWorkspaceEntity extends BaseWorkspaceEntity {
  name: string;
  position: number;
  color: string;
  pipeline: EntityRelation<PipelineWorkspaceEntity>;
  opportunities: EntityRelation<OpportunityWorkspaceEntity[]>;
}
