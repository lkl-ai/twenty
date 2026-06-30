import { useState } from 'react';

import { useCreateOneRecord } from '@/object-record/hooks/useCreateOneRecord';
import { useDeleteOneRecord } from '@/object-record/hooks/useDeleteOneRecord';
import { useUpdateOneRecord } from '@/object-record/hooks/useUpdateOneRecord';
import { useEnsurePipelineView } from '@/pipelines/hooks/useEnsurePipelineView';
import { usePipelines } from '@/pipelines/hooks/usePipelines';
import {
  type PipelineRecord,
  type PipelineStageRecord,
} from '@/pipelines/types/PipelineRecord';
import { SettingsPageContainer } from '@/settings/components/SettingsPageContainer';
import { SettingsPageLayout } from '@/settings/components/layout/SettingsPageLayout';
import { TextInput } from '@/ui/input/components/TextInput';
import { useLingui } from '@lingui/react/macro';
import { styled } from '@linaria/react';
import { SettingsPath } from 'twenty-shared/types';
import { getSettingsPath, isDefined } from 'twenty-shared/utils';
import {
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconTrash,
} from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { Section } from 'twenty-ui/layout';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { H2Title } from 'twenty-ui/typography';

const StyledPipelineRow = styled.div`
  align-items: center;
  border-bottom: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  gap: ${themeCssVariables.spacing['2']};
  padding: ${themeCssVariables.spacing['2']} 0;

  &:last-child {
    border-bottom: none;
  }
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

export const SettingsPipelines = () => {
  const { t } = useLingui();

  const [newPipelineName, setNewPipelineName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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
      const stages: PipelineStageRecord[] =
        createdPipeline.pipelineStages?.edges.map(
          (edge: { node: PipelineStageRecord }) => edge.node,
        ) ?? [];
      await ensurePipelineView(createdPipeline, stages);
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
              <StyledPipelineRow key={pipeline.id}>
                <StyledPipelineName>{pipeline.name}</StyledPipelineName>
                {/* First pipeline by position is the default */}
                {index === 0 && (
                  <StyledDefaultBadge>{t`Default`}</StyledDefaultBadge>
                )}
                <StyledRowActions>
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
              </StyledPipelineRow>
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
