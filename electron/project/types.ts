export interface TreeEntry {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: TreeEntry[];
}

export interface FeatureMeta {
  name: string;
  description?: string;
  icon?: string;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
  writingGoal?: {
    purpose: string;
    audience: string;
    tone: string;
    targetLength: 'short' | 'medium' | 'long';
  } | null;
}

export interface FeatureSummary {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  order: number;
  createdAt?: string;
  updatedAt?: string;
  writingGoal?: FeatureMeta['writingGoal'];
}
