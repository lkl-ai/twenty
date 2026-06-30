import { fireEvent, render, screen } from '@testing-library/react';
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

jest.mock('@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue', () => ({
  useAtomComponentStateValue: jest.fn(),
}));

jest.mock('@/ui/utilities/state/jotai/hooks/useAtomStateValue', () => ({
  useAtomStateValue: jest.fn(),
}));

const mockPipelines = [
  {
    __typename: 'Pipeline' as const,
    id: 'pipeline-1',
    name: 'Default',
    position: 0,
    pipelineStages: { edges: [] },
  },
  {
    __typename: 'Pipeline' as const,
    id: 'pipeline-2',
    name: 'Enterprise',
    position: 1,
    pipelineStages: { edges: [] },
  },
  {
    __typename: 'Pipeline' as const,
    id: 'pipeline-3',
    name: 'Startup',
    position: 2,
    pipelineStages: { edges: [] },
  },
];

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

    const useChangeViewMock = jest.requireMock(
      '@/views/hooks/useChangeView',
    );
    useChangeViewMock.useChangeView.mockReturnValue({
      changeView: mockChangeView,
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

    // Allow the async click handler to resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockEnsurePipelineView).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pipeline-2', name: 'Enterprise' }),
      [],
    );
    expect(mockChangeView).toHaveBeenCalledWith(resolvedViewId);
  });

  it('should not call changeView when ensurePipelineView returns undefined', async () => {
    mockEnsurePipelineView.mockResolvedValue(undefined);

    render(<PipelineSwitcher />);

    const defaultTab = screen.getByText('Default');
    fireEvent.click(defaultTab);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockEnsurePipelineView).toHaveBeenCalled();
    expect(mockChangeView).not.toHaveBeenCalled();
  });
});
