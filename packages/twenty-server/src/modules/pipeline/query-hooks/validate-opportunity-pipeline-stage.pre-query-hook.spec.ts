import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';

import { GlobalWorkspaceOrmManager } from 'src/engine/twenty-orm/global-workspace-datasource/global-workspace-orm.manager';
import { type OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import { type PipelineStageWorkspaceEntity } from 'src/modules/pipeline/standard-objects/pipeline-stage.workspace-entity';
import {
  ValidateOpportunityPipelineStageCreateOnePreQueryHook,
  ValidateOpportunityPipelineStageUpdateOnePreQueryHook,
  validatePipelineStageConsistency,
} from 'src/modules/pipeline/query-hooks/validate-opportunity-pipeline-stage.pre-query-hook';

const WORKSPACE_ID = 'workspace-id-1';

describe('validatePipelineStageConsistency', () => {
  const mockPipelineStageRepository = {
    findOne: jest.fn(),
  };

  const mockOpportunityRepository = {
    findOne: jest.fn(),
  };

  const mockGlobalWorkspaceOrmManager = {
    getRepository: jest.fn().mockImplementation((_workspaceId, name) => {
      if (name === 'pipelineStage') {
        return mockPipelineStageRepository;
      }
      if (name === 'opportunity') {
        return mockOpportunityRepository;
      }
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- createOne-like calls (no existingOpportunityId) ---

  it('should throw when pipelineStageId belongs to a different pipeline than pipelineId', async () => {
    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-b',
      pipelineId: 'pipeline-b',
    } as unknown as PipelineStageWorkspaceEntity);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: 'pipeline-a',
        incomingPipelineStageId: 'stage-b',
        existingOpportunityId: undefined,
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should include both IDs in the error message on mismatch', async () => {
    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-b',
      pipelineId: 'pipeline-b',
    } as unknown as PipelineStageWorkspaceEntity);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: 'pipeline-a',
        incomingPipelineStageId: 'stage-b',
        existingOpportunityId: undefined,
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).rejects.toThrow(
      'Pipeline stage stage-b does not belong to pipeline pipeline-a',
    );
  });

  it('should not throw when pipelineStageId belongs to the same pipeline', async () => {
    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-a',
      pipelineId: 'pipeline-a',
    } as unknown as PipelineStageWorkspaceEntity);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: 'pipeline-a',
        incomingPipelineStageId: 'stage-a',
        existingOpportunityId: undefined,
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).resolves.toBeUndefined();
  });

  it('should allow when both pipeline and pipelineStage are null', async () => {
    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: null,
        incomingPipelineStageId: null,
        existingOpportunityId: undefined,
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).resolves.toBeUndefined();

    expect(mockPipelineStageRepository.findOne).not.toHaveBeenCalled();
  });

  it('should allow when pipelineStageId is undefined', async () => {
    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: 'pipeline-a',
        incomingPipelineStageId: undefined,
        existingOpportunityId: undefined,
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).resolves.toBeUndefined();

    expect(mockPipelineStageRepository.findOne).not.toHaveBeenCalled();
  });

  it('should allow when stage is set but pipeline is null (free-float)', async () => {
    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: null,
        incomingPipelineStageId: 'stage-a',
        existingOpportunityId: undefined,
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).resolves.toBeUndefined();

    expect(mockPipelineStageRepository.findOne).not.toHaveBeenCalled();
  });

  it('should throw when stage is not found', async () => {
    mockPipelineStageRepository.findOne.mockResolvedValue(null);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: 'pipeline-a',
        incomingPipelineStageId: 'ghost-stage',
        existingOpportunityId: undefined,
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).rejects.toThrow('Pipeline stage ghost-stage not found');
  });

  // --- updateOne partial-update cases ---

  it('should load the existing record pipelineId when only pipelineStageId is updated', async () => {
    // Existing opportunity is on pipeline-a
    mockOpportunityRepository.findOne.mockResolvedValue({
      id: 'opp-1',
      pipelineId: 'pipeline-a',
      pipelineStageId: 'old-stage',
    } as unknown as OpportunityWorkspaceEntity);

    // New stage belongs to a different pipeline → must throw
    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-b',
      pipelineId: 'pipeline-b',
    } as unknown as PipelineStageWorkspaceEntity);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: undefined,
        incomingPipelineStageId: 'stage-b',
        existingOpportunityId: 'opp-1',
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should not throw when updating to a stage in the current pipeline (partial update)', async () => {
    mockOpportunityRepository.findOne.mockResolvedValue({
      id: 'opp-1',
      pipelineId: 'pipeline-a',
      pipelineStageId: 'old-stage',
    } as unknown as OpportunityWorkspaceEntity);

    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'new-stage-a',
      pipelineId: 'pipeline-a',
    } as unknown as PipelineStageWorkspaceEntity);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: undefined,
        incomingPipelineStageId: 'new-stage-a',
        existingOpportunityId: 'opp-1',
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).resolves.toBeUndefined();
  });

  it('should not throw when updating both pipeline and stage together (matching)', async () => {
    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-b',
      pipelineId: 'pipeline-b',
    } as unknown as PipelineStageWorkspaceEntity);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: 'pipeline-b',
        incomingPipelineStageId: 'stage-b',
        existingOpportunityId: 'opp-1',
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).resolves.toBeUndefined();
  });

  // --- pipeline-only update cases (the integrity gap being closed) ---

  it('should throw when only pipelineId changes to a pipeline that does not contain the persisted stage', async () => {
    // Existing opportunity is on pipeline-a with stage-a
    mockOpportunityRepository.findOne.mockResolvedValue({
      id: 'opp-1',
      pipelineId: 'pipeline-a',
      pipelineStageId: 'stage-a',
    } as unknown as OpportunityWorkspaceEntity);

    // stage-a belongs to pipeline-a, NOT pipeline-b
    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-a',
      pipelineId: 'pipeline-a',
    } as unknown as PipelineStageWorkspaceEntity);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: 'pipeline-b',
        incomingPipelineStageId: undefined,
        existingOpportunityId: 'opp-1',
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should not throw when only pipelineId changes and the persisted stage belongs to the new pipeline', async () => {
    // Existing opportunity is on pipeline-a with stage-shared (which also exists in pipeline-b)
    mockOpportunityRepository.findOne.mockResolvedValue({
      id: 'opp-1',
      pipelineId: 'pipeline-a',
      pipelineStageId: 'stage-shared',
    } as unknown as OpportunityWorkspaceEntity);

    // stage-shared belongs to pipeline-b (the new target pipeline)
    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-shared',
      pipelineId: 'pipeline-b',
    } as unknown as PipelineStageWorkspaceEntity);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: 'pipeline-b',
        incomingPipelineStageId: undefined,
        existingOpportunityId: 'opp-1',
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).resolves.toBeUndefined();
  });

  it('should allow when only pipelineId changes and the record has no persisted stage', async () => {
    // Existing opportunity is on pipeline-a with no stage
    mockOpportunityRepository.findOne.mockResolvedValue({
      id: 'opp-1',
      pipelineId: 'pipeline-a',
      pipelineStageId: null,
    } as unknown as OpportunityWorkspaceEntity);

    await expect(
      validatePipelineStageConsistency({
        workspaceId: WORKSPACE_ID,
        incomingPipelineId: 'pipeline-b',
        incomingPipelineStageId: undefined,
        existingOpportunityId: 'opp-1',
        globalWorkspaceOrmManager:
          mockGlobalWorkspaceOrmManager as unknown as GlobalWorkspaceOrmManager,
      }),
    ).resolves.toBeUndefined();

    expect(mockPipelineStageRepository.findOne).not.toHaveBeenCalled();
  });
});

