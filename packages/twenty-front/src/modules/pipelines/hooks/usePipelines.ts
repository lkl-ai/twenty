import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type PipelineRecord } from '@/pipelines/types/PipelineRecord';

export type UsePipelinesResult = {
  pipelines: PipelineRecord[];
  loading: boolean;
};

// Queries all pipeline records ordered by position ascending.
// Mirrors the pattern used in useFindManyRecordsSelectedInContextStore.
export const usePipelines = (): UsePipelinesResult => {
  const { records, loading } = useFindManyRecords<PipelineRecord>({
    objectNameSingular: 'pipeline',
    orderBy: [{ position: 'AscNullsLast' }],
    recordGqlFields: {
      id: true,
      name: true,
      position: true,
      pipelineStages: {
        edges: {
          node: {
            id: true,
            name: true,
            position: true,
            pipelineId: true,
          },
        },
      },
    },
  });

  return { pipelines: records, loading };
};
