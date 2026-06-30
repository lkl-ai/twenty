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
  CreateViewFilterDocument,
  ViewFilterOperand,
  ViewOpenRecordIn,
  ViewType,
  ViewVisibility,
} from '~/generated-metadata/graphql';
import { isDefined } from 'twenty-shared/utils';

// Returns a callback that finds the Opportunity Kanban view for the given
// pipeline (matched by name + mainGroupByFieldMetadataId = pipelineStage field
// + a pipeline IS-filter on that pipeline's id) and creates it — with one
// ViewGroup per stage and a pipeline ViewFilter — when absent.
export const useEnsurePipelineView = () => {
  const { objectMetadataItem: opportunityMetadataItem } = useObjectMetadataItem(
    { objectNameSingular: 'opportunity' },
  );

  // pipelineStage relation field on Opportunity
  const pipelineStageField = opportunityMetadataItem.fields?.find(
    (field) => field.name === 'pipelineStage',
  );

  // pipeline relation field on Opportunity (used for scoping the board)
  const pipelineField = opportunityMetadataItem.fields?.find(
    (field) => field.name === 'pipeline',
  );

  const allViews = useAtomStateValue(viewsSelector);

  const [createViewMutation] = useMutation(CreateViewDocument);
  const [createManyViewGroupsMutation] = useMutation(
    CreateManyViewGroupsDocument,
  );
  const [createViewFilterMutation] = useMutation(CreateViewFilterDocument);

  const ensurePipelineView = useCallback(
    async (
      pipeline: PipelineRecord,
      stages: PipelineStageRecord[],
    ): Promise<string | undefined> => {
      if (!isDefined(pipelineStageField)) {
        return undefined;
      }

      const opportunityObjectMetadataId = opportunityMetadataItem.id;

      // The relation filter value for `pipeline IS <pipelineId>`.
      // RELATION fields use operand IS with a JSON value containing selectedRecordIds.
      const pipelineFilterValue = JSON.stringify({
        isCurrentWorkspaceMemberSelected: false,
        selectedRecordIds: [pipeline.id],
      });

      // Find an existing Kanban view for Opportunity whose name matches this
      // pipeline, is grouped by the pipelineStage relation field, and is
      // already scoped to this pipeline via a pipeline IS-filter.
      // Checking the filter prevents two same-named pipelines from colliding.
      const existingView = allViews.find((view) => {
        if (
          view.objectMetadataId !== opportunityObjectMetadataId ||
          view.type !== ViewType.KANBAN ||
          view.name !== pipeline.name ||
          view.mainGroupByFieldMetadataId !== pipelineStageField.id
        ) {
          return false;
        }

        // If no pipeline field metadata is available yet we fall back to
        // name + groupBy matching (safe because pipeline field lookup is
        // best-effort — the filter will be added on first creation).
        if (!isDefined(pipelineField)) {
          return true;
        }

        return view.viewFilters.some((filter) => {
          if (filter.fieldMetadataId !== pipelineField.id) {
            return false;
          }
          // Both enums share the same string value 'IS'; compare as string to
          // avoid a nominal-type mismatch between twenty-shared and graphql enums.
          if ((filter.operand as string) !== 'IS') {
            return false;
          }
          try {
            const parsed = JSON.parse(filter.value) as {
              selectedRecordIds?: string[];
            };
            return parsed.selectedRecordIds?.includes(pipeline.id) === true;
          } catch {
            return false;
          }
        });
      });

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

      // Create one ViewGroup per stage — fieldValue = stage UUID.
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

      // Create the pipeline IS-filter so this board only shows opportunities
      // belonging to this pipeline.
      if (isDefined(pipelineField)) {
        await createViewFilterMutation({
          variables: {
            input: {
              id: v4(),
              viewId: newViewId,
              fieldMetadataId: pipelineField.id,
              operand: ViewFilterOperand.IS,
              value: pipelineFilterValue,
            },
          },
        });
      }

      return newViewId;
    },
    [
      allViews,
      opportunityMetadataItem.id,
      pipelineStageField,
      pipelineField,
      createViewMutation,
      createManyViewGroupsMutation,
      createViewFilterMutation,
    ],
  );

  return { ensurePipelineView };
};