// Smoke-test that the hook classes wire up correctly
describe('ValidateOpportunityPipelineStageCreateOnePreQueryHook', () => {
  let hook: ValidateOpportunityPipelineStageCreateOnePreQueryHook;

  const mockPipelineStageRepository = { findOne: jest.fn() };
  const mockGlobalWorkspaceOrmManager = {
    getRepository: jest.fn().mockReturnValue(mockPipelineStageRepository),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateOpportunityPipelineStageCreateOnePreQueryHook,
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: mockGlobalWorkspaceOrmManager,
        },
      ],
    }).compile();

    hook = module.get(ValidateOpportunityPipelineStageCreateOnePreQueryHook);
    jest.clearAllMocks();
  });

  it('should throw when stage belongs to a different pipeline', async () => {
    const payload = {
      data: { pipelineId: 'pipeline-a', pipelineStageId: 'stage-b' },
    };

    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-b',
      pipelineId: 'pipeline-b',
    });

    await expect(
      hook.execute(
        { workspace: { id: WORKSPACE_ID } } as any,
        'opportunity',
        payload as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ValidateOpportunityPipelineStageUpdateOnePreQueryHook', () => {
  let hook: ValidateOpportunityPipelineStageUpdateOnePreQueryHook;

  const mockPipelineStageRepository = { findOne: jest.fn() };
  const mockOpportunityRepository = { findOne: jest.fn() };

  const mockGlobalWorkspaceOrmManager = {
    getRepository: jest.fn().mockImplementation((_wsId, name) => {
      if (name === 'pipelineStage') return mockPipelineStageRepository;
      if (name === 'opportunity') return mockOpportunityRepository;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ValidateOpportunityPipelineStageUpdateOnePreQueryHook,
        {
          provide: GlobalWorkspaceOrmManager,
          useValue: mockGlobalWorkspaceOrmManager,
        },
      ],
    }).compile();

    hook = module.get(ValidateOpportunityPipelineStageUpdateOnePreQueryHook);
    jest.clearAllMocks();
  });

  it('should throw when updating to a mismatched stage (loading current pipelineId)', async () => {
    const payload = {
      id: 'opp-1',
      data: { pipelineStageId: 'stage-b' },
    };

    mockOpportunityRepository.findOne.mockResolvedValue({
      id: 'opp-1',
      pipelineId: 'pipeline-a',
    });

    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-b',
      pipelineId: 'pipeline-b',
    });

    await expect(
      hook.execute(
        { workspace: { id: WORKSPACE_ID } } as any,
        'opportunity',
        payload as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should return the payload when update is valid', async () => {
    const payload = {
      id: 'opp-1',
      data: { pipelineStageId: 'stage-a' },
    };

    mockOpportunityRepository.findOne.mockResolvedValue({
      id: 'opp-1',
      pipelineId: 'pipeline-a',
    });

    mockPipelineStageRepository.findOne.mockResolvedValue({
      id: 'stage-a',
      pipelineId: 'pipeline-a',
    });

    await expect(
      hook.execute(
        { workspace: { id: WORKSPACE_ID } } as any,
        'opportunity',
        payload as any,
      ),
    ).resolves.toBe(payload);
  });
});
