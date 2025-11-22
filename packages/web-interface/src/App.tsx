import { useState, useRef, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { IoChatbubbleOutline, IoFolderOutline, IoSettingsOutline } from 'react-icons/io5';
import { useProjects } from './contexts/ProjectContext';
import { ProjectSelector } from './components/ProjectSelector';

// Stream event types (matching container-runtime)
interface TextContent {
  type: 'text';
  text: string;
}

interface ToolUseContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResultContent {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

interface ThinkingContent {
  type: 'thinking';
  thinking: string;
}

type ContentBlock = TextContent | ToolUseContent | ToolResultContent | ThinkingContent;

interface AssistantMessageEvent {
  type: 'assistant';
  message: {
    role: 'assistant';
    content: ContentBlock[];
  };
}

interface ResultEvent {
  type: 'result';
  subtype: 'success' | 'error';
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
  result: string;
  session_id: string;
  is_error: boolean;
}

interface InitEvent {
  type: 'init';
  session_id: string;
}

interface PartialEvent {
  type: 'partial';
  delta: {
    type: string;
    text?: string;
  };
}

interface ExecutionStartEvent {
  type: 'execution_start';
  executionId: string;
}

type StreamEvent = InitEvent | ExecutionStartEvent | AssistantMessageEvent | PartialEvent | ResultEvent | { type: 'stream_end' | 'error' | 'cancelled'; error?: string };

interface StreamingMessage {
  role: 'assistant';
  events: ContentBlock[];
  isStreaming: boolean;
  result?: ResultEvent;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  streaming?: StreamingMessage;
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

// Recursive component to render file tree
const FileTree = ({ node, depth = 0, basePath = '', urlPath = '' }: { node: FileTreeNode; depth?: number; basePath?: string; urlPath?: string }) => {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const paddingLeft = depth * 16 + 8;
  const currentPath = basePath ? `${basePath}/${node.name}` : node.name;

  if (node.type === 'file') {
    const downloadUrl = `${urlPath}?f=${encodeURIComponent(currentPath)}`;
    return (
      <div
        className="flex items-center py-1 px-2 hover:bg-gray-100 text-sm"
        style={{ paddingLeft: paddingLeft + 8 }}
      >
        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 truncate cursor-pointer"
        >
          {node.name}
        </a>
        {node.size !== undefined && (
          <span className="ml-auto text-xs text-gray-400 mr-2">
            {node.size < 1024 ? `${node.size}B` : `${(node.size / 1024).toFixed(1)}KB`}
          </span>
        )}
        <a
          href={downloadUrl}
          download={node.name}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Download"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </a>
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
            <FileTree key={`${child.name}-${index}`} node={child} depth={depth + 1} basePath={currentPath} urlPath={urlPath} />
          ))}
        </div>
      )}
    </div>
  );
};

// Component for static file cards
function StaticFileCard({ result }: { result: StaticFilesResult }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 py-2">
      <FileTree node={result.files} urlPath="/api/filesystem" />
    </div>
  );
}

// Random "ing" words for loading animation
const LOADING_WORDS = [
  'Thinking', 'Pondering', 'Vibing', 'Doodling', 'Brewing', 'Crafting',
  'Exploring', 'Wandering', 'Dreaming', 'Scheming', 'Plotting', 'Tinkering',
  'Mulling', 'Musing', 'Cooking', 'Stirring', 'Mixing', 'Blending',
  'Conjuring', 'Summoning', 'Invoking', 'Channeling', 'Focusing', 'Centering',
  'Gathering', 'Assembling', 'Building', 'Forging', 'Shaping', 'Molding',
];

function LoadingWord() {
  const [word, setWord] = useState(() => LOADING_WORDS[Math.floor(Math.random() * LOADING_WORDS.length)]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWord(LOADING_WORDS[Math.floor(Math.random() * LOADING_WORDS.length)]);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="text-gray-500 italic">{word}...</span>
  );
}

