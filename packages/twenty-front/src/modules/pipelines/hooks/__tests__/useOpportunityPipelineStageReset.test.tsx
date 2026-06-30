import { renderHook, act } from '@testing-library/react';
import { useOpportunityPipelineStageReset } from '@/pipelines/hooks/useOpportunityPipelineStageReset';
import { type PipelineRecord } from '@/pipelines/types/PipelineRecord';

jest.mock('@/object-record/hooks/useUpdateOneRecord', () => ({
  useUpdateOneRecord: jest.fn(),
}));

const mockUpdateOneRecord = jest.fn();

describe('useOpportunityPipelineStageReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const useUpdateOneRecordMock = jest.requireMock(
      '@/object-record/hooks/useUpdateOneRecord',
    );
    useUpdateOneRecordMock.useUpdateOneRecord.mockReturnValue({
      updateOneRecord: mockUpdateOneRecord,
    });

    mockUpdateOneRecord.mockResolvedValue({});
  });

  it('should reset pipelineStageId to the first stage (by position) of the new pipeline', async () => {
    const newPipeline: PipelineRecord = {
      __typename: 'Pipeline',
      id: 'pipeline-new',
      name: 'Sales',
      position: 0,
      pipelineStages: {
        edges: [
          {
            node: {
              __typename: 'PipelineStage',
              id: 'stage-b',
              name: 'Proposal',
              position: 2,
              color: 'blue',
              pipelineId: 'pipeline-new',
            },
          },
          {
            node: {
              __typename: 'PipelineStage',
              id: 'stage-a',
              name: 'Qualification',
              position: 0,
              color: 'green',
              pipelineId: 'pipeline-new',
            },
          },
          {
            node: {
              __typename: 'PipelineStage',
              id: 'stage-c',
              name: 'Negotiation',
              position: 5,
              color: 'red',
              pipelineId: 'pipeline-new',
            },
          },
        ],
      },
    };

    const { result } = renderHook(() => useOpportunityPipelineStageReset());

    await act(async () => {
      await result.current.resetPipelineStage({
        opportunityId: 'opp-1',
        newPipeline,
      });
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);
    expect(mockUpdateOneRecord).toHaveBeenCalledWith({
      objectNameSingular: 'opportunity',
      idToUpdate: 'opp-1',
      updateOneRecordInput: { pipelineStageId: 'stage-a' },
    });
  });

  it('should clear pipelineStageId when the new pipeline has no stages', async () => {
    const emptyPipeline: PipelineRecord = {
      __typename: 'Pipeline',
      id: 'pipeline-empty',
      name: 'Empty Pipeline',
      position: 1,
      pipelineStages: { edges: [] },
    };

    const { result } = renderHook(() => useOpportunityPipelineStageReset());

    await act(async () => {
      await result.current.resetPipelineStage({
        opportunityId: 'opp-2',
        newPipeline: emptyPipeline,
      });
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);
    expect(mockUpdateOneRecord).toHaveBeenCalledWith({
      objectNameSingular: 'opportunity',
      idToUpdate: 'opp-2',
      updateOneRecordInput: { pipelineStageId: null },
    });
  });

  it('should clear pipelineStageId when newPipeline is null', async () => {
    const { result } = renderHook(() => useOpportunityPipelineStageReset());

    await act(async () => {
      await result.current.resetPipelineStage({
        opportunityId: 'opp-3',
        newPipeline: null,
      });
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);
    expect(mockUpdateOneRecord).toHaveBeenCalledWith({
      objectNameSingular: 'opportunity',
      idToUpdate: 'opp-3',
      updateOneRecordInput: { pipelineStageId: null },
    });
  });

  it('should clear pipelineStageId when newPipeline is undefined', async () => {
    const { result } = renderHook(() => useOpportunityPipelineStageReset());

    await act(async () => {
      await result.current.resetPipelineStage({
        opportunityId: 'opp-4',
        newPipeline: undefined,
      });
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);
    expect(mockUpdateOneRecord).toHaveBeenCalledWith({
      objectNameSingular: 'opportunity',
      idToUpdate: 'opp-4',
      updateOneRecordInput: { pipelineStageId: null },
    });
  });
});
