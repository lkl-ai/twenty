import { useState } from 'react';
import { type DropResult } from '@hello-pangea/dnd';
import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';

import { useFindManyRecords } from '@/object-record/hooks/useFindManyRecords';
import {
  type PipelineRecord,
  type PipelineStageRecord,
} from '@/pipelines/types/PipelineRecord';
import { useEditPipeline } from '@/settings/pipelines/hooks/useEditPipeline';
import { SettingsTextInput } from '@/ui/input/components/SettingsTextInput';
import { DraggableItem } from '@/ui/layout/draggable-list/components/DraggableItem';
import { DraggableList } from '@/ui/layout/draggable-list/components/DraggableList';
import { Dropdown } from '@/ui/layout/dropdown/components/Dropdown';
import { DropdownContent } from '@/ui/layout/dropdown/components/DropdownContent';
import { DropdownMenuItemsContainer } from '@/ui/layout/dropdown/components/DropdownMenuItemsContainer';
import { useCloseDropdown } from '@/ui/layout/dropdown/hooks/useCloseDropdown';
import { ColorSample } from 'twenty-ui/data-display';
import { IconGripVertical, IconPlus, IconTrash } from 'twenty-ui/icon';
import { LightButton, LightIconButton } from 'twenty-ui/input';
import { type ColorLabels, MenuItemSelectColor } from 'twenty-ui/navigation';
import { MAIN_COLOR_NAMES, type ThemeColor } from 'twenty-ui/theme';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { moveArrayItem } from '~/utils/array/moveArrayItem';

