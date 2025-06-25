import { v4 as uuidv4 } from 'uuid';
import type { Todo, CreateTodoData, UpdateTodoData, TodoStats, DatabaseStats } from '@/types';

// Simple in-memory database for testing
class InMemoryDatabase {
  private todos = new Map<string, Todo>();
  private userTodos = new Map<string, Set<string>>(); // userId -> Set of todoIds

  // Get all todos for a user
  getUserTodos(userId: string): Todo[] {
    const userTodoIds = this.userTodos.get(userId) || new Set<string>();
    return Array.from(userTodoIds)
      .map((todoId) => this.todos.get(todoId))
      .filter((todo): todo is Todo => todo !== undefined)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // Get single todo by ID (with user ownership check)
  getTodo(todoId: string, userId: string): Todo | null {
    const todo = this.todos.get(todoId);
    if (!todo || todo.userId !== userId) {
      return null;
    }
    return todo;
  }

  // Create new todo
  createTodo(userId: string, todoData: CreateTodoData): Todo {
    const todoId = uuidv4();
    const now = new Date().toISOString();

    const todo: Todo = {
      id: todoId,
      userId,
      title: todoData.title,
      description: todoData.description || '',
      completed: false,
      priority: todoData.priority || 'medium',
      dueDate: todoData.dueDate || null,
      tags: todoData.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    this.todos.set(todoId, todo);

    // Add to user's todo list
    if (!this.userTodos.has(userId)) {
      this.userTodos.set(userId, new Set<string>());
    }
    this.userTodos.get(userId)!.add(todoId);

    return todo;
  }

  // Update existing todo
  updateTodo(todoId: string, userId: string, updates: UpdateTodoData): Todo | null {
    const todo = this.getTodo(todoId, userId);
    if (!todo) {
      return null;
    }

    const updatedTodo: Todo = {
      ...todo,
      ...updates,
      id: todoId, // Ensure ID doesn't change
      userId, // Ensure userId doesn't change
      updatedAt: new Date().toISOString(),
    };

    this.todos.set(todoId, updatedTodo);
    return updatedTodo;
  }

  // Delete todo
  deleteTodo(todoId: string, userId: string): boolean {
    const todo = this.getTodo(todoId, userId);
    if (!todo) {
      return false;
    }

    this.todos.delete(todoId);

    // Remove from user's todo list
    const userTodoIds = this.userTodos.get(userId);
    if (userTodoIds) {
      userTodoIds.delete(todoId);
    }

    return true;
  }

  // Get todo statistics for user
  getUserStats(userId: string): TodoStats {
    const todos = this.getUserTodos(userId);

    return {
      total: todos.length,
      completed: todos.filter((todo) => todo.completed).length,
      pending: todos.filter((todo) => !todo.completed).length,
      overdue: todos.filter((todo) => {
        if (!todo.dueDate || todo.completed) return false;
        return new Date(todo.dueDate) < new Date();
      }).length,
      byPriority: {
        high: todos.filter((todo) => todo.priority === 'high').length,
        medium: todos.filter((todo) => todo.priority === 'medium').length,
        low: todos.filter((todo) => todo.priority === 'low').length,
      },
    };
  }

  // Search todos
  searchUserTodos(userId: string, query: string): Todo[] {
    const todos = this.getUserTodos(userId);
    const searchTerm = query.toLowerCase();

    return todos.filter(
      (todo) =>
        todo.title.toLowerCase().includes(searchTerm) ||
        todo.description.toLowerCase().includes(searchTerm) ||
        todo.tags.some((tag) => tag.toLowerCase().includes(searchTerm)),
    );
  }

  // Clear all data (for testing)
  clear(): void {
    this.todos.clear();
    this.userTodos.clear();
  }

  // Get database stats
  getStats(): DatabaseStats {
    return {
      totalTodos: this.todos.size,
      totalUsers: this.userTodos.size,
      todosPerUser: Array.from(this.userTodos.entries()).map(([userId, todoIds]) => ({
        userId,
        todoCount: todoIds.size,
      })),
    };
  }
}

// Create global database instance
const database = new InMemoryDatabase();

// Seed some sample data for testing
function seedSampleData(): void {
  // This would normally be done through the API, but we'll add some sample data
  console.log('📊 Database initialized (in-memory)');
}

// Initialize sample data
seedSampleData();

export { database, seedSampleData };
