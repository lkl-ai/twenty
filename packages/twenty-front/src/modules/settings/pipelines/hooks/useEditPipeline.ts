import { useCallback } from 'react';
import { v4 } from 'uuid';

import { useMutation } from '@apollo/client/react';

import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useDeleteOneRecord } from '@/object-record/hooks/useDeleteOneRecord';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useEnsurePipelineView } from '@/pipelines/hooks/useEnsurePipelineView';
import {
  type PipelineRecord,
  type PipelineStageRecord,
} from '@/pipelines/types/PipelineRecord';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { viewsSelector } from '@/views/states/selectors/viewsSelector';
import {
  CreateManyViewGroupsDocument,
  DeleteViewGroupDocument,
  UpdateManyViewGroupsDocument,
} from '~/generated-metadata/graphql';
import { isDefined } from 'twenty-shared/utils';

// Encapsulates stage create / update / delete for one pipeline, and keeps the
// pipeline's Kanban view ViewGroups in sync after every change.
export const useEditPipeline = (pipeline: PipelineRecord) => {
  const { ensurePipelineView } = useEnsurePipelineView();

  const views = useAtomStateValue(viewsSelector);

  const [createManyViewGroupsMutation] = useMutation(
    CreateManyViewGroupsDocument,
  );
  const [updateManyViewGroupsMutation] = useMutation(
    UpdateManyViewGroupsDocument,
  );
  const [deleteViewGroupMutation] = useMutation(DeleteViewGroupDocument);

  const { createOneRecord: createOneStage } =
    useCreateOneRecord<PipelineStageRecord>({
      objectNameSingular: 'pipelineStage',
    });

  const { updateOneRecord } = useUpdateOneRecord();

  const { deleteOneRecord: deleteOneStage } = useDeleteOneRecord({
    objectNameSingular: 'pipelineStage',
  });

  // Find the Kanban view for this pipeline (or create it if absent).
  // Returns the view id.
  const getOrCreatePipelineViewId = useCallback(
    async (stages: PipelineStageRecord[]): Promise<string | undefined> => {
      return ensurePipelineView(pipeline, stages);
    },
    [ensurePipelineView, pipeline],
  );

  // After any stage mutation, re-sync the Kanban view's ViewGroups so
  // columns exactly match the current stage list ordered by position.
  const syncViewGroups = useCallback(
    async (nextStages: PipelineStageRecord[]): Promise<void> => {
      const viewId = await getOrCreatePipelineViewId(nextStages);
      if (!isDefined(viewId)) {
        return;
      }

      const existingView = views.find((view) => view.id === viewId);
      const existingGroups = existingView?.viewGroups ?? [];

      const sortedStages = [...nextStages].sort(
        (stageA, stageB) => stageA.position - stageB.position,
      );

      // Groups that exist for a stage id that is no longer present → delete.
      const stageIds = new Set(sortedStages.map((stage) => stage.id));
      const groupsToDelete = existingGroups.filter(
        (group) => !stageIds.has(group.fieldValue),
      );

      await Promise.all(
        groupsToDelete.map((group) =>
          deleteViewGroupMutation({
            variables: { input: { id: group.id } },
          }),
        ),
      );

      // Groups that exist but need a position update.
      const groupsByFieldValue = new Map(
        existingGroups.map((group) => [group.fieldValue, group]),
      );

      const groupsToUpdate = sortedStages
        .map((stage, index) => {
          const existingGroup = groupsByFieldValue.get(stage.id);
          if (isDefined(existingGroup) && existingGroup.position !== index) {
            return { id: existingGroup.id, update: { position: index } };
          }
          return null;
        })
        .filter(isDefined);

      if (groupsToUpdate.length > 0) {
        await updateManyViewGroupsMutation({
          variables: { inputs: groupsToUpdate },
        });
      }

      // Stages that have no ViewGroup yet → create.
      const stagesToCreate = sortedStages.filter(
        (stage) => !groupsByFieldValue.has(stage.id),
      );

      if (stagesToCreate.length > 0) {
        await createManyViewGroupsMutation({
          variables: {
            inputs: stagesToCreate.map((stage) => ({
              id: v4(),
              viewId,
              fieldValue: stage.id,
              // position = index in the full sorted-stages list, matching the
              // contract used by useEnsurePipelineView (position: index).
              // Using existingGroups.length would overshoot when some groups
              // were deleted in the same sync pass.
              position: sortedStages.indexOf(stage),
              isVisible: true,
            })),
          },
        });
      }
    },
    [
      views,
      getOrCreatePipelineViewId,
      createManyViewGroupsMutation,
      updateManyViewGroupsMutation,
      deleteViewGroupMutation,
    ],
  );

  const createStage = useCallback(
    async (
      name: string,
      color: string,
      currentStages: PipelineStageRecord[],
    ): Promise<void> => {
      const nextPosition = currentStages.length;

      const created = await createOneStage({
        name,
        color,
        position: nextPosition,
        pipelineId: pipeline.id,
      } as Partial<PipelineStageRecord>);

      if (!isDefined(created)) {
        return;
      }

      const newStage = created as unknown as PipelineStageRecord;
      const nextStages = [
        ...currentStages,
        { ...newStage, position: nextPosition },
      ];

      await syncViewGroups(nextStages);
    },
    [pipeline.id, createOneStage, syncViewGroups],
  );

  const deleteStage = useCallback(
    async (
      stageId: string,
      currentStages: PipelineStageRecord[],
    ): Promise<void> => {
      await deleteOneStage(stageId);

      const nextStages = currentStages
        .filter((stage) => stage.id !== stageId)
        .map((stage, index) => ({ ...stage, position: index }));

      await syncViewGroups(nextStages);
    },
    [deleteOneStage, syncViewGroups],
  );

  const renameStage = useCallback(
    async (stageId: string, name: string): Promise<void> => {
      await updateOneRecord({
        objectNameSingular: 'pipelineStage',
        idToUpdate: stageId,
        updateOneRecordInput: { name },
      });
      // Rename doesn't affect view group structure, no sync needed.
    },
    [updateOneRecord],
  );

  const setStageColor = useCallback(
    async (stageId: string, color: string): Promise<void> => {
      await updateOneRecord({
        objectNameSingular: 'pipelineStage',
        idToUpdate: stageId,
        updateOneRecordInput: { color },
      });
      // Color doesn't affect view group structure, no sync needed.
    },
    [updateOneRecord],
  );

  const reorderStages = useCallback(
    async (nextStages: PipelineStageRecord[]): Promise<void> => {
      // Persist the new positions on each stage record.
      await Promise.all(
        nextStages.map((stage) =>
          updateOneRecord({
            objectNameSingular: 'pipelineStage',
            idToUpdate: stage.id,
            updateOneRecordInput: { position: stage.position },
          }),
        ),
      );

      await syncViewGroups(nextStages);
    },
    [updateOneRecord, syncViewGroups],
  );

  return {
    createStage,
    deleteStage,
    renameStage,
    setStageColor,
    reorderStages,
    // Expose for callers that need to manually trigger a view-group sync
    // (e.g. after an external change).
    syncViewGroups,
  };
};