type SettingsPipelineStagesEditorProps = {
  pipeline: PipelineRecord;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
  width: 100%;
`;

const StyledRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  min-height: ${themeCssVariables.spacing[7]};
  padding: ${themeCssVariables.spacing['1']} 0;
`;

const StyledGripContainer = styled.span`
  align-items: center;
  cursor: grab;
  display: flex;
`;

const StyledColorContainer = styled.span`
  align-items: center;
  cursor: pointer;
  display: flex;
`;

const StyledNameContainer = styled.div`
  flex: 1;

  & input {
    height: ${themeCssVariables.spacing[6]};
  }
`;

const StyledAddRow = styled.div`
  align-items: center;
  display: flex;
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledEmptyText = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin: 0;
`;

const useColorLabels = (): ColorLabels => {
  const { t } = useLingui();
  return {
    gray: t`Gray`,
    tomato: t`Tomato`,
    red: t`Red`,
    ruby: t`Ruby`,
    crimson: t`Crimson`,
    pink: t`Pink`,
    plum: t`Plum`,
    purple: t`Purple`,
    violet: t`Violet`,
    iris: t`Iris`,
    cyan: t`Cyan`,
    turquoise: t`Turquoise`,
    sky: t`Sky`,
    blue: t`Blue`,
    jade: t`Jade`,
    green: t`Green`,
    grass: t`Grass`,
    mint: t`Mint`,
    lime: t`Lime`,
    bronze: t`Bronze`,
    gold: t`Gold`,
    brown: t`Brown`,
    orange: t`Orange`,
    amber: t`Amber`,
    yellow: t`Yellow`,
  };
};

const DEFAULT_STAGE_COLOR = 'green';

export const SettingsPipelineStagesEditor = ({
  pipeline,
}: SettingsPipelineStagesEditorProps) => {
  const { t } = useLingui();
  const colorLabels = useColorLabels();

  const [newStageName, setNewStageName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const { records: stageRecords, loading } =
    useFindManyRecords<PipelineStageRecord>({
      objectNameSingular: 'pipelineStage',
      filter: { pipelineId: { eq: pipeline.id } },
      orderBy: [{ position: 'AscNullsLast' }],
      recordGqlFields: {
        id: true,
        name: true,
        position: true,
        color: true,
        pipelineId: true,
      },
    });

  const {
    createStage,
    deleteStage,
    renameStage,
    setStageColor,
    reorderStages,
  } = useEditPipeline(pipeline);

  const { closeDropdown: closeColorDropdown } = useCloseDropdown();

  const handleAddStage = async () => {
    const trimmedName = newStageName.trim();
    if (!trimmedName) {
      return;
    }
    await createStage(trimmedName, DEFAULT_STAGE_COLOR, stageRecords);
    setNewStageName('');
  };

  const handleDeleteStage = async (stageId: string) => {
    await deleteStage(stageId, stageRecords);
  };

  const handleStartRename = (stage: PipelineStageRecord) => {
    setRenamingId(stage.id);
    setRenameValue(stage.name);
  };

  const handleConfirmRename = async (stageId: string) => {
    const trimmedName = renameValue.trim();
    if (trimmedName) {
      await renameStage(stageId, trimmedName);
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleColorChange = async (stageId: string, color: string) => {
    await setStageColor(stageId, color);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    if (result.source.index === result.destination.index) {
      return;
    }

    const reordered = moveArrayItem(stageRecords, {
      fromIndex: result.source.index,
      toIndex: result.destination.index,
    }).map((stage, index) => ({ ...stage, position: index }));

    await reorderStages(reordered);
  };

  if (loading) {
    return null;
  }

  return (
    <StyledContainer>
      {stageRecords.length === 0 ? (
        <StyledEmptyText>{t`No stages yet. Add one below.`}</StyledEmptyText>
      ) : (
        <DraggableList
          onDragEnd={handleDragEnd}
          draggableItems={
            <>
              {stageRecords.map((stage, index) => {
                const colorDropdownId = `stage-color-dropdown-${stage.id}`;

                return (
                  <DraggableItem
                    key={stage.id}
                    draggableId={stage.id}
                    index={index}
                    isDragDisabled={stageRecords.length === 1}
                    isInsideScrollableContainer
                    itemComponent={
                      <StyledRow>
                        <StyledGripContainer>
                          <IconGripVertical
                            size={16}
                            color={themeCssVariables.font.color.extraLight}
                          />
                        </StyledGripContainer>

                        <Dropdown
                          dropdownId={colorDropdownId}
                          dropdownPlacement="bottom-start"
                          clickableComponent={
                            <StyledColorContainer>
                              <ColorSample
                                colorName={
                                  (stage.color ??
                                    DEFAULT_STAGE_COLOR) as ThemeColor
                                }
                              />
                            </StyledColorContainer>
                          }
                          dropdownComponents={
                            <DropdownContent>
                              <DropdownMenuItemsContainer>
                                {MAIN_COLOR_NAMES.map((colorName) => (
                                  <MenuItemSelectColor
                                    key={colorName}
                                    color={colorName}
                                    selected={
                                      colorName ===
                                      (stage.color ?? DEFAULT_STAGE_COLOR)
                                    }
                                    colorLabels={colorLabels}
                                    onClick={async () => {
                                      await handleColorChange(
                                        stage.id,
                                        colorName,
                                      );
                                      closeColorDropdown(colorDropdownId);
                                    }}
                                  />
                                ))}
                              </DropdownMenuItemsContainer>
                            </DropdownContent>
                          }
                        />

                        <StyledNameContainer>
                          {renamingId === stage.id ? (
                            <SettingsTextInput
                              instanceId={`stage-rename-${stage.id}`}
                              value={renameValue}
                              onChange={setRenameValue}
                              autoFocusOnMount
                              autoSelectOnMount
                              onInputEnter={() => handleConfirmRename(stage.id)}
                            />
                          ) : (
                            <SettingsTextInput
                              instanceId={`stage-name-${stage.id}`}
                              value={stage.name}
                              onChange={() => {
                                // Switch to rename mode on any edit
                                handleStartRename(stage);
                              }}
                              onFocus={() => handleStartRename(stage)}
                            />
                          )}
                        </StyledNameContainer>

                        <LightIconButton
                          Icon={IconTrash}
                          accent="tertiary"
                          onClick={() => handleDeleteStage(stage.id)}
                          aria-label={t`Delete stage`}
                        />
                      </StyledRow>
                    }
                  />
                );
              })}
            </>
          }
        />
      )}

      <StyledAddRow>
        <SettingsTextInput
          instanceId={`new-stage-${pipeline.id}`}
          value={newStageName}
          onChange={setNewStageName}
          placeholder={t`Stage name`}
          onInputEnter={handleAddStage}
        />
        <LightButton
          title={t`Add stage`}
          Icon={IconPlus}
          onClick={handleAddStage}
        />
      </StyledAddRow>
    </StyledContainer>
  );
};
