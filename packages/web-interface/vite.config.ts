import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to inject __BAZAAR_CONFIG__ into HTML
function bazaarConfigPlugin(): Plugin {
  return {
    name: 'bazaar-config',
    transformIndexHtml(html) {
      const projects = process.env.VITE_BAZAAR_PROJECTS;
      if (!projects) return html;

      const projectsArray = projects.split(',').map((p) => p.trim());
      const script = `<script>
  window.__BAZAAR_CONFIG__ = {
    projects: ${JSON.stringify(projectsArray)}
  };
</script>`;

      return html.replace('</head>', script + '\n</head>');
    },
  };
}

export default defineConfig({
  plugins: [react(), bazaarConfigPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
