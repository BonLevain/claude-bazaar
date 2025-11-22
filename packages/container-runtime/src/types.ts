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

// Claude Code stream-json event types

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

export interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

export type ContentBlock = TextContent | ToolUseContent | ToolResultContent | ThinkingContent;

export interface InitEvent {
  type: 'init';
  session_id: string;
}

export interface UserMessageEvent {
  type: 'user';
  message: {
    role: 'user';
    content: ContentBlock[];
  };
}

export interface AssistantMessageEvent {
  type: 'assistant';
  message: {
    role: 'assistant';
    content: ContentBlock[];
    stop_reason?: string;
  };
}

export interface PartialEvent {
  type: 'partial';
  delta: {
    type: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
  };
}

export interface ResultEvent {
  type: 'result';
  subtype: 'success' | 'error';
  total_cost_usd: number;
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
}

export type StreamEvent =
  | InitEvent
  | UserMessageEvent
  | AssistantMessageEvent
  | PartialEvent
  | ResultEvent;
