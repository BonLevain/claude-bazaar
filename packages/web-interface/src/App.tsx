import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { IoChatbubbleOutline, IoFolderOutline } from 'react-icons/io5';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface FileItem {
  path: string;
  content: string;
}

interface SlashCommand {
  name: string;
  description: string;
  source: 'builtin' | 'project' | 'user';
}

interface AppInfo {
  name: string;
  description: string;
  version: string;
}

interface FileTreeNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileTreeNode[];
}

interface StaticFilesResult {
  folder: string;
  urlPath: string;
  files: FileTreeNode;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('shipyard_api_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [staticFiles, setStaticFiles] = useState<StaticFilesResult[]>([]);
  const [activeView, setActiveView] = useState<'chat' | 'filesystem'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Generate session ID for conversation context
  const [sessionId] = useState(() => crypto.randomUUID());

  const saveApiKey = () => {
    setApiKey(tempApiKey);
    localStorage.setItem('shipyard_api_key', tempApiKey);
    setShowSettings(false);
  };

  const clearApiKey = () => {
    setApiKey('');
    setTempApiKey('');
    localStorage.removeItem('shipyard_api_key');
  };

  const getMaskedKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 10) return '••••••••';
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch available commands on mount
  useEffect(() => {
    fetch('/api/commands')
      .then((res) => res.json())
      .then((data) => {
        if (data.commands) {
          setCommands(data.commands);
        }
      })
      .catch((err) => console.error('Failed to fetch commands:', err));
  }, []);

  // Fetch app info on mount
  useEffect(() => {
    fetch('/api/app/info')
      .then((res) => res.json())
      .then((data) => {
        if (data.name) {
          setAppInfo(data);
        }
      })
      .catch((err) => console.error('Failed to fetch app info:', err));
  }, []);

  // Fetch static files on mount
  useEffect(() => {
    fetch('/api/static/files')
      .then((res) => res.json())
      .then((data) => {
        if (data.staticFiles) {
          setStaticFiles(data.staticFiles);
        }
      })
      .catch((err) => console.error('Failed to fetch static files:', err));
  }, []);

  // Filter commands based on input
  const filteredCommands = input.startsWith('/')
    ? commands.filter((cmd) =>
        cmd.name.toLowerCase().includes(input.toLowerCase())
      )
    : [];

