import { useCallback } from 'react';
import { v4 } from 'uuid';

import { useMutation } from '@apollo/client/react';

import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { type PipelineRecord, type PipelineStageRecord } from '@/pipelines/types/PipelineRecord';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { viewsSelector } from '@/views/states/selectors/viewsSelector';
import {
  CreateManyViewGroupsDocument,
  CreateViewDocument,
  ViewOpenRecordIn,
  ViewType,
  ViewVisibility,
} from '~/generated-metadata/graphql';
import { isDefined } from 'twenty-shared/utils';

// Returns a callback that finds the Opportunity Kanban view for the given
// pipeline (matched by name + mainGroupByFieldMetadataId = pipelineStage field)
// and creates it — with one ViewGroup per stage — when absent.
export const useEnsurePipelineView = () => {
  const { objectMetadataItem: opportunityMetadataItem } = useObjectMetadataItem(
    { objectNameSingular: 'opportunity' },
  );

  // pipelineStage relation field on Opportunity
  const pipelineStageField = opportunityMetadataItem.fields?.find(
    (field) => field.name === 'pipelineStage',
  );

  const allViews = useAtomStateValue(viewsSelector);

  const [createViewMutation] = useMutation(CreateViewDocument);
  const [createManyViewGroupsMutation] = useMutation(
    CreateManyViewGroupsDocument,
  );

  const ensurePipelineView = useCallback(
    async (
      pipeline: PipelineRecord,
      stages: PipelineStageRecord[],
    ): Promise<string | undefined> => {
      if (!isDefined(pipelineStageField)) {
        return undefined;
      }

      const opportunityObjectMetadataId = opportunityMetadataItem.id;

      // Find an existing Kanban view for Opportunity whose name matches
      // this pipeline and is grouped by the pipelineStage relation field.
      const existingView = allViews.find(
        (view) =>
          view.objectMetadataId === opportunityObjectMetadataId &&
          view.type === ViewType.KANBAN &&
          view.name === pipeline.name &&
          view.mainGroupByFieldMetadataId === pipelineStageField.id,
      );

      if (isDefined(existingView)) {
        return existingView.id;
      }

      // No matching view — create one.
      const newViewId = v4();

      const createViewResult = await createViewMutation({
        variables: {
          input: {
            id: newViewId,
            name: pipeline.name,
            icon: 'IconLayoutKanban',
            type: ViewType.KANBAN,
            objectMetadataId: opportunityObjectMetadataId,
            mainGroupByFieldMetadataId: pipelineStageField.id,
            openRecordIn: ViewOpenRecordIn.RECORD_PAGE,
            visibility: ViewVisibility.WORKSPACE,
            key: null,
          },
        },
      });

      if (!isDefined(createViewResult.data?.createView)) {
        return undefined;
      }

      // Sort stages by position so board columns render in order.
      const sortedStages = [...stages].sort(
        (stageA, stageB) => stageA.position - stageB.position,
      );

      // Create one ViewGroup per stage — fieldValue = stage UUID (required for
      // relation-grouped boards; SELECT-option logic in useViewsSideEffectsOnViewGroups
      // only seeds options, not relation records, so we must do this explicitly).
      if (sortedStages.length > 0) {
        await createManyViewGroupsMutation({
          variables: {
            inputs: sortedStages.map((stage, index) => ({
              id: v4(),
              viewId: newViewId,
              fieldValue: stage.id,
              position: index,
              isVisible: true,
            })),
          },
        });
      }

      return newViewId;
    },
    [
      allViews,
      opportunityMetadataItem.id,
      pipelineStageField,
      createViewMutation,
      createManyViewGroupsMutation,
    ],
  );

  return { ensurePipelineView };
};
