import { SEED_APPLE_WORKSPACE_ID } from 'src/engine/workspace-manager/dev-seeder/core/constants/seeder-workspaces.constant';

// Verifies that the pipeline and pipelineStage standard objects materialize
// correctly in the workspace metadata and that the opportunity object has the
// expected FK relation fields pointing to both objects.
//
// This is the definitive schema-materialization gate for the native-pipelines
// feature: it confirms the field builder + STANDARD_OBJECTS registry produce
// the correct metadata rows after a full database:reset / workspace sync.

type ObjectMetadataRow = { id: string; nameSingular: string };
type FieldMetadataRow = { name: string };

const queryObjectMetadataByWorkspace = (
  workspaceId: string,
): Promise<ObjectMetadataRow[]> =>
  global.testDataSource.query(
    `SELECT id, "nameSingular" FROM core."objectMetadata" WHERE "workspaceId" = $1`,
    [workspaceId],
  );

const queryFieldMetadataByObjectMetadataId = (
  objectMetadataId: string,
): Promise<FieldMetadataRow[]> =>
  global.testDataSource.query(
    `SELECT name FROM core."fieldMetadata" WHERE "objectMetadataId" = $1`,
    [objectMetadataId],
  );

describe('pipeline + pipelineStage standard objects - schema materialization', () => {
  it('creates pipeline and pipelineStage object metadata for the seed workspace', async () => {
    const objects = await queryObjectMetadataByWorkspace(
      SEED_APPLE_WORKSPACE_ID,
    );
    const objectNames = objects.map((o) => o.nameSingular);

    expect(objectNames).toEqual(
      expect.arrayContaining(['pipeline', 'pipelineStage']),
    );
  });

  it('adds pipeline and pipelineStage relation fields to the opportunity object', async () => {
    const objects = await queryObjectMetadataByWorkspace(
      SEED_APPLE_WORKSPACE_ID,
    );

    const opportunityObject = objects.find(
      (o) => o.nameSingular === 'opportunity',
    );

    expect(opportunityObject).toBeDefined();

    if (!opportunityObject) {
      return;
    }

    const fields = await queryFieldMetadataByObjectMetadataId(
      opportunityObject.id,
    );
    const fieldNames = fields.map((f) => f.name);

    // Verify the FK relation fields exist — one for each pipeline object.
    // Each field uses a MANY_TO_ONE relation which stores pipelineId /
    // pipelineStageId as the join column in the workspace table.
    expect(fieldNames).toEqual(
      expect.arrayContaining(['pipeline', 'pipelineStage']),
    );
  });
});