  // Show autocomplete when typing a slash command
  useEffect(() => {
    if (input.startsWith('/') && filteredCommands.length > 0 && !input.includes(' ')) {
      setShowAutocomplete(true);
      setSelectedCommandIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  }, [input, filteredCommands.length]);

  const selectCommand = (command: SlashCommand) => {
    setInput(command.name + ' ');
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    const newFiles: FileItem[] = [];
    for (const file of uploadedFiles) {
      const content = await file.text();
      newFiles.push({
        path: file.name,
        content,
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey && { 'Authorization': `Bearer ${apiKey}` }),
        },
        body: JSON.stringify({
          prompt: userMessage,
          files: files.length > 0 ? files : undefined,
          sessionId,
        }),
      });

      if (response.status === 401) {
        const errorData = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**Authentication Required**\n\n${errorData.hint || 'Please configure your API key in settings.'}\n\nClick the ⚙️ icon in the header to add your API key.`,
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle JSON response from /execute endpoint
      const data = await response.json();

      let assistantMessage = '';

      if (data.success && data.output) {
        // Parse the output JSON string
        try {
          const outputData = JSON.parse(data.output);
          if (outputData.is_error) {
            assistantMessage = `Error: ${outputData.error || outputData.result || 'Command failed'}`;
          } else if ('result' in outputData) {
            // Use result field if it exists (even if empty string)
            assistantMessage = outputData.result || 'Command completed with no output.';
          } else {
            // No result field, show raw output
            assistantMessage = data.output;
          }
        } catch {
          // If not JSON, use raw output
          assistantMessage = data.output;
        }
      } else if (data.error) {
        assistantMessage = `Error: ${data.error}`;
      } else {
        assistantMessage = 'No response received';
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: assistantMessage }]);

      // Clear files after successful execution
      setFiles([]);
    } catch (error) {
      console.error('Error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Recursive component to render file tree
  const FileTree = ({ node, depth = 0 }: { node: FileTreeNode; depth?: number }) => {
    const [isOpen, setIsOpen] = useState(depth < 2);
    const paddingLeft = depth * 16;

    if (node.type === 'file') {
      return (
        <div
          className="flex items-center py-1 px-2 hover:bg-gray-100 text-sm"
          style={{ paddingLeft: paddingLeft + 8 }}
        >
          <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-gray-700 truncate">{node.name}</span>
          {node.size !== undefined && (
            <span className="ml-auto text-xs text-gray-400">
              {node.size < 1024 ? `${node.size}B` : `${(node.size / 1024).toFixed(1)}KB`}
            </span>
          )}
        </div>
      );
    }

    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center w-full py-1 px-2 hover:bg-gray-100 text-sm"
          style={{ paddingLeft }}
        >
          <svg
            className={`w-4 h-4 mr-1 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg className="w-4 h-4 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <span className="text-gray-700">{node.name}</span>
        </button>
        {isOpen && node.children && (
          <div>
            {node.children.map((child, index) => (
              <FileTree key={`${child.name}-${index}`} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-lg font-semibold mb-4">API Key Settings</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={tempApiKey}
                onChange={(e) => setTempApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-2 text-sm text-gray-500">
                Get your API key from{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
              {apiKey && (
                <p className="mt-1 text-sm text-gray-500">
                  Current: {getMaskedKey(apiKey)}
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={clearApiKey}
                className="px-4 py-2 text-red-600 hover:text-red-700"
              >
                Clear
              </button>
              <div className="space-x-2">
                <button
                  onClick={() => {
                    setShowSettings(false);
                    setTempApiKey('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={saveApiKey}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Left Sidebar */}
      <div className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-semibold truncate">
            {appInfo?.name || 'Shipyard'}
          </h1>
          {appInfo?.description && (
            <p className="text-xs text-gray-400 truncate">{appInfo.description}</p>
          )}
        </div>
        <nav className="flex-1 p-2">
          <button
            onClick={() => setActiveView('chat')}
            className={`w-full flex items-center px-3 py-2 rounded-lg mb-1 ${
              activeView === 'chat'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <IoChatbubbleOutline className="w-5 h-5 mr-3" />
            Chat
          </button>
          <button
            onClick={() => setActiveView('filesystem')}
            className={`w-full flex items-center px-3 py-2 rounded-lg ${
              activeView === 'filesystem'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <IoFolderOutline className="w-5 h-5 mr-3" />
            FileSystem
          </button>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={() => {
              setTempApiKey(apiKey);
              setShowSettings(true);
            }}
            className="w-full flex items-center px-3 py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg"
          >
            <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            Settings
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {activeView === 'chat' ? (
          <>
            {/* Chat View */}
            {messages.length === 0 ? (
              /* Welcome state - centered */
              <div className="flex-1 flex flex-col items-center justify-center p-6">
                <h2 className="text-4xl font-light text-gray-900 mb-8">
                  What can I do for you?
                </h2>

                {/* Centered input */}
                <div className="w-full max-w-2xl">
                  {/* File uploads */}
                  {files.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <span className="text-gray-700">{file.path}</span>
                          <button
                            onClick={() => removeFile(index)}
                            className="ml-2 text-gray-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    <div className="relative bg-white rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (showAutocomplete) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setSelectedCommandIndex((prev) =>
                                prev < filteredCommands.length - 1 ? prev + 1 : prev
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setSelectedCommandIndex((prev) => (prev > 0 ? prev - 1 : 0));
                            } else if (e.key === 'Tab' || e.key === 'Enter') {
                              e.preventDefault();
                              if (filteredCommands[selectedCommandIndex]) {
                                selectCommand(filteredCommands[selectedCommandIndex]);
                              }
                            } else if (e.key === 'Escape') {
                              setShowAutocomplete(false);
                            }
                          } else if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                          }
                        }}
                        placeholder="Ask anything. Use /commands."
                        rows={3}
                        className="w-full resize-none rounded-t-xl border-0 px-4 py-3 focus:outline-none focus:ring-0"
                      />

                      {/* Autocomplete dropdown */}
                      {showAutocomplete && filteredCommands.length > 0 && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredCommands.map((cmd, index) => (
                            <button
                              key={cmd.name}
                              onClick={() => selectCommand(cmd)}
                              className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                                index === selectedCommandIndex ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="font-medium text-gray-900">{cmd.name}</div>
                              <div className="text-sm text-gray-500">{cmd.description}</div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Bottom toolbar */}
                      <div className="flex items-center justify-end px-3 py-2 border-t border-gray-100 space-x-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <div className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                              />
                            </svg>
                          </div>
                        </label>

                        <button
                          type="submit"
                          disabled={isLoading || !input.trim()}
                          className="p-2 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            ) : (
              /* Messages state - input at bottom */
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-3xl rounded-lg px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-white border border-gray-200 text-gray-900'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown>{message.content || '...'}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* File uploads */}
                {files.length > 0 && (
                  <div className="px-6 py-2 bg-gray-100 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center bg-white border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          <span className="text-gray-700">{file.path}</span>
                          <button
                            onClick={() => removeFile(index)}
                            className="ml-2 text-gray-400 hover:text-red-500"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="p-4 bg-white border-t border-gray-200">
                  <div className="max-w-4xl mx-auto">
                    <div className="relative bg-white rounded-xl border border-gray-300 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (showAutocomplete) {
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              setSelectedCommandIndex((prev) =>
                                prev < filteredCommands.length - 1 ? prev + 1 : prev
                              );
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              setSelectedCommandIndex((prev) => (prev > 0 ? prev - 1 : 0));
                            } else if (e.key === 'Tab' || e.key === 'Enter') {
                              e.preventDefault();
                              if (filteredCommands[selectedCommandIndex]) {
                                selectCommand(filteredCommands[selectedCommandIndex]);
                              }
                            } else if (e.key === 'Escape') {
                              setShowAutocomplete(false);
                            }
                          } else if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                          }
                        }}
                        placeholder="Ask anything. Use /commands."
                        rows={1}
                        className="w-full resize-none rounded-t-xl border-0 px-4 py-3 focus:outline-none focus:ring-0"
                      />

                      {/* Autocomplete dropdown */}
                      {showAutocomplete && filteredCommands.length > 0 && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {filteredCommands.map((cmd, index) => (
                            <button
                              key={cmd.name}
                              onClick={() => selectCommand(cmd)}
                              className={`w-full text-left px-4 py-2 hover:bg-gray-100 ${
                                index === selectedCommandIndex ? 'bg-blue-50' : ''
                              }`}
                            >
                              <div className="font-medium text-gray-900">{cmd.name}</div>
                              <div className="text-sm text-gray-500">{cmd.description}</div>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Bottom toolbar */}
                      <div className="flex items-center justify-end px-3 py-2 border-t border-gray-100 space-x-2">
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <div className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                              />
                            </svg>
                          </div>
                        </label>

                        <button
                          type="submit"
                          disabled={isLoading || !input.trim()}
                          className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                          {isLoading ? (
                            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                                fill="none"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </>
            )}
          </>
        ) : (
          <>
            {/* FileSystem View */}
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Files</h2>
              {staticFiles.length === 0 ? (
                <p className="text-gray-500">No static files configured</p>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200">
                  {staticFiles.map((result, index) => (
                    <div key={index} className={index > 0 ? 'border-t border-gray-200' : ''}>
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <p className="text-sm font-medium text-gray-700">{result.urlPath}</p>
                        <p className="text-xs text-gray-500">{result.folder}</p>
                      </div>
                      <div className="py-2">
                        <FileTree node={result.files} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="py-2 text-center">
          <p className="text-xs text-gray-400">powered by claude-shipyard</p>
        </div>
      </div>
    </div>
  );
}
