import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
import { useEnsurePipelineView } from '@/pipelines/hooks/useEnsurePipelineView';
import { usePipelines } from '@/pipelines/hooks/usePipelines';
import { type PipelineRecord } from '@/pipelines/types/PipelineRecord';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useChangeView } from '@/views/hooks/useChangeView';
import { viewsSelector } from '@/views/states/selectors/viewsSelector';
import { type ViewFilter } from '@/views/types/ViewFilter';
import { styled } from '@linaria/react';
import { isDefined } from 'twenty-shared/utils';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledTabBar = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border-bottom: 1px solid ${themeCssVariables.border.color.medium};
  display: flex;
  flex-direction: row;
  overflow-x: auto;
  padding: 0 ${themeCssVariables.spacing[3]};
`;

const StyledTab = styled.button<{ isActive: boolean }>`
  background: none;
  border: none;
  border-bottom: 2px solid
    ${({ isActive }) =>
      isActive ? themeCssVariables.font.color.primary : 'transparent'};
  color: ${({ isActive }) =>
    isActive
      ? themeCssVariables.font.color.primary
      : themeCssVariables.font.color.secondary};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${({ isActive }) =>
    isActive
      ? themeCssVariables.font.weight.semiBold
      : themeCssVariables.font.weight.regular};
  padding: ${themeCssVariables.spacing[2]} ${themeCssVariables.spacing[2]};
  transition: color 0.1s ease;
  white-space: nowrap;

  &:hover {
    color: ${themeCssVariables.font.color.primary};
  }
`;

// Returns the pipeline id that the given filter array scopes the view to,
// or undefined if no such filter is found.
const getPipelineIdFromFilters = (
  filters: ViewFilter[],
  pipelineFieldMetadataId: string,
): string | undefined => {
  for (const filter of filters) {
    if (filter.fieldMetadataId !== pipelineFieldMetadataId) {
      continue;
    }
    if ((filter.operand as string) !== 'IS') {
      continue;
    }
    try {
      const parsed = JSON.parse(filter.value) as {
        selectedRecordIds?: string[];
      };
      const firstId = parsed.selectedRecordIds?.[0];
      if (isDefined(firstId)) {
        return firstId;
      }
    } catch {
      // Non-parseable filter values are silently skipped.
    }
  }
  return undefined;
};

export const PipelineSwitcher = () => {
  const { pipelines, loading } = usePipelines();
  const { ensurePipelineView } = useEnsurePipelineView();
  const { changeView } = useChangeView();

  const contextStoreCurrentViewId = useAtomComponentStateValue(
    contextStoreCurrentViewIdComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );

  const views = useAtomStateValue(viewsSelector);

  const currentView = isDefined(contextStoreCurrentViewId)
    ? views.find((view) => view.id === contextStoreCurrentViewId)
    : undefined;

  // Determine the active pipeline by scanning the current view's filters for
  // an IS-filter that matches the pipeline field. We find the pipeline field
  // id by looking for a filter whose parsed value contains selectedRecordIds
  // — the first such IS-filter is the pipeline scope filter.
  const activePipelineId: string | undefined = (() => {
    if (!isDefined(currentView)) {
      return undefined;
    }
    const pipelineIsFilter = currentView.viewFilters.find((filter) => {
      if ((filter.operand as string) !== 'IS') {
        return false;
      }
      try {
        const parsed = JSON.parse(filter.value) as {
          selectedRecordIds?: unknown;
        };
        return Array.isArray(parsed.selectedRecordIds);
      } catch {
        return false;
      }
    });
    if (!isDefined(pipelineIsFilter)) {
      return undefined;
    }
    return getPipelineIdFromFilters(
      currentView.viewFilters,
      pipelineIsFilter.fieldMetadataId,
    );
  })();

  if (loading || pipelines.length === 0) {
    return null;
  }

  const handleTabClick = async (pipeline: PipelineRecord) => {
    const stages =
      pipeline.pipelineStages?.edges.map((edge) => edge.node) ?? [];
    const viewId = await ensurePipelineView(pipeline, stages);
    if (isDefined(viewId)) {
      changeView(viewId);
    }
  };

  return (
    <StyledTabBar>
      {pipelines.map((pipeline) => (
        <StyledTab
          key={pipeline.id}
          isActive={pipeline.id === activePipelineId}
          onClick={() => {
            void handleTabClick(pipeline);
          }}
        >
          {pipeline.name}
        </StyledTab>
      ))}
    </StyledTabBar>
  );
};
