import { MAIN_CONTEXT_STORE_INSTANCE_ID } from '@/context-store/constants/MainContextStoreInstanceId';
import { contextStoreCurrentViewIdComponentState } from '@/context-store/states/contextStoreCurrentViewIdComponentState';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useEnsurePipelineView } from '@/pipelines/hooks/useEnsurePipelineView';
import { usePipelines } from '@/pipelines/hooks/usePipelines';
import { type PipelineRecord } from '@/pipelines/types/PipelineRecord';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useChangeView } from '@/views/hooks/useChangeView';
import { viewsSelector } from '@/views/states/selectors/viewsSelector';
import { type ViewFilter } from '@/views/types/ViewFilter';
import { styled } from '@linaria/react';
import { type ButtonHTMLAttributes, type ReactNode } from 'react';
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

// Linaria forwards all props to the underlying DOM element. To prevent
// `isActive` (a non-standard HTML attribute) from reaching the <button> and
// triggering React's "unknown prop" warning, we destructure it in a plain
// wrapper component and pass only valid HTML attributes to the styled inner
// element. This is the codebase convention for boolean props that must not
// reach the DOM — see PageLayoutTabListDroppableMoreButton, RecordTableRowDiv.
const StyledTabInner = styled.button<{ isActive: boolean }>`
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

type StyledTabProps = {
  isActive: boolean;
  onClick: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
  children: ReactNode;
};

const StyledTab = ({ isActive, onClick, children }: StyledTabProps) => (
  <StyledTabInner isActive={isActive} onClick={onClick}>
    {children}
  </StyledTabInner>
);

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

  const { objectMetadataItem: opportunityMetadataItem } = useObjectMetadataItem(
    { objectNameSingular: 'opportunity' },
  );

  // Resolve the pipeline relation field's metadata id from the Opportunity
  // object schema. This avoids a heuristic approach that could misfire on
  // other relation filters (company, assignee) that share the same IS-filter
  // shape.
  const pipelineFieldMetadataId = opportunityMetadataItem.fields?.find(
    (field) => field.name === 'pipeline',
  )?.id;

  const contextStoreCurrentViewId = useAtomComponentStateValue(
    contextStoreCurrentViewIdComponentState,
    MAIN_CONTEXT_STORE_INSTANCE_ID,
  );

  const views = useAtomStateValue(viewsSelector);

  const currentView = isDefined(contextStoreCurrentViewId)
    ? views.find((view) => view.id === contextStoreCurrentViewId)
    : undefined;

  // Determine the active pipeline by finding the pipeline IS-filter in the
  // current view and reading the first selectedRecordId from its value.
  // We match exclusively on the pipeline field's fieldMetadataId so other
  // relation filters (company, assignee) on Opportunity are never mistaken
  // for the pipeline scope filter.
  const activePipelineId: string | undefined = (() => {
    if (!isDefined(currentView) || !isDefined(pipelineFieldMetadataId)) {
      return undefined;
    }
    return getPipelineIdFromFilters(
      currentView.viewFilters,
      pipelineFieldMetadataId,
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
