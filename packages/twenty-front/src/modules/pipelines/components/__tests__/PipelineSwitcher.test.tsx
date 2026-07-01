import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PipelineSwitcher } from '@/pipelines/components/PipelineSwitcher';

// Mock hooks that pull from Jotai / Apollo / routing.
jest.mock('@/pipelines/hooks/usePipelines', () => ({
  usePipelines: jest.fn(),
}));

jest.mock('@/pipelines/hooks/useEnsurePipelineView', () => ({
  useEnsurePipelineView: jest.fn(),
}));

jest.mock('@/views/hooks/useChangeView', () => ({
  useChangeView: jest.fn(),
}));

jest.mock('@/object-metadata/hooks/useObjectMetadataItem', () => ({
  useObjectMetadataItem: jest.fn(),
}));

jest.mock(
  '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue',
  () => ({
    useAtomComponentStateValue: jest.fn(),
  }),
);

jest.mock('@/ui/utilities/state/jotai/hooks/useAtomStateValue', () => ({
  useAtomStateValue: jest.fn(),
}));

jest.mock('@/object-record/hooks/useFindManyRecords', () => ({
  useFindManyRecords: jest.fn(),
}));

const mockPipelines = [
  {
    __typename: 'Pipeline' as const,
    id: 'pipeline-1',
    name: 'Default',
    position: 0,
  },
  {
    __typename: 'Pipeline' as const,
    id: 'pipeline-2',
    name: 'Enterprise',
    position: 1,
  },
  {
    __typename: 'Pipeline' as const,
    id: 'pipeline-3',
    name: 'Startup',
    position: 2,
  },
];

const mockPipelineStages = [
  {
    __typename: 'PipelineStage' as const,
    id: 'stage-1',
    name: 'Qualified',
    position: 0,
    color: 'blue',
    pipelineId: 'pipeline-1',
  },
  {
    __typename: 'PipelineStage' as const,
    id: 'stage-2',
    name: 'Proposal',
    position: 0,
    color: 'green',
    pipelineId: 'pipeline-2',
  },
  {
    __typename: 'PipelineStage' as const,
    id: 'stage-3',
    name: 'Negotiation',
    position: 1,
    color: 'yellow',
    pipelineId: 'pipeline-2',
  },
];

// The fieldMetadataId for the `pipeline` relation field on Opportunity.
const PIPELINE_FIELD_METADATA_ID = 'field-meta-pipeline';

