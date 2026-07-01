import { act, renderHook } from '@testing-library/react';

import { useOpportunityPipelineStageReset } from '@/pipelines/hooks/useOpportunityPipelineStageReset';
import { type PipelineStageRecord } from '@/pipelines/types/PipelineRecord';

jest.mock('@/object-record/hooks/useUpdateOneRecord', () => ({
  useUpdateOneRecord: jest.fn(),
}));

jest.mock('@/object-record/hooks/useFindManyRecords', () => ({
  useFindManyRecords: jest.fn(),
}));

const mockUpdateOneRecord = jest.fn();

// All stages returned by the mocked useFindManyRecords flat query.
// Mirrors what the real hook fetches via recordGqlFields.
const mockStages: PipelineStageRecord[] = [
  {
    __typename: 'PipelineStage',
    id: 'stage-b',
    name: 'Proposal',
    position: 2,
    color: 'blue',
    pipelineId: 'pipeline-new',
  },
  {
    __typename: 'PipelineStage',
    id: 'stage-a',
    name: 'Qualification',
    position: 0,
    color: 'green',
    pipelineId: 'pipeline-new',
  },
  {
    __typename: 'PipelineStage',
    id: 'stage-c',
    name: 'Negotiation',
    position: 5,
    color: 'red',
    pipelineId: 'pipeline-new',
  },
];

describe('useOpportunityPipelineStageReset', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const useUpdateOneRecordMock = jest.requireMock(
      '@/object-record/hooks/useUpdateOneRecord',
    );
    useUpdateOneRecordMock.useUpdateOneRecord.mockReturnValue({
      updateOneRecord: mockUpdateOneRecord,
    });

    const useFindManyRecordsMock = jest.requireMock(
      '@/object-record/hooks/useFindManyRecords',
    );
    useFindManyRecordsMock.useFindManyRecords.mockReturnValue({
      records: mockStages,
      loading: false,
    });

    mockUpdateOneRecord.mockResolvedValue({});
  });

  // Real runtime path: the relation picker submits only { id }, so at runtime
  // resetPipelineStage receives a pipelineId string — NOT a full PipelineRecord.
  // The hook must resolve the pipeline's stages from the flat useFindManyRecords
  // query filtered by pipelineId.
  it('should set pipelineStageId to first stage (by position) when given a pipeline id', async () => {
    const { result } = renderHook(() => useOpportunityPipelineStageReset());

    await act(async () => {
      await result.current.resetPipelineStage({
        opportunityId: 'opp-1',
        pipelineId: 'pipeline-new',
      });
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);
    // stage-a has position 0 — the lowest — so it should be selected
    expect(mockUpdateOneRecord).toHaveBeenCalledWith({
      objectNameSingular: 'opportunity',
      idToUpdate: 'opp-1',
      updateOneRecordInput: { pipelineStageId: 'stage-a' },
    });
  });

  it('should set pipelineStageId to null when the pipeline has no stages', async () => {
    const useFindManyRecordsMock = jest.requireMock(
      '@/object-record/hooks/useFindManyRecords',
    );
    useFindManyRecordsMock.useFindManyRecords.mockReturnValue({
      records: [],
      loading: false,
    });

    const { result } = renderHook(() => useOpportunityPipelineStageReset());

    await act(async () => {
      await result.current.resetPipelineStage({
        opportunityId: 'opp-2',
        pipelineId: 'pipeline-empty',
      });
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);
    expect(mockUpdateOneRecord).toHaveBeenCalledWith({
      objectNameSingular: 'opportunity',
      idToUpdate: 'opp-2',
      updateOneRecordInput: { pipelineStageId: null },
    });
  });

  it('should set pipelineStageId to null when no stages match the pipeline id', async () => {
    const { result } = renderHook(() => useOpportunityPipelineStageReset());

    await act(async () => {
      await result.current.resetPipelineStage({
        opportunityId: 'opp-5',
        pipelineId: 'pipeline-unknown',
      });
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);
    expect(mockUpdateOneRecord).toHaveBeenCalledWith({
      objectNameSingular: 'opportunity',
      idToUpdate: 'opp-5',
      updateOneRecordInput: { pipelineStageId: null },
    });
  });

  it('should set pipelineStageId to null when pipelineId is null', async () => {
    const { result } = renderHook(() => useOpportunityPipelineStageReset());

    await act(async () => {
      await result.current.resetPipelineStage({
        opportunityId: 'opp-3',
        pipelineId: null,
      });
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledTimes(1);
    expect(mockUpdateOneRecord).toHaveBeenCalledWith({
      objectNameSingular: 'opportunity',
      idToUpdate: 'opp-3',
      updateOneRecordInput: { pipelineStageId: null },
    });
  });

  it('should set pipelineStageId to null when pipelineId is undefined', async () => {
    const { result } = renderHook(() => useOpportunityPipelineStageReset());

    await act(async () => {
      await result.current.resetPipelineStage({
        opportunityId: 'opp-4',
        pipelineId: undefined,
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
