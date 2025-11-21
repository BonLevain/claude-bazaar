export interface Project {
  id: string;
  name: string;
  url: string;
  source: 'cli';
  status?: 'online' | 'offline' | 'unknown';
  description?: string;
}

export interface ProjectSource {
  getProjects(): Promise<Project[]>;
}

// Declare global config type
declare global {
  interface Window {
    __SHIPYARD_CONFIG__?: {
      projects?: string[];
    };
  }
}

export class CLIProjectSource implements ProjectSource {
  async getProjects(): Promise<Project[]> {
    // Try runtime config first (from serve command), then fall back to Vite env
    const config = window.__SHIPYARD_CONFIG__;
    const projectsEnv = config?.projects || import.meta.env.VITE_SHIPYARD_PROJECTS;

    if (!projectsEnv) {
      return [];
    }

    try {
      const urls: string[] = Array.isArray(projectsEnv) ? projectsEnv : JSON.parse(projectsEnv);
      return urls.map((url, index) => ({
        id: `cli-${index}`,
        name: `Project ${index + 1}`,
        url,
        source: 'cli' as const,
        status: 'unknown' as const,
      }));
    } catch {
      console.error('Failed to parse projects config');
      return [];
    }
  }
}

export class ProjectService {
  private sources: ProjectSource[] = [];

  addSource(source: ProjectSource): void {
    this.sources.push(source);
  }

  async getAllProjects(): Promise<Project[]> {
    const allProjects: Project[] = [];

    for (const source of this.sources) {
      const projects = await source.getProjects();
      allProjects.push(...projects);
    }

    return allProjects;
  }

  async checkProjectStatus(project: Project): Promise<Project> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${project.url}/app/info`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const info = await response.json();
        return {
          ...project,
          name: info.name || project.name,
          description: info.description,
          status: 'online',
        };
      }

      return { ...project, status: 'offline' };
    } catch (error) {
      console.error(`Failed to check project status for ${project.url}:`, error);
      return { ...project, status: 'offline' };
    }
  }

  async getAllProjectsWithStatus(): Promise<Project[]> {
    const projects = await this.getAllProjects();
    return Promise.all(projects.map(project => this.checkProjectStatus(project)));
  }

  static createDefault(): ProjectService {
    const service = new ProjectService();
    service.addSource(new CLIProjectSource());
    return service;
  }
}
