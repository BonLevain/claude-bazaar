import { useState } from 'react';
import { usePlugins } from '../contexts/PluginContext';

export function PluginSelector() {
  const { plugins, selectedPlugin, setSelectedPlugin, isLoading } = usePlugins();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center px-3 py-1.5 text-sm text-gray-400">
        Loading plugins...
      </div>
    );
  }

  if (plugins.length === 0) {
    return (
      <div className="flex items-center px-3 py-1.5 text-sm text-gray-500">
        No plugins available
      </div>
    );
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-400';
      case 'offline':
        return 'bg-red-400';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg border border-gray-300 transition-colors"
      >
        <span className={`w-2 h-2 rounded-full ${getStatusColor(selectedPlugin?.status)}`} />
        <span className="text-gray-700 truncate max-w-[150px]">
          {selectedPlugin?.name || 'Select plugin'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-300 rounded-lg shadow-lg z-20 py-1">
            {plugins.map((plugin) => (
              <button
                key={plugin.id}
                onClick={() => {
                  setSelectedPlugin(plugin);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 ${
                  selectedPlugin?.id === plugin.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(plugin.status)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{plugin.name}</div>
                    {plugin.description && (
                      <div className="text-xs text-gray-500 truncate">{plugin.description}</div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
