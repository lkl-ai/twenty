import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { type PipelineRecord } from '@/pipelines/types/PipelineRecord';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';

// Resets the pipelineStage on an opportunity when its pipeline relation
// changes. Sets pipelineStageId to the first stage (lowest position) of the
// new pipeline, or clears it (null) when the new pipeline has no stages.
// This is intentionally scoped to the opportunity object — it is only called
// from usePersistField when nameSingular === 'opportunity' and
// fieldName === 'pipeline'.
export const useOpportunityPipelineStageReset = () => {
  const { updateOneRecord } = useUpdateOneRecord();

  const resetPipelineStage = useCallback(
    async ({
      opportunityId,
      newPipeline,
    }: {
      opportunityId: string;
      newPipeline: PipelineRecord | null | undefined;
    }) => {
      if (!isDefined(newPipeline)) {
        await updateOneRecord({
          objectNameSingular: 'opportunity',
          idToUpdate: opportunityId,
          updateOneRecordInput: { pipelineStageId: null },
        });
        return;
      }

      const stages =
        newPipeline.pipelineStages?.edges.map((edge) => edge.node) ?? [];

      const sortedStages = [...stages].sort((a, b) => a.position - b.position);

      const firstStage = sortedStages[0];

      await updateOneRecord({
        objectNameSingular: 'opportunity',
        idToUpdate: opportunityId,
        updateOneRecordInput: {
          pipelineStageId: firstStage?.id ?? null,
        },
      });
    },
    [updateOneRecord],
  );

  return { resetPipelineStage };
};
