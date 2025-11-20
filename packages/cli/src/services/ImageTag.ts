import { ShipyardConfig } from '../types.js';

export class ImageTag {
  readonly name: string;
  readonly version: string;

  constructor(name: string, version: string) {
    this.name = name;
    this.version = version;
  }

  static fromConfig(config: ShipyardConfig): ImageTag {
    return new ImageTag(config.name, config.version);
  }

  toString(): string {
    return `${this.name}:${this.version}`;
  }

  withRegistry(registry: string): string {
    return `${registry}/${this.toString()}`;
  }
}
