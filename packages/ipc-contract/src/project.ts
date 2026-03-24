export interface ProjectMeta {
  name: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  settings: Record<string, unknown>;
}

export interface ProjectPaths {
  root: string;
  source: string;
  analysis: string;
  output: string;
  temp: string;
}