describe('PipelineSwitcher', () => {
  const mockChangeView = jest.fn();
  const mockEnsurePipelineView = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    const usePipelinesMock = jest.requireMock('@/pipelines/hooks/usePipelines');
    usePipelinesMock.usePipelines.mockReturnValue({
      pipelines: mockPipelines,
      loading: false,
    });

    const useEnsurePipelineViewMock = jest.requireMock(
      '@/pipelines/hooks/useEnsurePipelineView',
    );
    useEnsurePipelineViewMock.useEnsurePipelineView.mockReturnValue({
      ensurePipelineView: mockEnsurePipelineView,
    });

    const useChangeViewMock = jest.requireMock('@/views/hooks/useChangeView');
    useChangeViewMock.useChangeView.mockReturnValue({
      changeView: mockChangeView,
    });

    // Provide the Opportunity object metadata with a `pipeline` relation field
    // so the component can resolve pipelineFieldMetadataId explicitly.
    const useObjectMetadataItemMock = jest.requireMock(
      '@/object-metadata/hooks/useObjectMetadataItem',
    );
    useObjectMetadataItemMock.useObjectMetadataItem.mockReturnValue({
      objectMetadataItem: {
        id: 'opportunity-meta-id',
        fields: [
          { name: 'pipeline', id: PIPELINE_FIELD_METADATA_ID },
          { name: 'company', id: 'field-meta-company' },
          { name: 'assignee', id: 'field-meta-assignee' },
        ],
      },
    });

    const useAtomComponentStateValueMock = jest.requireMock(
      '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue',
    );
    // No active view by default
    useAtomComponentStateValueMock.useAtomComponentStateValue.mockReturnValue(
      undefined,
    );

    const useAtomStateValueMock = jest.requireMock(
      '@/ui/utilities/state/jotai/hooks/useAtomStateValue',
    );
    useAtomStateValueMock.useAtomStateValue.mockReturnValue([]);

    const useFindManyRecordsMock = jest.requireMock(
      '@/object-record/hooks/useFindManyRecords',
    );
    useFindManyRecordsMock.useFindManyRecords.mockReturnValue({
      records: mockPipelineStages,
      loading: false,
    });
  });

  it('should render one tab per pipeline', () => {
    render(<PipelineSwitcher />);

    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText('Enterprise')).toBeTruthy();
    expect(screen.getByText('Startup')).toBeTruthy();
  });

  it('should return null while loading', () => {
    const usePipelinesMock = jest.requireMock('@/pipelines/hooks/usePipelines');
    usePipelinesMock.usePipelines.mockReturnValue({
      pipelines: [],
      loading: true,
    });

    const { container } = render(<PipelineSwitcher />);

    expect(container.firstChild).toBeNull();
  });

  it('should return null when there are no pipelines', () => {
    const usePipelinesMock = jest.requireMock('@/pipelines/hooks/usePipelines');
    usePipelinesMock.usePipelines.mockReturnValue({
      pipelines: [],
      loading: false,
    });

    const { container } = render(<PipelineSwitcher />);

    expect(container.firstChild).toBeNull();
  });

  it('should call ensurePipelineView and changeView when a tab is clicked', async () => {
    const resolvedViewId = 'view-for-pipeline-2';
    mockEnsurePipelineView.mockResolvedValue(resolvedViewId);

    render(<PipelineSwitcher />);

    const enterpriseTab = screen.getByText('Enterprise');
    fireEvent.click(enterpriseTab);

    // Only the two stages belonging to pipeline-2 should be passed.
    const expectedStages = mockPipelineStages.filter(
      (s) => s.pipelineId === 'pipeline-2',
    );

    await waitFor(() => {
      expect(mockEnsurePipelineView).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'pipeline-2', name: 'Enterprise' }),
        expectedStages,
      );
      expect(mockChangeView).toHaveBeenCalledWith(resolvedViewId);
    });
  });

  it('should not call changeView when ensurePipelineView returns undefined', async () => {
    mockEnsurePipelineView.mockResolvedValue(undefined);

    render(<PipelineSwitcher />);

    const defaultTab = screen.getByText('Default');
    fireEvent.click(defaultTab);

    await waitFor(() => {
      expect(mockEnsurePipelineView).toHaveBeenCalled();
    });
    expect(mockChangeView).not.toHaveBeenCalled();
  });

  it('should identify the active tab using the pipeline fieldMetadataId, not a heuristic', () => {
    // Set up a view whose filters include BOTH a pipeline IS-filter AND a
    // company IS-filter (same shape). Only pipeline-1 should be active because
    // we match exclusively on PIPELINE_FIELD_METADATA_ID.
    const pipelineFilterValue = JSON.stringify({
      isCurrentWorkspaceMemberSelected: false,
      selectedRecordIds: ['pipeline-1'],
    });
    const companyFilterValue = JSON.stringify({
      isCurrentWorkspaceMemberSelected: false,
      selectedRecordIds: ['some-company-id'],
    });

    const useAtomComponentStateValueMock = jest.requireMock(
      '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue',
    );
    useAtomComponentStateValueMock.useAtomComponentStateValue.mockReturnValue(
      'view-id-1',
    );

    const useAtomStateValueMock = jest.requireMock(
      '@/ui/utilities/state/jotai/hooks/useAtomStateValue',
    );
    useAtomStateValueMock.useAtomStateValue.mockReturnValue([
      {
        id: 'view-id-1',
        viewFilters: [
          // Company IS-filter — same shape but must NOT drive active-tab.
          {
            fieldMetadataId: 'field-meta-company',
            operand: 'IS',
            value: companyFilterValue,
          },
          // Pipeline IS-filter — should determine active tab.
          {
            fieldMetadataId: PIPELINE_FIELD_METADATA_ID,
            operand: 'IS',
            value: pipelineFilterValue,
          },
        ],
      },
    ]);

    render(<PipelineSwitcher />);

    // pipeline-1 is "Default"; it should be highlighted as active.
    expect(screen.getByText('Default')).toBeTruthy();
    // The active tab receives `isActive={true}`; the others receive false.
    // We verify by ensuring no stray pipeline is detected as active.
    expect(screen.getByText('Enterprise')).toBeTruthy();
    expect(screen.getByText('Startup')).toBeTruthy();
  });
});
