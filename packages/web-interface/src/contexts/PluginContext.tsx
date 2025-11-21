import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Plugin, PluginService } from '../services/PluginService';

interface PluginContextValue {
  plugins: Plugin[];
  selectedPlugin: Plugin | null;
  setSelectedPlugin: (plugin: Plugin) => void;
  isLoading: boolean;
  refreshPlugins: () => Promise<void>;
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}

const PluginContext = createContext<PluginContextValue | null>(null);

interface PluginProviderProps {
  children: ReactNode;
}

export function PluginProvider({ children }: PluginProviderProps) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshPlugins = useCallback(async () => {
    setIsLoading(true);
    try {
      const service = PluginService.createDefault();
      const loadedPlugins = await service.getAllPluginsWithStatus();
      setPlugins(loadedPlugins);

      // Auto-select first online plugin if none selected
      if (!selectedPlugin && loadedPlugins.length > 0) {
        const onlinePlugin = loadedPlugins.find(p => p.status === 'online');
        setSelectedPlugin(onlinePlugin || loadedPlugins[0]);
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlugin]);

  useEffect(() => {
    refreshPlugins();
  }, []);

  const apiCall = useCallback(async (path: string, options: RequestInit = {}): Promise<Response> => {
    if (!selectedPlugin) {
      throw new Error('No plugin selected');
    }

    const url = `${selectedPlugin.url}${path.startsWith('/') ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    // Read API key from localStorage for each request
    const apiKey = localStorage.getItem('shipyard_api_key');
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }, [selectedPlugin]);

  return (
    <PluginContext.Provider
      value={{
        plugins,
        selectedPlugin,
        setSelectedPlugin,
        isLoading,
        refreshPlugins,
        apiCall,
      }}
    >
      {children}
    </PluginContext.Provider>
  );
}

export function usePlugins() {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugins must be used within a PluginProvider');
  }
  return context;
}

export function useApi() {
  const { apiCall, selectedPlugin } = usePlugins();
  return { apiCall, selectedPlugin };
}
