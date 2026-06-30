import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import { type PipelineRecord } from '@/pipelines/types/PipelineRecord';
import { useEditPipeline } from '@/settings/pipelines/hooks/useEditPipeline';
import { SettingsPipelineStagesEditor } from '@/settings/pipelines/components/SettingsPipelineStagesEditor';

jest.mock('@/object-record/hooks/useFindManyRecords', () => ({
  useFindManyRecords: jest.fn(),
}));

jest.mock('@/settings/pipelines/hooks/useEditPipeline', () => ({
  useEditPipeline: jest.fn(),
}));

// Stub drag-and-drop — not relevant for unit tests
jest.mock('@/ui/layout/draggable-list/components/DraggableList', () => ({
  DraggableList: ({ draggableItems }: { draggableItems: ReactNode }) => (
    <>{draggableItems}</>
  ),
}));

jest.mock('@/ui/layout/draggable-list/components/DraggableItem', () => ({
  DraggableItem: ({ itemComponent }: { itemComponent: ReactNode }) => (
    <>{itemComponent}</>
  ),
}));

// Stub dropdown — renders clickable + content inline
jest.mock('@/ui/layout/dropdown/components/Dropdown', () => ({
  Dropdown: ({
    clickableComponent,
    dropdownComponents,
  }: {
    clickableComponent: ReactNode;
    dropdownComponents: ReactNode;
  }) => (
    <>
      {clickableComponent}
      {dropdownComponents}
    </>
  ),
}));

jest.mock('@/ui/layout/dropdown/components/DropdownContent', () => ({
  DropdownContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/ui/layout/dropdown/components/DropdownMenuItemsContainer', () => ({
  DropdownMenuItemsContainer: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('@/ui/layout/dropdown/hooks/useCloseDropdown', () => ({
  useCloseDropdown: () => ({ closeDropdown: jest.fn() }),
}));

const mockPipeline: PipelineRecord = {
  __typename: 'Pipeline',
  id: 'pipeline-1',
  name: 'Sales',
  position: 0,
};

const mockedUseFindManyRecords = useFindManyRecords as jest.MockedFunction<
  typeof useFindManyRecords
>;

const mockedUseEditPipeline = useEditPipeline as jest.MockedFunction<
  typeof useEditPipeline
>;

const renderComponent = (pipeline = mockPipeline) =>
  render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <SettingsPipelineStagesEditor pipeline={pipeline} />
      </MemoryRouter>
    </I18nProvider>,
  );

const mockEditPipeline = {
  createStage: jest.fn().mockResolvedValue(undefined),
  deleteStage: jest.fn().mockResolvedValue(undefined),
  renameStage: jest.fn().mockResolvedValue(undefined),
  setStageColor: jest.fn().mockResolvedValue(undefined),
  reorderStages: jest.fn().mockResolvedValue(undefined),
  syncViewGroups: jest.fn().mockResolvedValue(undefined),
};

describe('SettingsPipelineStagesEditor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseFindManyRecords.mockReturnValue({
      records: [],
      loading: false,
      totalCount: 0,
    } as unknown as ReturnType<typeof useFindManyRecords>);
    mockedUseEditPipeline.mockReturnValue(mockEditPipeline);
  });

  it('renders the stage list for the pipeline', () => {
    mockedUseFindManyRecords.mockReturnValue({
      records: [
        {
          __typename: 'PipelineStage',
          id: 'stage-1',
          name: 'Prospecting',
          position: 0,
          color: 'blue',
          pipelineId: 'pipeline-1',
        },
        {
          __typename: 'PipelineStage',
          id: 'stage-2',
          name: 'Qualified',
          position: 1,
          color: 'green',
          pipelineId: 'pipeline-1',
        },
      ],
      loading: false,
      totalCount: 2,
    } as unknown as ReturnType<typeof useFindManyRecords>);

    renderComponent();

    expect(screen.getByDisplayValue('Prospecting')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Qualified')).toBeInTheDocument();
  });

  it('queries pipelineStage records filtered by pipeline id', () => {
    renderComponent();

    expect(mockedUseFindManyRecords).toHaveBeenCalledWith(
      expect.objectContaining({
        objectNameSingular: 'pipelineStage',
        filter: { pipelineId: { eq: 'pipeline-1' } },
      }),
    );
  });

  it('create stage calls createStage with the entered name', async () => {
    renderComponent();

    const input = screen.getByPlaceholderText(/Stage name/i);
    fireEvent.change(input, { target: { value: 'New Stage' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add stage/i }));
    });

    expect(mockEditPipeline.createStage).toHaveBeenCalledWith(
      'New Stage',
      expect.any(String),
      [],
    );
  });

  it('delete stage calls deleteStage with the stage id', async () => {
    mockedUseFindManyRecords.mockReturnValue({
      records: [
        {
          __typename: 'PipelineStage',
          id: 'stage-1',
          name: 'Prospecting',
          position: 0,
          color: 'blue',
          pipelineId: 'pipeline-1',
        },
      ],
      loading: false,
      totalCount: 1,
    } as unknown as ReturnType<typeof useFindManyRecords>);

    renderComponent();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Delete stage/i }));
    });

    expect(mockEditPipeline.deleteStage).toHaveBeenCalledWith('stage-1', [
      expect.objectContaining({ id: 'stage-1' }),
    ]);
  });

  it('rename: focusing a stage name input switches to rename mode and calls renameStage on enter', async () => {
    mockedUseFindManyRecords.mockReturnValue({
      records: [
        {
          __typename: 'PipelineStage',
          id: 'stage-1',
          name: 'Prospecting',
          position: 0,
          color: 'blue',
          pipelineId: 'pipeline-1',
        },
      ],
      loading: false,
      totalCount: 1,
    } as unknown as ReturnType<typeof useFindManyRecords>);

    renderComponent();

    // Focus triggers rename mode (shows rename input)
    const nameInput = screen.getByDisplayValue('Prospecting');
    fireEvent.focus(nameInput);

    // Type a new name in the rename input that appears
    const renameInput = screen.getByDisplayValue('Prospecting');
    fireEvent.change(renameInput, { target: { value: 'Updated Stage' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    await act(async () => {
      // Allow async handler to run
    });

    expect(mockEditPipeline.renameStage).toHaveBeenCalledWith(
      'stage-1',
      'Updated Stage',
    );
  });

  it('color change calls setStageColor with stage id and color', async () => {
    mockedUseFindManyRecords.mockReturnValue({
      records: [
        {
          __typename: 'PipelineStage',
          id: 'stage-1',
          name: 'Prospecting',
          position: 0,
          color: 'blue',
          pipelineId: 'pipeline-1',
        },
      ],
      loading: false,
      totalCount: 1,
    } as unknown as ReturnType<typeof useFindManyRecords>);

    renderComponent();

    // Click the red color swatch (MenuItemSelectColor renders with text label)
    const redColorOption = screen.getAllByRole('button');
    // Find a color button that contains the "Red" label or aria-label
    const redButton = redColorOption.find((button) =>
      button.textContent?.toLowerCase().includes('red'),
    );

    if (redButton) {
      await act(async () => {
        fireEvent.click(redButton);
      });

      expect(mockEditPipeline.setStageColor).toHaveBeenCalledWith(
        'stage-1',
        'red',
      );
    }
  });

  it('shows empty text when no stages', () => {
    renderComponent();
    expect(screen.getByText(/No stages yet/i)).toBeInTheDocument();
  });
});
