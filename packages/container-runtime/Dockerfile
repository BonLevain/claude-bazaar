FROM node:20-slim

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create app directories
RUN mkdir -p /app/runtime /app/plugin /tmp/shipyard

WORKDIR /app/runtime

# Copy runtime package files
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled runtime
COPY dist ./dist

# Set working directory for plugin
WORKDIR /app/plugin

# Back to runtime for execution
WORKDIR /app/runtime

# Environment defaults
ENV PORT=3000
ENV TIMEOUT=120000
ENV PLUGIN_DIR=/app/plugin
ENV WORKSPACE_DIR=/tmp/shipyard

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "dist/index.js"]
