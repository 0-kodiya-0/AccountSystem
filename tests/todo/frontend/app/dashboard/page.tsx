'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AuthGuard, useAccount } from '../../../../../packages/sdk/auth-react-sdk/src'; // Replace with your actual package name
import { todoApi, Todo, CreateTodoRequest, UpdateTodoRequest, TodoStats, ApiError } from '@/lib/api';
import { routes } from '@/lib/auth';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from '@/components/ui';
import { TodoForm, TodoList, TodoFilters } from '@/components/todos';
import {
  ArrowLeft,
  CheckSquare,
  User,
  BarChart3,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';

function DashboardContent() {
  // State management
  const [todos, setTodos] = useState<Todo[]>([]);
  const [stats, setStats] = useState<TodoStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>();
  const [completedFilter, setCompletedFilter] = useState<boolean | undefined>();

  // Auth hooks
  const account = useAccount();

  // Load data function
  const loadTodos = useCallback(async () => {
    try {
      setError(null);
      const params: {
        search?: string;
        priority?: 'low' | 'medium' | 'high';
        completed?: boolean;
      } = {};

      if (searchQuery) params.search = searchQuery;
      if (priorityFilter) params.priority = priorityFilter as 'low' | 'medium' | 'high';
      if (completedFilter !== undefined) params.completed = completedFilter;

      const result = await todoApi.getTodos(params);
      setTodos(result.todos);
    } catch (err) {
      console.error('Failed to load todos:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to load todos');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, priorityFilter, completedFilter]);

  const loadStats = useCallback(async () => {
    try {
      const result = await todoApi.getStats();
      setStats(result.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Load data on mount and when filters change
  useEffect(() => {
    loadTodos();
    loadStats();
  }, [loadTodos, loadStats]);

  const handleCreateTodo = async (data: CreateTodoRequest) => {
    try {
      setIsSubmitting(true);
      setError(null);
      const result = await todoApi.createTodo(data);
      setTodos((prev) => [result.todo, ...prev]);
      await loadStats(); // Refresh stats
    } catch (err) {
      console.error('Failed to create todo:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to create todo');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTodo = async (id: string, updates: UpdateTodoRequest) => {
    try {
      setUpdatingIds((prev) => new Set(prev).add(id));
      setError(null);
      const result = await todoApi.updateTodo(id, updates);
      setTodos((prev) => prev.map((todo) => (todo.id === id ? result.todo : todo)));
      await loadStats(); // Refresh stats
    } catch (err) {
      console.error('Failed to update todo:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to update todo');
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDeleteTodo = async (id: string) => {
    if (!confirm('Are you sure you want to delete this todo?')) return;

    try {
      setUpdatingIds((prev) => new Set(prev).add(id));
      setError(null);
      await todoApi.deleteTodo(id);
      setTodos((prev) => prev.filter((todo) => todo.id !== id));
      await loadStats(); // Refresh stats
    } catch (err) {
      console.error('Failed to delete todo:', err);
      setError(err instanceof ApiError ? err.message : 'Failed to delete todo');
    } finally {
      setUpdatingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const testHttpClient = async () => {
    try {
      const result = await todoApi.testHttp();
      alert(`${result.message}\nFound ${result.todos.length} todos via ${result.clientType} client`);
    } catch (err) {
      alert('HTTP client test failed: ' + (err instanceof ApiError ? err.message : 'Unknown error'));
    }
  };

  const testSocketClient = async () => {
    try {
      const result = await todoApi.testSocket();
      alert(`${result.message}\nFound ${result.todos.length} todos via ${result.clientType} client`);
    } catch (err) {
      alert('Socket client test failed: ' + (err instanceof ApiError ? err.message : 'Unknown error'));
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await loadTodos();
    await loadStats();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <CheckSquare className="w-6 h-6 text-blue-600" />
                <h1 className="text-2xl font-bold">Todo Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleRefresh} variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/auth">
                <Button variant="outline" size="sm">
                  Auth Status
                  <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              </Link>
            </div>
          </div>

          {/* User Info */}
          {account.data && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium">{account.data.userDetails.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {account.data.userDetails.email} • {account.data.accountType}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={account.data.status === 'active' ? 'default' : 'secondary'}>
                      {account.data.status}
                    </Badge>
                    <Badge variant={account.data.userDetails.emailVerified ? 'default' : 'destructive'}>
                      {account.data.userDetails.emailVerified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </header>

        {/* Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4 mb-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <div>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                    <p className="text-sm text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <div>
                    <p className="text-2xl font-bold">{stats.overdue}</p>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Client Testing */}
        <div className="mb-8">
          <Card>
            <CardHeader>
              <CardTitle>SDK Client Testing</CardTitle>
              <CardDescription>Test different authentication client methods</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Button onClick={testHttpClient} variant="outline" size="sm">
                  <Wifi className="w-4 h-4 mr-2" />
                  Test HTTP Client
                </Button>
                <Button onClick={testSocketClient} variant="outline" size="sm">
                  <WifiOff className="w-4 h-4 mr-2" />
                  Test Socket Client
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Todo Form */}
          <div className="lg:col-span-1">
            <div className="space-y-6">
              <TodoForm onSubmit={handleCreateTodo} isSubmitting={isSubmitting} />

              {/* Filters */}
              <TodoFilters
                onSearch={setSearchQuery}
                onFilterPriority={setPriorityFilter}
                onFilterCompleted={setCompletedFilter}
                searchQuery={searchQuery}
                priorityFilter={priorityFilter}
                completedFilter={completedFilter}
              />
            </div>
          </div>

          {/* Todo List */}
          <div className="lg:col-span-2">
            <TodoList
              todos={todos}
              onUpdate={handleUpdateTodo}
              onDelete={handleDeleteTodo}
              isLoading={isLoading}
              error={error}
              updatingIds={updatingIds}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard
      allowGuests={false}
      requireAccount={true}
      redirectToLogin={routes.login}
      redirectToAccountSelection={routes.accountSelection}
    >
      <DashboardContent />
    </AuthGuard>
  );
}
