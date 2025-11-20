export interface FileInput {
  path: string;
  content: string;
}

export interface ExecuteRequest {
  prompt: string;
  files?: FileInput[];
  timeout?: number;
}

export interface ExecuteResponse {
  success: boolean;
  output: string;
  error?: string;
  executionTime?: number;
}

export interface RuntimeConfig {
  port: number;
  timeout: number;
  pluginDir: string;
  workspaceBaseDir: string;
}
