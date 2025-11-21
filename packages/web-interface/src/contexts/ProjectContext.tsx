import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Project, ProjectService } from '../services/ProjectService';

interface ProjectContextValue {
  projects: Project[];
  selectedProject: Project | null;
  setSelectedProject: (project: Project) => void;
  isLoading: boolean;
  refreshProjects: () => Promise<void>;
  apiCall: (path: string, options?: RequestInit) => Promise<Response>;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const service = ProjectService.createDefault();
      const loadedProjects = await service.getAllProjectsWithStatus();
      setProjects(loadedProjects);

      // Auto-select first online project if none selected
      if (!selectedProject && loadedProjects.length > 0) {
        const onlineProject = loadedProjects.find(p => p.status === 'online');
        setSelectedProject(onlineProject || loadedProjects[0]);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    refreshProjects();
  }, []);

  const apiCall = useCallback(async (path: string, options: RequestInit = {}): Promise<Response> => {
    if (!selectedProject) {
      throw new Error('No project selected');
    }

    const url = `${selectedProject.url}${path.startsWith('/') ? path : `/${path}`}`;

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
  }, [selectedProject]);

  return (
    <ProjectContext.Provider
      value={{
        projects,
        selectedProject,
        setSelectedProject,
        isLoading,
        refreshProjects,
        apiCall,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
}

export function useApi() {
  const { apiCall, selectedProject } = useProjects();
  return { apiCall, selectedProject };
}
