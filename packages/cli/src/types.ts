export interface ShipyardConfig {
  name: string;
  version: string;
  description: string;
  include: string[];
  runtime: RuntimeConfig;
}

export interface RuntimeConfig {
  port: number;
  timeout: number;
}

export interface BuildOptions {
  tag?: string;
  push?: boolean;
  registry?: string;
}

export interface FileSystemService {
  exists(path: string): Promise<boolean>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  appendFile(path: string, content: string): Promise<void>;
  mkdir(path: string): Promise<void>;
}
