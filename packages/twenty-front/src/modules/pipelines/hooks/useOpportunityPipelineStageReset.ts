import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { type PipelineStageRecord } from '@/pipelines/types/PipelineRecord';
import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';

// Resets the pipelineStage on an opportunity when its pipeline relation
// changes. Accepts the new pipeline's id (which is all the relation picker
// provides at runtime), fetches stages via a flat useFindManyRecords query
// (nested pipelineStages on pipeline is unreliable at runtime), then sets
// pipelineStageId to the first stage (lowest position) of the new pipeline,
// or null when the pipeline has no stages / the id is null.
// This is intentionally scoped to the opportunity object — it is only called
// from usePersistField when nameSingular === 'opportunity' and
// fieldName === 'pipeline'.
export const useOpportunityPipelineStageReset = () => {
  const { updateOneRecord } = useUpdateOneRecord();

  // Fetch all pipeline stages via a flat query — the nested relation on the
  // pipeline record does not reliably populate at runtime. useFindManyRecords
  // is called unconditionally (rules-of-hooks); Apollo caches the result so
  // the PipelineSwitcher and other callers share the same network request.
  const { records: allStages } = useFindManyRecords<PipelineStageRecord>({
    objectNameSingular: 'pipelineStage',
    recordGqlFields: {
      id: true,
      name: true,
      position: true,
      color: true,
      pipelineId: true,
    },
  });

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

      const stages = allStages.filter(
        (stage) => stage.pipelineId === pipelineId,
      );

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
    [allStages, updateOneRecord],
  );

  return { resetPipelineStage };
};