// Terminal-like streaming message display
function StreamingMessageDisplay({ streaming }: { streaming: StreamingMessage }) {
  return (
    <div className="font-mono text-sm space-y-2">
      {streaming.events.map((block, index) => {
        switch (block.type) {
          case 'text':
            return (
              <div key={index} className="whitespace-pre-wrap text-gray-900">
                <ReactMarkdown>{block.text}</ReactMarkdown>
              </div>
            );

          case 'tool_use':
            return (
              <div key={index} className="bg-blue-50 border border-blue-200 rounded p-3 my-2">
                <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {block.name}
                </div>
                <pre className="text-xs text-blue-600 overflow-x-auto max-h-40 overflow-y-auto">
                  {JSON.stringify(block.input, null, 2)}
                </pre>
              </div>
            );

          case 'tool_result':
            const resultContent = typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content, null, 2);
            const isTruncated = resultContent.length > 500;
            const displayContent = isTruncated ? resultContent.slice(0, 500) + '...' : resultContent;

            return (
              <div
                key={index}
                className={`border rounded p-3 my-2 ${
                  block.is_error
                    ? 'bg-red-50 border-red-200'
                    : 'bg-green-50 border-green-200'
                }`}
              >
                <div className={`flex items-center gap-2 font-semibold mb-2 ${
                  block.is_error ? 'text-red-700' : 'text-green-700'
                }`}>
                  {block.is_error ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {block.is_error ? 'Error' : 'Result'}
                </div>
                <pre className={`text-xs overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap ${
                  block.is_error ? 'text-red-600' : 'text-green-600'
                }`}>
                  {displayContent}
                </pre>
              </div>
            );

          case 'thinking':
            return (
              <div key={index} className="bg-purple-50 border border-purple-200 rounded p-3 my-2">
                <div className="flex items-center gap-2 text-purple-700 font-semibold mb-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Thinking
                </div>
                <div className="text-xs text-purple-600 italic max-h-40 overflow-y-auto">
                  {block.thinking}
                </div>
              </div>
            );

          default:
            return null;
        }
      })}

      {streaming.isStreaming && (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          </div>
          <LoadingWord />
        </div>
      )}

      {streaming.result && !streaming.isStreaming && (
        <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-200 flex gap-4">
          <span>{(streaming.result.duration_ms / 1000).toFixed(1)}s</span>
          <span>{streaming.result.num_turns} turns</span>
        </div>
      )}
    </div>
  );
}

