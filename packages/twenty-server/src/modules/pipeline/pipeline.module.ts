import { Module } from '@nestjs/common';

import {
  ValidateOpportunityPipelineStageCreateOnePreQueryHook,
  ValidateOpportunityPipelineStageUpdateOnePreQueryHook,
} from 'src/modules/pipeline/query-hooks/validate-opportunity-pipeline-stage.pre-query-hook';

@Module({
  providers: [
    ValidateOpportunityPipelineStageCreateOnePreQueryHook,
    ValidateOpportunityPipelineStageUpdateOnePreQueryHook,
  ],
})
export class PipelineModule {}
