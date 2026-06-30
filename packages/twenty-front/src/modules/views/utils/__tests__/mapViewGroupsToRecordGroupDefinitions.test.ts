import {
  mapViewGroupsToRecordGroupDefinitions,
} from '@/views/utils/mapViewGroupsToRecordGroupDefinitions';
import { RecordGroupDefinitionType } from '@/object-record/record-group/types/RecordGroupDefinition';
import { FieldMetadataType } from '~/generated-metadata/graphql';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';

// Minimal fixture helpers
const STAGE_A_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const STAGE_B_ID = 'bbbbbbbb-0000-0000-0000-000000000002';
const PIPELINE_STAGE_FIELD_ID = 'ffffffff-0000-0000-0000-000000000003';

const relationFieldMetadataItem = {
  id: PIPELINE_STAGE_FIELD_ID,
  name: 'pipelineStage',
  label: 'Pipeline Stage',
  type: FieldMetadataType.RELATION,
  isNullable: true,
  options: undefined,
  relation: {
    type: 'MANY_TO_ONE',
    targetObjectMetadata: {
      nameSingular: 'pipelineStage',
      namePlural: 'pipelineStages',
    },
    targetFieldMetadata: { name: 'opportunities' },
  },
} as unknown as EnrichedObjectMetadataItem['fields'][number];

const mockObjectMetadataItem = {
  id: 'obj-id',
  nameSingular: 'opportunity',
  namePlural: 'opportunities',
  fields: [relationFieldMetadataItem],
} as unknown as EnrichedObjectMetadataItem;

describe('mapViewGroupsToRecordGroupDefinitions — relation (MANY_TO_ONE) field', () => {
  it('maps relation viewGroups to RecordGroupDefinitions with fieldValue as value', () => {
    const viewGroups = [
      { id: 'vg-1', fieldValue: STAGE_A_ID, position: 0, isVisible: true },
      { id: 'vg-2', fieldValue: STAGE_B_ID, position: 1, isVisible: true },
    ];

    const result = mapViewGroupsToRecordGroupDefinitions({
      mainGroupByFieldMetadataId: PIPELINE_STAGE_FIELD_ID,
      objectMetadataItem: mockObjectMetadataItem,
      viewGroups,
    });

    expect(result).toHaveLength(2);

    // First group: value = stage record id (UUID)
    expect(result[0]).toMatchObject({
      id: 'vg-1',
      type: RecordGroupDefinitionType.Value,
      value: STAGE_A_ID,
      color: 'transparent',
      position: 0,
      isVisible: true,
    });

    // Second group: value = stage record id (UUID)
    expect(result[1]).toMatchObject({
      id: 'vg-2',
      type: RecordGroupDefinitionType.Value,
      value: STAGE_B_ID,
      color: 'transparent',
      position: 1,
      isVisible: true,
    });
  });

  it('maps empty fieldValue viewGroup to a NoValue group with null value', () => {
    const viewGroups = [
      { id: 'vg-no', fieldValue: '', position: 2, isVisible: true },
    ];

    const result = mapViewGroupsToRecordGroupDefinitions({
      mainGroupByFieldMetadataId: PIPELINE_STAGE_FIELD_ID,
      objectMetadataItem: mockObjectMetadataItem,
      viewGroups,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'vg-no',
      type: RecordGroupDefinitionType.NoValue,
      value: null,
      color: 'transparent',
    });
  });

  it('returns groups sorted by position', () => {
    const viewGroups = [
      { id: 'vg-b', fieldValue: STAGE_B_ID, position: 1, isVisible: true },
      { id: 'vg-a', fieldValue: STAGE_A_ID, position: 0, isVisible: true },
    ];

    const result = mapViewGroupsToRecordGroupDefinitions({
      mainGroupByFieldMetadataId: PIPELINE_STAGE_FIELD_ID,
      objectMetadataItem: mockObjectMetadataItem,
      viewGroups,
    });

    expect(result[0].id).toBe('vg-a');
    expect(result[1].id).toBe('vg-b');
  });

  it('returns empty array when viewGroups is empty', () => {
    const result = mapViewGroupsToRecordGroupDefinitions({
      mainGroupByFieldMetadataId: PIPELINE_STAGE_FIELD_ID,
      objectMetadataItem: mockObjectMetadataItem,
      viewGroups: [],
    });

    expect(result).toHaveLength(0);
  });
});
