export type AuthSource = 'environment' | 'header' | 'body';

export interface AuthConfig {
  source: AuthSource;
  apiKey: string;
}

export interface AuthStatus {
  authenticated: boolean;
  source: AuthSource | 'none';
}

export interface AuthErrorResponse {
  success: false;
  error: string;
  code: 'AUTH_REQUIRED';
  hint: string;
}
