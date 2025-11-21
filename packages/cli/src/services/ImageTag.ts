import { BazaarConfig } from '../types.js';

export class ImageTag {
  readonly name: string;
  readonly version: string;

  constructor(name: string, version: string) {
    this.name = this.sanitizeName(name);
    this.version = version;
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '');
  }

  static fromConfig(config: BazaarConfig): ImageTag {
    return new ImageTag(config.name, config.version);
  }

  toString(): string {
    return `${this.name}:${this.version}`;
  }

  withRegistry(registry: string): string {
    return `${registry}/${this.toString()}`;
  }
}
