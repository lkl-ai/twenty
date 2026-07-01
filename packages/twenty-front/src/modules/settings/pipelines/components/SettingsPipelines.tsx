import { useState } from 'react';

import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useDeleteOneRecord } from '@/object-record/hooks/useDeleteOneRecord';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useEnsurePipelineView } from '@/pipelines/hooks/useEnsurePipelineView';
import { usePipelines } from '@/pipelines/hooks/usePipelines';
import { type PipelineRecord } from '@/pipelines/types/PipelineRecord';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { SettingsPipelineStagesEditor } from '@/settings/pipelines/components/SettingsPipelineStagesEditor';
import { TextInput } from '@/ui/input/components/TextInput';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import {
  IconChevronDown,
  IconChevronUp,
  IconCheck,
  IconLayoutList,
  IconPencil,
  IconPlus,
  IconStar,
  IconTrash,
  IconX,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

const StyledPipelineRow = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing['2']};
  padding: ${themeCssVariables.spacing['2']} 0;
`;

const StyledPipelineName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  flex: 1;
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledDefaultBadge = styled.span`
  background: ${themeCssVariables.color.blue10};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.color.blue};
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing['1']} ${themeCssVariables.spacing['2']};
`;

const StyledRowActions = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing['1']};
`;

const StyledAddForm = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing['2']};
  margin-top: ${themeCssVariables.spacing['3']};
`;

const StyledEmptyState = styled.p`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledPipelineBlock = styled.div`
  border-bottom: 1px solid ${themeCssVariables.border.color.light};

  &:last-child {
    border-bottom: none;
  }
`;

const StyledStagesPanel = styled.div`
  background: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  margin-bottom: ${themeCssVariables.spacing['3']};
  padding: ${themeCssVariables.spacing['3']};
`;

const StyledStagesPanelTitle = styled.div`
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin-bottom: ${themeCssVariables.spacing['2']};
`;

const StyledRenameInput = styled.div`
  align-items: center;
  display: flex;
  flex: 1;
  gap: ${themeCssVariables.spacing['1']};
`;