// Settings Page Component
function SettingsPage() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('bazaar_api_key') || '');
  const [showModal, setShowModal] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');
  const { projects } = useProjects();

  const getMaskedKey = (key: string) => {
    if (!key) return 'Not configured';
    if (key.length <= 10) return '••••••••';
    return `${key.slice(0, 7)}...${key.slice(-4)}`;
  };

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

  const openModal = () => {
    setTempApiKey('');
    setShowModal(true);
  };

  const saveApiKey = () => {
    setApiKey(tempApiKey);
    localStorage.setItem('bazaar_api_key', tempApiKey);
    setShowModal(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 flex justify-center">
      <div className="w-full max-w-2xl">
        <div className="bg-gray-50 rounded-lg p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Settings</h2>
          <hr className="border-gray-300 mb-6" />

          {/* API Key Row */}
          <div className="flex items-center justify-between py-4">
            <div>
              <div className="font-semibold text-gray-900">Anthropic API Key</div>
              <div className="text-gray-600 text-sm">{getMaskedKey(apiKey)}</div>
            </div>
            <button
              onClick={openModal}
              className="px-4 py-2 border border-gray-400 rounded-lg text-gray-700 hover:bg-gray-100"
            >
              Change API key
            </button>
          </div>

          {/* Projects Section */}
          <hr className="border-gray-300 my-6" />
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Projects</h3>
          {projects.length === 0 ? (
            <p className="text-gray-500 text-sm">No projects configured</p>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => (
                <div key={project.id} className="flex items-start justify-between gap-3 py-2">
                  <div className="flex items-start gap-3">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getStatusColor(project.status)}`} />
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{project.name}</div>
                      {project.description && (
                        <div className="text-sm text-gray-600">{project.description}</div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 font-mono text-right">{project.url}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-50 rounded-lg p-8 w-full max-w-lg mx-4 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-gray-900 mb-4">Change API key</h3>

            <p className="text-sm text-gray-600 mb-4">
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

            <input
              type="password"
              value={tempApiKey}
              onChange={(e) => setTempApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 mb-6"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={saveApiKey}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// FileSystem Page Component
function FileSystemPage({ staticFiles }: { staticFiles: StaticFilesResult[] }) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white">
        <h2 className="text-xl font-semibold text-gray-900">Files</h2>
        <ProjectSelector />
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {staticFiles.length === 0 ? (
          <p className="text-gray-500">No static files configured</p>
        ) : (
          <div className="space-y-4">
            {staticFiles.map((result, index) => (
              <StaticFileCard key={index} result={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [commands, setCommands] = useState<SlashCommand[]>([]);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [staticFiles, setStaticFiles] = useState<StaticFilesResult[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const location = useLocation();

  const { apiCall, selectedProject } = useProjects();

  // Generate session ID for conversation context
  const [sessionId] = useState(() => crypto.randomUUID());
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch available commands when project changes
  useEffect(() => {
    if (!selectedProject) return;

    apiCall('/commands')
      .then((res) => res.json())
      .then((data) => {
        if (data.commands) {
          setCommands(data.commands);
        }
      })
      .catch((err) => console.error('Failed to fetch commands:', err));
  }, [selectedProject, apiCall]);

  // Fetch static files when project changes
  useEffect(() => {
    if (!selectedProject) return;

    apiCall('/static/files')
      .then((res) => res.json())
      .then((data) => {
        if (data.staticFiles) {
          setStaticFiles(data.staticFiles);
        }
      })
      .catch((err) => console.error('Failed to fetch static files:', err));
  }, [selectedProject, apiCall]);

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

  const handleCancel = async () => {
    // Abort the fetch request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Also call the cancel endpoint if we have an executionId
    if (currentExecutionId && selectedProject) {
      try {
        await fetch(`${selectedProject.url}/execute/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ executionId: currentExecutionId }),
        });
      } catch {
        // Ignore errors - the process may already be done
      }
    }

    setCurrentExecutionId(null);
    setIsLoading(false);

    // Mark the last message as cancelled
    setMessages((prev) => {
      const newMessages = [...prev];
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage?.streaming) {
        lastMessage.streaming = {
          ...lastMessage.streaming,
          events: [
            ...lastMessage.streaming.events,
            { type: 'text', text: '\n\n*Cancelled*' },
          ],
          isStreaming: false,
        };
      }
      return newMessages;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Handle /clear command locally
    if (userMessage === '/clear') {
      setMessages([]);
      return;
    }

    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      if (!selectedProject) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '**No Project Selected**\n\nPlease select a project from the dropdown above to start chatting.',
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Get API key from localStorage
      const apiKey = localStorage.getItem('bazaar_api_key');

      // Create AbortController for this request
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Use streaming endpoint
      const response = await fetch(`${selectedProject.url}/execute/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { 'x-api-key': apiKey } : {}),
        },
        body: JSON.stringify({
          prompt: userMessage,
          files: files.length > 0 ? files : undefined,
          sessionId,
        }),
        signal: abortController.signal,
      });

      if (response.status === 401) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `**Authentication Required**\n\nPlease configure your Anthropic API key in [Settings](/settings).`,
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Initialize streaming message
      const streamingMessage: StreamingMessage = {
        role: 'assistant',
        events: [],
        isStreaming: true,
      };

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', streaming: streamingMessage },
      ]);

      // Read SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            if (!jsonStr.trim()) continue;

            try {
              const event = JSON.parse(jsonStr) as StreamEvent;

              if (event.type === 'execution_start') {
                setCurrentExecutionId((event as ExecutionStartEvent).executionId);
              } else if (event.type === 'assistant') {
                const assistantEvent = event as AssistantMessageEvent;
                // Add content blocks to streaming events
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.streaming) {
                    lastMessage.streaming = {
                      ...lastMessage.streaming,
                      events: [...lastMessage.streaming.events, ...assistantEvent.message.content],
                    };
                  }
                  return newMessages;
                });
              } else if (event.type === 'result') {
                const resultEvent = event as ResultEvent;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.streaming) {
                    lastMessage.streaming = {
                      ...lastMessage.streaming,
                      isStreaming: false,
                      result: resultEvent,
                    };
                  }
                  return newMessages;
                });
              } else if (event.type === 'stream_end') {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.streaming) {
                    lastMessage.streaming = {
                      ...lastMessage.streaming,
                      isStreaming: false,
                    };
                  }
                  return newMessages;
                });
              } else if (event.type === 'cancelled') {
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.streaming) {
                    lastMessage.streaming = {
                      ...lastMessage.streaming,
                      events: [
                        ...lastMessage.streaming.events,
                        { type: 'text', text: '\n\n*Cancelled*' },
                      ],
                      isStreaming: false,
                    };
                  }
                  return newMessages;
                });
              } else if (event.type === 'error') {
                const errorEvent = event as { type: 'error'; error?: string };
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.streaming) {
                    lastMessage.streaming = {
                      ...lastMessage.streaming,
                      events: [
                        ...lastMessage.streaming.events,
                        { type: 'text', text: `Error: ${errorEvent.error || 'Unknown error'}` },
                      ],
                      isStreaming: false,
                    };
                  }
                  return newMessages;
                });
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }

      // Clear files after successful execution
      setFiles([]);
    } catch (error) {
      // Don't show error for user-initiated cancellation
      if (error instanceof Error && error.name === 'AbortError') {
        // Silently ignore - cancellation is already handled by handleCancel
        return;
      }

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
      setCurrentExecutionId(null);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar */}
      <div className="w-56 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h1 className="text-lg font-semibold truncate">
            Claude-Bazaar
          </h1>
          <p className="text-[12px] text-gray-400 truncate">Share & Monetize your Plugins</p>
        </div>
        <nav className="flex-1 p-2">
          <Link
            to="/"
            className={`w-full flex items-center px-3 py-2 rounded-lg mb-1 ${
              location.pathname === '/' || location.pathname === '/chat'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <IoChatbubbleOutline className="w-5 h-5 mr-3" />
            Chat
          </Link>
          <Link
            to="/filesystem"
            className={`w-full flex items-center px-3 py-2 rounded-lg ${
              location.pathname === '/filesystem'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <IoFolderOutline className="w-5 h-5 mr-3" />
            Files
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-700">
          <Link
            to="/settings"
            className={`w-full flex items-center px-3 py-2 rounded-lg ${
              location.pathname === '/settings'
                ? 'bg-gray-700 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <IoSettingsOutline className="w-5 h-5 mr-3" />
            Settings
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/filesystem" element={<FileSystemPage staticFiles={staticFiles} />} />
          <Route path="*" element={
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
                      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                        <ProjectSelector />
                        <div className="flex items-center space-x-2">
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
                          message.streaming ? (
                            <StreamingMessageDisplay streaming={message.streaming} />
                          ) : (
                            <div className="prose prose-sm max-w-none">
                              <ReactMarkdown
                                components={{
                                  a: ({ href, children }) => (
                                    <a
                                      href={href}
                                      className="text-blue-600 underline hover:text-blue-800"
                                    >
                                      {children}
                                    </a>
                                  ),
                                }}
                              >
                                {message.content || '...'}
                              </ReactMarkdown>
                            </div>
                          )
                        ) : (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        )}
                      </div>
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role !== 'assistant' && !messages[messages.length - 1]?.streaming && (
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
                      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                        <ProjectSelector dropUp />
                        <div className="flex items-center space-x-2">
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

                          {isLoading ? (
                            <button
                              type="button"
                              onClick={handleCancel}
                              className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                              title="Cancel"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          ) : (
                            <button
                              type="submit"
                              disabled={!input.trim()}
                              className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </form>
              </>
            )}
            </>
          } />
        </Routes>

        {/* Footer */}
        <div className="py-2 text-center">
          <p className="text-xs text-gray-400">powered by claude-bazaar</p>
        </div>
      </div>
    </div>
  );
}
