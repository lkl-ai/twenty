import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { type FlatEntityMaps } from 'src/engine/metadata-modules/flat-entity/types/flat-entity-maps.type';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';

const PIPELINE_FIELD_NAME = 'pipeline';
const PIPELINE_STAGE_FIELD_NAME = 'pipelineStage';
const FIELD_OLD_NAME_SUFFIX = 'Old';
const FIELD_OLD_LABEL_SUFFIX = ' (Old)';
const MAX_OLD_NAME_ATTEMPTS = 100;

const PIPELINE_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIERS = new Set<string>([
  STANDARD_OBJECTS.opportunity.fields.pipeline.universalIdentifier,
  STANDARD_OBJECTS.opportunity.fields.pipelineStage.universalIdentifier,
]);

const PIPELINE_OPPORTUNITY_FIELD_NAMES = [
  PIPELINE_FIELD_NAME,
  PIPELINE_STAGE_FIELD_NAME,
];

export const findOpportunityFieldNameCollisionsForPipeline = (
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>,
): FlatFieldMetadata[] =>
  Object.values(flatFieldMetadataMaps.byUniversalIdentifier).filter(
    (flatFieldMetadata): flatFieldMetadata is FlatFieldMetadata =>
      isDefined(flatFieldMetadata) &&
      flatFieldMetadata.objectMetadataUniversalIdentifier ===
        STANDARD_OBJECTS.opportunity.universalIdentifier &&
      !PIPELINE_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIERS.has(
        flatFieldMetadata.universalIdentifier,
      ) &&
      PIPELINE_OPPORTUNITY_FIELD_NAMES.includes(flatFieldMetadata.name),
  );

export const resolveAvailableOldOpportunityFieldName = ({
  flatFieldMetadataMaps,
  originalFieldName,
  additionalTakenNames = new Set(),
}: {
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  originalFieldName: string;
  additionalTakenNames?: ReadonlySet<string>;
}): string => {
  const takenFieldNames = new Set([
    ...Object.values(flatFieldMetadataMaps.byUniversalIdentifier)
      .filter(isDefined)
      .filter(
        (flatFieldMetadata) =>
          flatFieldMetadata.objectMetadataUniversalIdentifier ===
          STANDARD_OBJECTS.opportunity.universalIdentifier,
      )
      .map((flatFieldMetadata) => flatFieldMetadata.name),
    ...additionalTakenNames,
  ]);

  for (let attempt = 0; attempt < MAX_OLD_NAME_ATTEMPTS; attempt++) {
    const discriminator = attempt === 0 ? '' : `${attempt + 1}`;
    const candidateName = `${originalFieldName}${FIELD_OLD_NAME_SUFFIX}${discriminator}`;

    if (!takenFieldNames.has(candidateName)) {
      return candidateName;
    }
  }

  throw new Error(
    `Could not find an available ${originalFieldName}Old name after ${MAX_OLD_NAME_ATTEMPTS} attempts`,
  );
};

export const buildOpportunityFieldRenameUpdatesForPipeline = ({
  flatFieldMetadataMaps,
  now,
}: {
  flatFieldMetadataMaps: FlatEntityMaps<FlatFieldMetadata>;
  now: string;
}): FlatFieldMetadata[] => {
  const reservedOldFieldNames = new Set<string>();

  return findOpportunityFieldNameCollisionsForPipeline(
    flatFieldMetadataMaps,
  ).map((collidingFieldMetadata) => {
    const name = resolveAvailableOldOpportunityFieldName({
      flatFieldMetadataMaps,
      originalFieldName: collidingFieldMetadata.name,
      additionalTakenNames: reservedOldFieldNames,
    });
    const oldNamePrefix = `${collidingFieldMetadata.name}${FIELD_OLD_NAME_SUFFIX}`;
    const discriminator = name.slice(oldNamePrefix.length);
    const labelSuffix =
      discriminator === ''
        ? FIELD_OLD_LABEL_SUFFIX
        : `${FIELD_OLD_LABEL_SUFFIX} ${discriminator}`;

    reservedOldFieldNames.add(name);

    return {
      ...collidingFieldMetadata,
      name,
      label: `${collidingFieldMetadata.label}${labelSuffix}`,
      isLabelSyncedWithName: false,
      updatedAt: now,
    };
  });
};