export const SettingsPipelines = () => {
  const { t } = useLingui();

  const [newPipelineName, setNewPipelineName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expandedStagesPipelineId, setExpandedStagesPipelineId] = useState<
    string | null
  >(null);

  const { pipelines, loading } = usePipelines();
  const { ensurePipelineView } = useEnsurePipelineView();

  const { createOneRecord } = useCreateOneRecord<PipelineRecord>({
    objectNameSingular: 'pipeline',
  });

  const { updateOneRecord } = useUpdateOneRecord();

  const { deleteOneRecord } = useDeleteOneRecord({
    objectNameSingular: 'pipeline',
  });

  const handleCreate = async () => {
    const trimmedName = newPipelineName.trim();
    if (!trimmedName) {
      return;
    }

    const nextPosition = pipelines.length;
    const created = await createOneRecord({
      name: trimmedName,
      position: nextPosition,
    } as Partial<PipelineRecord>);

    if (isDefined(created)) {
      const createdPipeline = created as unknown as PipelineRecord;
      // A newly-created pipeline has no stages yet — pass an empty array.
      // Stages are managed separately via SettingsPipelineStagesEditor.
      await ensurePipelineView(createdPipeline, []);
    }

    setNewPipelineName('');
    setIsCreating(false);
  };

  const handleDelete = async (pipelineId: string) => {
    await deleteOneRecord(pipelineId);
  };

  const handleMoveUp = async (pipeline: PipelineRecord) => {
    const currentIndex = pipelines.findIndex(
      (existingPipeline) => existingPipeline.id === pipeline.id,
    );
    if (currentIndex <= 0) {
      return;
    }

    const previousPipeline = pipelines[currentIndex - 1];

    await Promise.all([
      updateOneRecord({
        objectNameSingular: 'pipeline',
        idToUpdate: pipeline.id,
        updateOneRecordInput: { position: previousPipeline.position },
      }),
      updateOneRecord({
        objectNameSingular: 'pipeline',
        idToUpdate: previousPipeline.id,
        updateOneRecordInput: { position: pipeline.position },
      }),
    ]);
  };

  const handleMoveDown = async (pipeline: PipelineRecord) => {
    const currentIndex = pipelines.findIndex(
      (existingPipeline) => existingPipeline.id === pipeline.id,
    );
    if (currentIndex < 0 || currentIndex >= pipelines.length - 1) {
      return;
    }

    const nextPipeline = pipelines[currentIndex + 1];

    await Promise.all([
      updateOneRecord({
        objectNameSingular: 'pipeline',
        idToUpdate: pipeline.id,
        updateOneRecordInput: { position: nextPipeline.position },
      }),
      updateOneRecord({
        objectNameSingular: 'pipeline',
        idToUpdate: nextPipeline.id,
        updateOneRecordInput: { position: pipeline.position },
      }),
    ]);
  };

  const handleSetDefault = async (pipeline: PipelineRecord) => {
    const currentDefault = pipelines.find(
      (existingPipeline) => existingPipeline.isDefault === true,
    );

    const updates: Promise<unknown>[] = [
      updateOneRecord({
        objectNameSingular: 'pipeline',
        idToUpdate: pipeline.id,
        updateOneRecordInput: { isDefault: true },
      }),
    ];

    if (isDefined(currentDefault) && currentDefault.id !== pipeline.id) {
      updates.push(
        updateOneRecord({
          objectNameSingular: 'pipeline',
          idToUpdate: currentDefault.id,
          updateOneRecordInput: { isDefault: false },
        }),
      );
    }

    await Promise.all(updates);
  };

  const handleStartRename = (pipeline: PipelineRecord) => {
    setRenamingId(pipeline.id);
    setRenameValue(pipeline.name);
  };

  const handleCancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  const handleConfirmRename = async (pipeline: PipelineRecord) => {
    const trimmedName = renameValue.trim();
    if (trimmedName && trimmedName !== pipeline.name) {
      await updateOneRecord({
        objectNameSingular: 'pipeline',
        idToUpdate: pipeline.id,
        updateOneRecordInput: { name: trimmedName },
      });
    }
    setRenamingId(null);
    setRenameValue('');
  };

  return (
    <SettingsPageLayout
      title={t`Pipelines`}
      actionButton={
        <Button
          Icon={IconPlus}
          title={t`Add pipeline`}
          accent="blue"
          size="small"
          onClick={() => setIsCreating(true)}
        />
      }
      links={[
        {
          children: t`Workspace`,
          href: getSettingsPath(SettingsPath.General),
        },
        { children: t`Pipelines` },
      ]}
    >
      <SettingsPageContainer>
        <Section>
          <H2Title
            title={t`Pipelines`}
            description={t`Manage and reorder your sales pipelines`}
          />
          {loading ? null : pipelines.length === 0 ? (
            <StyledEmptyState>
              {t`No pipelines yet. Create one to get started.`}
            </StyledEmptyState>
          ) : (
            pipelines.map((pipeline, index) => (
              <StyledPipelineBlock key={pipeline.id}>
                <StyledPipelineRow>
                  {renamingId === pipeline.id ? (
                    <StyledRenameInput>
                      <TextInput
                        value={renameValue}
                        onChange={setRenameValue}
                        autoFocus
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            handleConfirmRename(pipeline);
                          } else if (event.key === 'Escape') {
                            handleCancelRename();
                          }
                        }}
                      />
                      <Button
                        Icon={IconCheck}
                        size="small"
                        variant="tertiary"
                        disabled={!renameValue.trim()}
                        onClick={() => handleConfirmRename(pipeline)}
                        ariaLabel={t`Confirm rename`}
                      />
                      <Button
                        Icon={IconX}
                        size="small"
                        variant="tertiary"
                        onClick={handleCancelRename}
                        ariaLabel={t`Cancel rename`}
                      />
                    </StyledRenameInput>
                  ) : (
                    <>
                      <StyledPipelineName>{pipeline.name}</StyledPipelineName>
                      {pipeline.isDefault === true && (
                        <StyledDefaultBadge>{t`Default`}</StyledDefaultBadge>
                      )}
                      <StyledRowActions>
                        <Button
                          Icon={IconLayoutList}
                          size="small"
                          variant={
                            expandedStagesPipelineId === pipeline.id
                              ? 'primary'
                              : 'tertiary'
                          }
                          onClick={() =>
                            setExpandedStagesPipelineId(
                              expandedStagesPipelineId === pipeline.id
                                ? null
                                : pipeline.id,
                            )
                          }
                          ariaLabel={t`Edit stages`}
                        />
                        <Button
                          Icon={IconPencil}
                          size="small"
                          variant="tertiary"
                          onClick={() => handleStartRename(pipeline)}
                          ariaLabel={t`Rename pipeline`}
                        />
                        {pipeline.isDefault !== true && (
                          <Button
                            Icon={IconStar}
                            size="small"
                            variant="tertiary"
                            onClick={() => handleSetDefault(pipeline)}
                            ariaLabel={t`Set as default pipeline`}
                          />
                        )}
                        <Button
                          Icon={IconChevronUp}
                          size="small"
                          variant="tertiary"
                          disabled={index === 0}
                          onClick={() => handleMoveUp(pipeline)}
                          ariaLabel={t`Move pipeline up`}
                        />
                        <Button
                          Icon={IconChevronDown}
                          size="small"
                          variant="tertiary"
                          disabled={index === pipelines.length - 1}
                          onClick={() => handleMoveDown(pipeline)}
                          ariaLabel={t`Move pipeline down`}
                        />
                        <Button
                          Icon={IconTrash}
                          size="small"
                          variant="tertiary"
                          accent="danger"
                          onClick={() => handleDelete(pipeline.id)}
                          ariaLabel={t`Delete pipeline`}
                        />
                      </StyledRowActions>
                    </>
                  )}
                </StyledPipelineRow>
                {expandedStagesPipelineId === pipeline.id && (
                  <StyledStagesPanel>
                    <StyledStagesPanelTitle>{t`Stages`}</StyledStagesPanelTitle>
                    <SettingsPipelineStagesEditor pipeline={pipeline} />
                  </StyledStagesPanel>
                )}
              </StyledPipelineBlock>
            ))
          )}

          {isCreating && (
            <StyledAddForm>
              <TextInput
                value={newPipelineName}
                onChange={setNewPipelineName}
                placeholder={t`Pipeline name`}
                autoFocus
              />
              <Button
                title={t`Save`}
                accent="blue"
                size="small"
                onClick={handleCreate}
                disabled={!newPipelineName.trim()}
              />
              <Button
                title={t`Cancel`}
                variant="secondary"
                size="small"
                onClick={() => {
                  setNewPipelineName('');
                  setIsCreating(false);
                }}
              />
            </StyledAddForm>
          )}
        </Section>
      </SettingsPageContainer>
    </SettingsPageLayout>
  );
};
