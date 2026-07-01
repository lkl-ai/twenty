import { type ObjectRecord } from '@/object-record/types/ObjectRecord';

export type PipelineStageRecord = ObjectRecord & {
  id: string;
  name: string;
  position: number;
  color: string;
  pipelineId: string;
};

export type PipelineRecord = ObjectRecord & {
  id: string;
  name: string;
  position: number;
  isDefault?: boolean;
};
