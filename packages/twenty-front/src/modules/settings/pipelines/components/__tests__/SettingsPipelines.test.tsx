import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useDeleteOneRecord } from '@/object-record/hooks/useDeleteOneRecord';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useEnsurePipelineView } from '@/pipelines/hooks/useEnsurePipelineView';
import { usePipelines } from '@/pipelines/hooks/usePipelines';
import { SettingsPipelines } from '../SettingsPipelines';

jest.mock('@/pipelines/hooks/usePipelines', () => ({
  usePipelines: jest.fn(),
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

jest.mock('@/settings/components/SettingsPageContainer', () => ({
  SettingsPageContainer: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('@/settings/components/layout/SettingsPageLayout', () => ({
  SettingsPageLayout: ({
    children,
    actionButton,
  }: {
    children: ReactNode;
    actionButton?: ReactNode;
  }) => (
    <>
      {actionButton}
      {children}
    </>
  ),
}));

const mockedUsePipelines = usePipelines as jest.MockedFunction<
  typeof usePipelines
>;
const mockedUseEnsurePipelineView =
  useEnsurePipelineView as jest.MockedFunction<typeof useEnsurePipelineView>;
const mockedUseCreateOneRecord = useCreateOneRecord as jest.MockedFunction<
  typeof useCreateOneRecord
>;
const mockedUseUpdateOneRecord = useUpdateOneRecord as jest.MockedFunction<
  typeof useUpdateOneRecord
>;
const mockedUseDeleteOneRecord = useDeleteOneRecord as jest.MockedFunction<
  typeof useDeleteOneRecord
>;

const renderComponent = () =>
  render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <SettingsPipelines />
      </MemoryRouter>
    </I18nProvider>,
  );

describe('SettingsPipelines', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedUsePipelines.mockReturnValue({ pipelines: [], loading: false });
    mockedUseEnsurePipelineView.mockReturnValue({
      ensurePipelineView: jest.fn(),
    });
    mockedUseCreateOneRecord.mockReturnValue({
      createOneRecord: jest.fn().mockResolvedValue(undefined),
    } as never);
    mockedUseUpdateOneRecord.mockReturnValue({
      updateOneRecord: jest.fn().mockResolvedValue(undefined),
    } as never);
    mockedUseDeleteOneRecord.mockReturnValue({
      deleteOneRecord: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  it('renders pipelines from usePipelines', () => {
    mockedUsePipelines.mockReturnValue({
      pipelines: [
        {
          __typename: 'Pipeline',
          id: '1',
          name: 'Sales Pipeline',
          position: 0,
          pipelineStages: { edges: [] },
        },
      ],
      loading: false,
    });

    renderComponent();

    expect(screen.getByText('Sales Pipeline')).toBeInTheDocument();
  });

  it('create calls useCreateOneRecord and ensurePipelineView', async () => {
    const mockCreateOneRecord = jest.fn().mockResolvedValue({
      id: 'new-1',
      name: 'New Pipeline',
      position: 1,
      pipelineStages: { edges: [] },
    });
    const mockEnsurePipelineView = jest.fn().mockResolvedValue(undefined);

    mockedUseCreateOneRecord.mockReturnValue({
      createOneRecord: mockCreateOneRecord,
    } as never);
    mockedUseEnsurePipelineView.mockReturnValue({
      ensurePipelineView: mockEnsurePipelineView,
    });

    renderComponent();

    // Click the "Add pipeline" button to open the creation form
    fireEvent.click(screen.getByRole('button', { name: /Add pipeline/i }));

    // Type a name in the input
    const input = screen.getByPlaceholderText(/Pipeline name/i);
    fireEvent.change(input, { target: { value: 'New Pipeline' } });

    // Click Save
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    });

    expect(mockCreateOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Pipeline' }),
    );
    expect(mockEnsurePipelineView).toHaveBeenCalled();
  });

  it('delete calls useDeleteOneRecord', async () => {
    const mockDeleteOneRecord = jest.fn().mockResolvedValue(undefined);

    mockedUsePipelines.mockReturnValue({
      pipelines: [
        {
          __typename: 'Pipeline',
          id: '1',
          name: 'Sales Pipeline',
          position: 0,
          pipelineStages: { edges: [] },
        },
      ],
      loading: false,
    });
    mockedUseDeleteOneRecord.mockReturnValue({
      deleteOneRecord: mockDeleteOneRecord,
    } as never);

    renderComponent();

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Delete pipeline/i }),
      );
    });

    expect(mockDeleteOneRecord).toHaveBeenCalledWith('1');
  });
});
