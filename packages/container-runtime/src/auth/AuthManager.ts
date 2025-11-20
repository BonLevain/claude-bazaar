import { Request } from 'express';
import { AuthConfig, AuthStatus } from './types.js';

export class AuthManager {
  getAuthStatus(): AuthStatus {
    if (process.env.ANTHROPIC_API_KEY) {
      return {
        authenticated: true,
        source: 'environment',
      };
    }

    return {
      authenticated: false,
      source: 'none',
    };
  }

  resolveAuth(req: Request): AuthConfig | null {
    // 1. Check env var
    if (process.env.ANTHROPIC_API_KEY) {
      return {
        source: 'environment',
        apiKey: process.env.ANTHROPIC_API_KEY,
      };
    }

    // 2. Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const key = authHeader.slice(7).trim();
      if (key) {
        return {
          source: 'header',
          apiKey: key,
        };
      }
    }

    // 3. Check x-api-key header
    const xApiKey = req.headers['x-api-key'];
    if (xApiKey && typeof xApiKey === 'string') {
      return {
        source: 'header',
        apiKey: xApiKey,
      };
    }

    // 4. Check body
    const bodyKey = (req.body as Record<string, unknown>)?.apiKey;
    if (bodyKey && typeof bodyKey === 'string') {
      return {
        source: 'body',
        apiKey: bodyKey,
      };
    }

    return null;
  }
}
