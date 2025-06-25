// Types for API responses
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  message?: string;
}

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

export interface CreateTodoRequest {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  tags?: string[];
}

export interface UpdateTodoRequest {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  completed?: boolean;
  dueDate?: string;
  tags?: string[];
}

// User and Session types
export interface User {
  _id: string;
  email: string;
  accountType: string;
  name?: string;
  profilePicture?: string;
  isEmailVerified?: boolean;
}

export interface TokenData {
  valid: boolean;
  accountId?: string;
  accountType?: string;
  isRefreshToken?: boolean;
  expiresAt?: number;
}

export interface SessionInfo {
  accountIds: string[];
  currentAccountId: string;
  sessionId: string;
  createdAt: string;
  lastActivity: string;
}

// Auth API Response types
export interface AuthStatusData {
  isAuthenticated: boolean;
  user: User | null;
  tokenData: TokenData | null;
  sessionInfo: SessionInfo | null;
  timestamp: string;
}

export interface CurrentUserData {
  user: User;
  tokenData: TokenData;
  accountId?: string;
  timestamp: string;
}

export interface SessionData {
  user: User;
  sessionInfo: SessionInfo;
  timestamp: string;
}

export interface TokenValidationData {
  tokenValidation: Record<string, unknown>;
  requestedBy: {
    accountId: string;
    email: string;
  };
  timestamp: string;
}

export interface UserLookupData {
  requestedUser: Record<string, unknown>;
  requestedBy: {
    accountId: string;
    email: string;
  };
  timestamp: string;
}

export interface HealthData {
  authService: Record<string, unknown>;
  timestamp: string;
}

export interface SocketStatusData {
  socketClient: {
    available: boolean;
    connected: boolean;
    reconnectAttempts: number;
  };
  timestamp: string;
}

// API Error class
export class ApiError extends Error {
  constructor(public code: string, message: string, public statusCode?: number) {
    super(message);
    this.name = 'ApiError';
  }

  static fromResponse(response: ApiResponse, statusCode?: number): ApiError {
    const code = response?.error?.code || 'UNKNOWN_ERROR';
    const message = response?.error?.message || response?.message || 'An unknown error occurred';
    return new ApiError(code, message, statusCode);
  }
}

// Base API client
class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = 'http://localhost:7000/api/v1/todo';
  }

  private async request<T>(method: string, endpoint: string, data?: unknown, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Important for cookie-based auth
      ...options,
    };

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      const result: ApiResponse<T> = await response.json();

      if (!response.ok) {
        throw ApiError.fromResponse(result, response.status);
      }

      if (!result.success) {
        throw ApiError.fromResponse(result, response.status);
      }

      return result.data as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      // Network or parsing error
      throw new ApiError('NETWORK_ERROR', error instanceof Error ? error.message : 'Network request failed');
    }
  }

  // HTTP methods
  async get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  async post<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('POST', endpoint, data, options);
  }

  async put<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('PUT', endpoint, data, options);
  }

  async delete<T>(endpoint: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', endpoint, data, options);
  }
}

// Create API client instance
const apiClient = new ApiClient();

// Todo API methods
export const todoApi = {
  // Get all todos with optional filters
  async getTodos(params?: {
    search?: string;
    priority?: 'low' | 'medium' | 'high';
    completed?: boolean;
  }): Promise<{ todos: Todo[]; total: number; user: { id: string; name?: string; email: string } }> {
    const searchParams = new URLSearchParams();

    if (params?.search) searchParams.append('search', params.search);
    if (params?.priority) searchParams.append('priority', params.priority);
    if (params?.completed !== undefined) searchParams.append('completed', params.completed.toString());

    const query = searchParams.toString();
    return apiClient.get(`/api/todos${query ? `?${query}` : ''}`);
  },

  // Get todo statistics
  async getStats(): Promise<{ stats: TodoStats; user: { id: string; name?: string; email: string } }> {
    return apiClient.get('/api/todos/stats');
  },

  // Get single todo
  async getTodo(id: string): Promise<{ todo: Todo }> {
    return apiClient.get(`/api/todos/${id}`);
  },

  // Create new todo
  async createTodo(data: CreateTodoRequest): Promise<{ todo: Todo }> {
    return apiClient.post('/api/todos', data);
  },

  // Update todo
  async updateTodo(id: string, data: UpdateTodoRequest): Promise<{ todo: Todo }> {
    return apiClient.put(`/api/todos/${id}`, data);
  },

  // Delete todo
  async deleteTodo(id: string): Promise<void> {
    return apiClient.delete(`/api/todos/${id}`);
  },

  // Test HTTP client
  async testHttp(): Promise<{ todos: Todo[]; clientType: string; message: string }> {
    return apiClient.get('/api/todos/test/http');
  },

  // Test Socket client
  async testSocket(): Promise<{ todos: Todo[]; clientType: string; message: string }> {
    return apiClient.get('/api/todos/test/socket');
  },
};

// Auth API methods for testing
export const authApi = {
  // Get auth status
  async getStatus(): Promise<AuthStatusData> {
    return apiClient.get('/api/auth/status');
  },

  // Get current user
  async getMe(): Promise<CurrentUserData> {
    return apiClient.get('/api/auth/me');
  },

  // Get session info
  async getSession(): Promise<SessionData> {
    return apiClient.get('/api/auth/session');
  },

  // Validate account access
  async validateAccount(accountId: string): Promise<Record<string, unknown>> {
    return apiClient.get(`/api/auth/validate/${accountId}`);
  },

  // Test email verification requirement
  async testEmailVerified(): Promise<Record<string, unknown>> {
    return apiClient.get('/api/auth/permissions/email-verified');
  },

  // Test OAuth account requirement
  async testOAuthOnly(): Promise<Record<string, unknown>> {
    return apiClient.get('/api/auth/permissions/oauth-only');
  },

  // Test Local account requirement
  async testLocalOnly(): Promise<Record<string, unknown>> {
    return apiClient.get('/api/auth/permissions/local-only');
  },

  // Validate token
  async validateToken(token: string, tokenType?: 'access' | 'refresh'): Promise<TokenValidationData> {
    return apiClient.post('/api/auth/token/validate', { token, tokenType });
  },

  // Get user by ID
  async getUserById(userId: string): Promise<UserLookupData> {
    return apiClient.get(`/api/auth/user/${userId}`);
  },

  // Get user by email
  async getUserByEmail(email: string): Promise<UserLookupData> {
    return apiClient.get(`/api/auth/user/email/${encodeURIComponent(email)}`);
  },

  // Check auth service health
  async getHealth(): Promise<HealthData> {
    return apiClient.get('/api/auth/health');
  },

  // Check socket status
  async getSocketStatus(): Promise<SocketStatusData> {
    return apiClient.get('/api/auth/client/socket/status');
  },
};

export { apiClient };
export default apiClient;
