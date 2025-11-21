export interface BazaarConfig {
  name: string;
  version: string;
  description: string;
  include: string[];
  runtime: RuntimeConfig;
  dependencies?: DependenciesConfig;
  staticFiles?: StaticFileConfig[];
}

export interface DependenciesConfig {
  python?: string;  // path to requirements.txt
  node?: string;    // path to package.json
}

export interface StaticFileConfig {
  folder: string;           // local folder path
  urlPath: string;          // URL path to serve at
  access?: 'shared' | 'per-user';  // access control mode
  // Future options: cache, auth, etc.
}

export interface RuntimeConfig {
  port: number;
  timeout: number;
  image: string;
}

export interface BuildOptions {
  tag?: string;
  push?: boolean;
  registry?: string;
}

export interface RunOptions {
  tag?: string;
  port?: number;
  detach?: boolean;
  env?: Record<string, string>;
}

export interface ServeOptions {
  projects?: string[];
  port?: number;
}

export interface FileSystemService {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  appendFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
}
