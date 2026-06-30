import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { usePipelines } from '@/pipelines/hooks/usePipelines';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';

// Resets the pipelineStage on an opportunity when its pipeline relation
// changes. Accepts the new pipeline's id (which is all the relation picker
// provides at runtime), resolves the full pipeline record with embedded stages
// from the Apollo-cached usePipelines result, then sets pipelineStageId to the
// first stage (lowest position) of that pipeline, or null when the pipeline has
// no stages / the id is null.
// This is intentionally scoped to the opportunity object — it is only called
// from usePersistField when nameSingular === 'opportunity' and
// fieldName === 'pipeline'.
export const useOpportunityPipelineStageReset = () => {
  const { updateOneRecord } = useUpdateOneRecord();

  // usePipelines is called unconditionally (rules-of-hooks). Its result is
  // Apollo-cached — the relation picker already rendered from this same list,
  // so no extra network request is made here.
  const { pipelines } = usePipelines();

  const resetPipelineStage = useCallback(
    async ({
      opportunityId,
      pipelineId,
    }: {
      opportunityId: string;
      pipelineId: string | null | undefined;
    }) => {
      if (!isDefined(pipelineId)) {
        await updateOneRecord({
          objectNameSingular: 'opportunity',
          idToUpdate: opportunityId,
          updateOneRecordInput: { pipelineStageId: null },
        });
        return;
      }

      const pipeline = pipelines.find((p) => p.id === pipelineId);

      const stages =
        pipeline?.pipelineStages?.edges.map((edge) => edge.node) ?? [];

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
    [pipelines, updateOneRecord],
  );

  return { resetPipelineStage };
};
