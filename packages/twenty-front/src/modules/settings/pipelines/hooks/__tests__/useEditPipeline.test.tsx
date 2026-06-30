import { renderHook } from '@testing-library/react';
import { act } from '@testing-library/react';

import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useDeleteOneRecord } from '@/object-record/hooks/useDeleteOneRecord';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useEnsurePipelineView } from '@/pipelines/hooks/useEnsurePipelineView';
import { type PipelineRecord } from '@/pipelines/types/PipelineRecord';
import { useEditPipeline } from '@/settings/pipelines/hooks/useEditPipeline';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import {
  CreateManyViewGroupsDocument,
  DeleteViewGroupDocument,
  UpdateManyViewGroupsDocument,
} from '~/generated-metadata/graphql';

const mockCreateManyViewGroupsMutation = jest.fn().mockResolvedValue({});
const mockUpdateManyViewGroupsMutation = jest.fn().mockResolvedValue({});
const mockDeleteViewGroupMutation = jest.fn().mockResolvedValue({});

jest.mock('@apollo/client/react', () => ({
  useMutation: (document: unknown) => {
    if (document === CreateManyViewGroupsDocument) {
      return [mockCreateManyViewGroupsMutation];
    }
    if (document === UpdateManyViewGroupsDocument) {
      return [mockUpdateManyViewGroupsMutation];
    }
    if (document === DeleteViewGroupDocument) {
      return [mockDeleteViewGroupMutation];
    }
    return [jest.fn().mockResolvedValue({})];
  },
}));

jest.mock('@/pipelines/hooks/useEnsurePipelineView', () => ({
  useEnsurePipelineView: jest.fn(),
}));

jest.mock('@/object-record/hooks/useCreateOneRecord', () => ({
  useCreateOneRecord: jest.fn(),
}));

jest.mock('@/object-record/hooks/useUpdateOneRecord', () => ({
  useUpdateOneRecord: jest.fn(),
}));

jest.mock('@/object-record/hooks/useDeleteOneRecord', () => ({
  useDeleteOneRecord: jest.fn(),
}));

jest.mock('@/ui/utilities/state/jotai/hooks/useAtomStateValue', () => ({
  useAtomStateValue: jest.fn(),
}));

const mockPipeline: PipelineRecord = {
  __typename: 'Pipeline',
  id: 'pipeline-1',
  name: 'Sales',
  position: 0,
};

const mockStages = [
  {
    __typename: 'PipelineStage' as const,
    id: 'stage-1',
    name: 'Prospecting',
    position: 0,
    color: 'blue',
    pipelineId: 'pipeline-1',
  },
  {
    __typename: 'PipelineStage' as const,
    id: 'stage-2',
    name: 'Qualified',
    position: 1,
    color: 'green',
    pipelineId: 'pipeline-1',
  },
];

const mockCreateOneRecord = jest.fn();
const mockUpdateOneRecord = jest.fn().mockResolvedValue(undefined);
const mockDeleteOneRecord = jest.fn().mockResolvedValue(undefined);
const mockEnsurePipelineView = jest
  .fn()
  .mockResolvedValue('view-1');

const mockViews = [
  {
    id: 'view-1',
    viewGroups: [
      { id: 'vg-1', fieldValue: 'stage-1', position: 0 },
      { id: 'vg-2', fieldValue: 'stage-2', position: 1 },
    ],
  },
];

const setupMocks = () => {
  (useEnsurePipelineView as jest.Mock).mockReturnValue({
    ensurePipelineView: mockEnsurePipelineView,
  });
  (useCreateOneRecord as jest.Mock).mockReturnValue({
    createOneRecord: mockCreateOneRecord,
  });
  (useUpdateOneRecord as jest.Mock).mockReturnValue({
    updateOneRecord: mockUpdateOneRecord,
  });
  (useDeleteOneRecord as jest.Mock).mockReturnValue({
    deleteOneRecord: mockDeleteOneRecord,
  });
  (useAtomStateValue as jest.Mock).mockReturnValue(mockViews);
};

describe('useEditPipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  it('createStage creates a record and re-syncs view groups', async () => {
    const newStage = {
      __typename: 'PipelineStage' as const,
      id: 'stage-3',
      name: 'Proposal',
      position: 2,
      color: 'green',
      pipelineId: 'pipeline-1',
    };
    mockCreateOneRecord.mockResolvedValue(newStage);

    const { result } = renderHook(() => useEditPipeline(mockPipeline));

    await act(async () => {
      await result.current.createStage('Proposal', 'green', mockStages);
    });

    expect(mockCreateOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Proposal',
        color: 'green',
        pipelineId: 'pipeline-1',
      }),
    );
    expect(mockEnsurePipelineView).toHaveBeenCalled();
  });

  it('deleteStage deletes the record and re-syncs view groups', async () => {
    const { result } = renderHook(() => useEditPipeline(mockPipeline));

    await act(async () => {
      await result.current.deleteStage('stage-1', mockStages);
    });

    expect(mockDeleteOneRecord).toHaveBeenCalledWith('stage-1');
    // view-group for deleted stage should be removed
    expect(mockDeleteViewGroupMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: { input: { id: 'vg-1' } },
      }),
    );
  });

  it('renameStage calls updateOneRecord with the new name', async () => {
    const { result } = renderHook(() => useEditPipeline(mockPipeline));

    await act(async () => {
      await result.current.renameStage('stage-1', 'New Name');
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        objectNameSingular: 'pipelineStage',
        idToUpdate: 'stage-1',
        updateOneRecordInput: { name: 'New Name' },
      }),
    );
  });

  it('setStageColor calls updateOneRecord with the new color', async () => {
    const { result } = renderHook(() => useEditPipeline(mockPipeline));

    await act(async () => {
      await result.current.setStageColor('stage-1', 'red');
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        objectNameSingular: 'pipelineStage',
        idToUpdate: 'stage-1',
        updateOneRecordInput: { color: 'red' },
      }),
    );
  });

  it('reorderStages persists positions and re-syncs view groups', async () => {
    const reordered = [
      { ...mockStages[1], position: 0 },
      { ...mockStages[0], position: 1 },
    ];

    const { result } = renderHook(() => useEditPipeline(mockPipeline));

    await act(async () => {
      await result.current.reorderStages(reordered);
    });

    // Should update positions for each stage
    expect(mockUpdateOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        objectNameSingular: 'pipelineStage',
        idToUpdate: 'stage-2',
        updateOneRecordInput: { position: 0 },
      }),
    );
    expect(mockUpdateOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        objectNameSingular: 'pipelineStage',
        idToUpdate: 'stage-1',
        updateOneRecordInput: { position: 1 },
      }),
    );
    // Should trigger view group sync
    expect(mockEnsurePipelineView).toHaveBeenCalled();
  });

  it('syncViewGroups updates positions of existing view groups after reorder', async () => {
    const reordered = [
      { ...mockStages[1], position: 0 },
      { ...mockStages[0], position: 1 },
    ];

    const { result } = renderHook(() => useEditPipeline(mockPipeline));

    await act(async () => {
      await result.current.syncViewGroups(reordered);
    });

    // vg-2 is stage-2 which is now at position 0 — should be updated
    expect(mockUpdateManyViewGroupsMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({
          inputs: expect.arrayContaining([
            expect.objectContaining({ id: 'vg-2', update: { position: 0 } }),
          ]),
        }),
      }),
    );
  });
});
