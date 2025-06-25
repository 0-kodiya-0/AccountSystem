// Todo related types
export interface Todo {
  id: string;
  userId: string;
  title: string;
  description: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  dueDate: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoData {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  tags?: string[];
}

export interface UpdateTodoData {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string | null;
  tags?: string[];
}

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

export interface ApiError extends Error {
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

// Auth configuration types
export interface AuthConfig {
  baseUrl: string;
  serviceId: string;
  serviceName: string;
  serviceSecret: string;
  accountServerBaseUrl?: string;
  enableLogging: boolean;
  timeout: number;
  preferSocket: boolean;
  maxReconnectAttempts: number;
}

// Database operation types
export interface DatabaseStats {
  totalTodos: number;
  totalUsers: number;
  todosPerUser: Array<{
    userId: string;
    todoCount: number;
  }>;
}

// Request validation types
export interface ValidatedTodoRequest {
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  tags: string[];
}

// Middleware options
export interface AuthMiddlewareOptions {
  required?: boolean;
  loadUser?: boolean;
  validateAccount?: boolean;
  accountIdParam?: string;
  enableRefreshRedirect?: boolean;
}

export interface PermissionOptions {
  accountTypes?: string[];
  emailVerified?: boolean;
  customValidator?: (user: any) => boolean | Promise<boolean>;
}

// Type definitions for auth endpoints
export interface AuthStatusResponse {
  isAuthenticated: boolean;
  user: any | null;
  tokenData: any | null;
  sessionInfo: any | null;
  timestamp: string;
}

export interface CurrentUserResponse {
  user: any;
  tokenData: any;
  accountId?: string;
  timestamp: string;
}

export interface SessionInfoResponse {
  user: any;
  sessionInfo: any;
  timestamp: string;
}

export interface AccountValidationResponse {
  accountId: string;
  user: any;
  hasAccess: boolean;
  message: string;
  timestamp: string;
}

export interface PermissionTestResponse {
  user: any;
  message: string;
  emailVerified?: boolean;
  accountType?: string;
  timestamp: string;
}

export interface TokenValidationRequest {
  token: string;
  tokenType?: 'access' | 'refresh';
}

export interface TokenValidationResponse {
  tokenValidation: any;
  requestedBy: {
    accountId: string;
    email: string;
  };
  timestamp: string;
}

export interface UserLookupResponse {
  requestedUser: any;
  requestedBy: {
    accountId: string;
    email: string;
  };
  timestamp: string;
}

export interface HealthCheckResponse {
  authService: any;
  timestamp: string;
}

export interface SocketStatusResponse {
  socketClient: {
    available: boolean;
    connected: boolean;
    reconnectAttempts: number;
  };
  timestamp: string;
}
