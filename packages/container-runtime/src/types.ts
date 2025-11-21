export interface FileInput {
  path: string;
  content: string;
}

export interface ExecuteRequest {
  prompt: string;
  files?: FileInput[];
  timeout?: number;
  apiKey?: string;
  sessionId?: string;
}

export interface ExecuteResponse {
  success: boolean;
  output: string;
  error?: string;
  executionTime?: number;
}

export interface StaticFileConfig {
  folder: string;
  urlPath: string;
  access?: 'shared' | 'per-user';
}

export interface PluginConfig {
  name: string;
  version: string;
  description: string;
  staticFiles?: StaticFileConfig[];
}

export interface RuntimeConfig {
  port: number;
  timeout: number;
  pluginDir: string;
  workspaceBaseDir: string;
  pluginConfig?: PluginConfig;
}

export interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}
