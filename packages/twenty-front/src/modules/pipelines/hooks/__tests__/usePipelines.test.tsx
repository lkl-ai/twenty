import { renderHook } from '@testing-library/react';
import { usePipelines } from '@/pipelines/hooks/usePipelines';

jest.mock('@/object-record/hooks/useFindManyRecords', () => ({
  useFindManyRecords: jest.fn(),
}));

const mockPipelines = [
  {
    __typename: 'Pipeline',
    id: 'pipeline-1',
    name: 'Default Pipeline',
    position: 0,
  },
  {
    __typename: 'Pipeline',
    id: 'pipeline-2',
    name: 'Enterprise Pipeline',
    position: 1,
  },
];

describe('usePipelines', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return pipelines ordered by position', () => {
    const useFindManyRecordsMock = jest.requireMock(
      '@/object-record/hooks/useFindManyRecords',
    );

    useFindManyRecordsMock.useFindManyRecords.mockReturnValue({
      records: mockPipelines,
      loading: false,
    });

    const { result } = renderHook(() => usePipelines());

    expect(result.current.loading).toBe(false);
    expect(result.current.pipelines).toHaveLength(2);
    expect(result.current.pipelines[0].id).toBe('pipeline-1');
    expect(result.current.pipelines[1].id).toBe('pipeline-2');
    // Verify pipelines are returned in position order (0, then 1)
    expect(result.current.pipelines[0].position).toBeLessThan(
      result.current.pipelines[1].position,
    );
  });

  it('should call useFindManyRecords with correct arguments', () => {
    const useFindManyRecordsMock = jest.requireMock(
      '@/object-record/hooks/useFindManyRecords',
    );

    useFindManyRecordsMock.useFindManyRecords.mockReturnValue({
      records: [],
      loading: false,
    });

    renderHook(() => usePipelines());

    expect(useFindManyRecordsMock.useFindManyRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        objectNameSingular: 'pipeline',
        orderBy: [{ position: 'AscNullsLast' }],
      }),
    );
  });

  it('should return loading state when records are being fetched', () => {
    const useFindManyRecordsMock = jest.requireMock(
      '@/object-record/hooks/useFindManyRecords',
    );

    useFindManyRecordsMock.useFindManyRecords.mockReturnValue({
      records: [],
      loading: true,
    });

    const { result } = renderHook(() => usePipelines());

    expect(result.current.loading).toBe(true);
    expect(result.current.pipelines).toHaveLength(0);
  });
});
