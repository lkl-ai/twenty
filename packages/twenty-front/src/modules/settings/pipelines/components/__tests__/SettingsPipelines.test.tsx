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
import { SettingsPipelines } from '@/settings/pipelines/components/SettingsPipelines';

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
      loading: false,
    });
    mockedUseUpdateOneRecord.mockReturnValue({
      updateOneRecord: jest.fn().mockResolvedValue(undefined),
    });
    mockedUseDeleteOneRecord.mockReturnValue({
      deleteOneRecord: jest.fn().mockResolvedValue(undefined),
    });
  });

  it('renders pipelines from usePipelines', () => {
    mockedUsePipelines.mockReturnValue({
      pipelines: [
        {
          __typename: 'Pipeline',
          id: '1',
          name: 'Sales Pipeline',
          position: 0,
        },
      ],
      loading: false,
    });

    renderComponent();

    expect(screen.getByText('Sales Pipeline')).toBeInTheDocument();
  });

  it('create calls useCreateOneRecord and ensurePipelineView with empty stages', async () => {
    const mockCreateOneRecord = jest.fn().mockResolvedValue({
      id: 'new-1',
      name: 'New Pipeline',
      position: 1,
    });
    const mockEnsurePipelineView = jest.fn().mockResolvedValue(undefined);

    mockedUseCreateOneRecord.mockReturnValue({
      createOneRecord: mockCreateOneRecord,
      loading: false,
    });
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
    // A newly-created pipeline has no stages — ensurePipelineView receives []
    expect(mockEnsurePipelineView).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-1' }),
      [],
    );
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
        },
      ],
      loading: false,
    });
    mockedUseDeleteOneRecord.mockReturnValue({
      deleteOneRecord: mockDeleteOneRecord,
    });

    renderComponent();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Delete pipeline/i }));
    });

    expect(mockDeleteOneRecord).toHaveBeenCalledWith('1');
  });

  it('rename confirms and calls updateOneRecord with new name', async () => {
    const mockUpdateOneRecord = jest.fn().mockResolvedValue(undefined);

    mockedUsePipelines.mockReturnValue({
      pipelines: [
        {
          __typename: 'Pipeline',
          id: '1',
          name: 'Sales Pipeline',
          position: 0,
        },
      ],
      loading: false,
    });
    mockedUseUpdateOneRecord.mockReturnValue({
      updateOneRecord: mockUpdateOneRecord,
    });

    renderComponent();

    // Click rename (pencil) button
    fireEvent.click(screen.getByRole('button', { name: /Rename pipeline/i }));

    // Find the rename input and type a new name
    const input = screen.getByDisplayValue('Sales Pipeline');
    fireEvent.change(input, { target: { value: 'Renamed Pipeline' } });

    // Click confirm (check) button
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Confirm rename/i }));
    });

    expect(mockUpdateOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        objectNameSingular: 'pipeline',
        idToUpdate: '1',
        updateOneRecordInput: { name: 'Renamed Pipeline' },
      }),
    );
  });

  it('set-default calls updateOneRecord with isDefault true and clears old default', async () => {
    const mockUpdateOneRecord = jest.fn().mockResolvedValue(undefined);

    mockedUsePipelines.mockReturnValue({
      pipelines: [
        {
          __typename: 'Pipeline',
          id: '1',
          name: 'Sales Pipeline',
          position: 0,
          isDefault: true,
        },
        {
          __typename: 'Pipeline',
          id: '2',
          name: 'Support Pipeline',
          position: 1,
          isDefault: false,
        },
      ],
      loading: false,
    });
    mockedUseUpdateOneRecord.mockReturnValue({
      updateOneRecord: mockUpdateOneRecord,
    });

    renderComponent();

    // "Set as default" only appears on non-default pipelines
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Set as default pipeline/i }),
      );
    });

    // Sets the new default
    expect(mockUpdateOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        objectNameSingular: 'pipeline',
        idToUpdate: '2',
        updateOneRecordInput: { isDefault: true },
      }),
    );
    // Clears the old default
    expect(mockUpdateOneRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        objectNameSingular: 'pipeline',
        idToUpdate: '1',
        updateOneRecordInput: { isDefault: false },
      }),
    );
  });

  it('Default badge renders from isDefault field, not array index', () => {
    mockedUsePipelines.mockReturnValue({
      pipelines: [
        {
          __typename: 'Pipeline',
          id: '1',
          name: 'Sales Pipeline',
          position: 0,
          isDefault: false,
        },
        {
          __typename: 'Pipeline',
          id: '2',
          name: 'Support Pipeline',
          position: 1,
          isDefault: true,
        },
      ],
      loading: false,
    });

    renderComponent();

    // Badge should be next to 'Support Pipeline', not 'Sales Pipeline'
    expect(screen.getByText('Default')).toBeInTheDocument();
    const defaultBadge = screen.getByText('Default');
    const supportRow = screen.getByText('Support Pipeline').closest('div');
    expect(supportRow).toContainElement(defaultBadge);
  });
});
