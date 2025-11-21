export interface Plugin {
  id: string;
  name: string;
  url: string;
  source: 'cli' | 'marketplace';
  status?: 'online' | 'offline' | 'unknown';
  description?: string;
}

export interface PluginSource {
  getPlugins(): Promise<Plugin[]>;
}

// Declare global config type
declare global {
  interface Window {
    __SHIPYARD_CONFIG__?: {
      plugins?: string[];
      marketplaces?: string[];
    };
  }
}

export class CLIPluginSource implements PluginSource {
  async getPlugins(): Promise<Plugin[]> {
    // Try runtime config first (from serve command), then fall back to Vite env
    const config = window.__SHIPYARD_CONFIG__;
    const pluginsEnv = config?.plugins || import.meta.env.VITE_SHIPYARD_PLUGINS;

    if (!pluginsEnv) {
      return [];
    }

    try {
      const urls: string[] = Array.isArray(pluginsEnv) ? pluginsEnv : JSON.parse(pluginsEnv);
      return urls.map((url, index) => ({
        id: `cli-${index}`,
        name: `Plugin ${index + 1}`,
        url,
        source: 'cli' as const,
        status: 'unknown' as const,
      }));
    } catch {
      console.error('Failed to parse plugins config');
      return [];
    }
  }
}

export class MarketplacePluginSource implements PluginSource {
  private marketplaceUrls: string[];

  constructor() {
    // Try runtime config first, then fall back to Vite env
    const config = window.__SHIPYARD_CONFIG__;
    const marketplacesEnv = config?.marketplaces || import.meta.env.VITE_SHIPYARD_MARKETPLACES;

    if (!marketplacesEnv) {
      this.marketplaceUrls = [];
      return;
    }

    try {
      this.marketplaceUrls = Array.isArray(marketplacesEnv) ? marketplacesEnv : JSON.parse(marketplacesEnv);
    } catch {
      console.error('Failed to parse marketplaces config');
      this.marketplaceUrls = [];
    }
  }

  async getPlugins(): Promise<Plugin[]> {
    // Future: Fetch plugins from marketplace APIs
    // For now, return empty array as placeholder
    const plugins: Plugin[] = [];

    for (const marketplaceUrl of this.marketplaceUrls) {
      try {
        // Placeholder for marketplace API call
        // const response = await fetch(`${marketplaceUrl}/plugins`);
        // const marketplacePlugins = await response.json();
        console.log(`Marketplace source registered: ${marketplaceUrl}`);
      } catch (error) {
        console.error(`Failed to fetch from marketplace ${marketplaceUrl}:`, error);
      }
    }

    return plugins;
  }
}

export class PluginService {
  private sources: PluginSource[] = [];

  addSource(source: PluginSource): void {
    this.sources.push(source);
  }

  async getAllPlugins(): Promise<Plugin[]> {
    const allPlugins: Plugin[] = [];

    for (const source of this.sources) {
      const plugins = await source.getPlugins();
      allPlugins.push(...plugins);
    }

    return allPlugins;
  }

  async checkPluginStatus(plugin: Plugin): Promise<Plugin> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${plugin.url}/app/info`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const info = await response.json();
        return {
          ...plugin,
          name: info.name || plugin.name,
          description: info.description,
          status: 'online',
        };
      }

      return { ...plugin, status: 'offline' };
    } catch (error) {
      console.error(`Failed to check plugin status for ${plugin.url}:`, error);
      return { ...plugin, status: 'offline' };
    }
  }

  async getAllPluginsWithStatus(): Promise<Plugin[]> {
    const plugins = await this.getAllPlugins();
    return Promise.all(plugins.map(plugin => this.checkPluginStatus(plugin)));
  }

  static createDefault(): PluginService {
    const service = new PluginService();
    service.addSource(new CLIPluginSource());
    service.addSource(new MarketplacePluginSource());
    return service;
  }
}
