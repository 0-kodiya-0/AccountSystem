'use client';

import React, { useState } from 'react';
import { Todo, CreateTodoRequest, UpdateTodoRequest } from '@/lib/api';
import {
  Button,
  Input,
  Textarea,
  Select,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Alert,
  AlertDescription,
} from '@/components/ui';
import { Plus, Edit, Trash2, Check, Clock, AlertCircle, Search } from 'lucide-react';

// Todo Item Component
interface TodoItemProps {
  todo: Todo;
  onUpdate: (id: string, updates: UpdateTodoRequest) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUpdating?: boolean;
}

export function TodoItem({ todo, onUpdate, onDelete, isUpdating }: TodoItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: todo.title,
    description: todo.description,
    priority: todo.priority,
    dueDate: todo.dueDate || '',
  });

  const handleToggleComplete = async () => {
    await onUpdate(todo.id, { completed: !todo.completed });
  };

  const handleSave = async () => {
    await onUpdate(todo.id, editData);
    setIsEditing(false);
  };

  const handleInputChange =
    (field: keyof typeof editData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setEditData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = todo.dueDate && new Date(todo.dueDate) < new Date() && !todo.completed;

  return (
    <Card className={`transition-all ${todo.completed ? 'opacity-60' : ''} ${isOverdue ? 'border-red-200' : ''}`}>
      <CardContent className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <Input value={editData.title} onChange={handleInputChange('title')} placeholder="Todo title" />
            <Textarea
              value={editData.description}
              onChange={handleInputChange('description')}
              placeholder="Description (optional)"
              rows={3}
            />
            <div className="flex gap-2">
              <Select value={editData.priority} onChange={handleInputChange('priority')}>
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </Select>
              <Input type="date" value={editData.dueDate} onChange={handleInputChange('dueDate')} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm" disabled={isUpdating}>
                Save
              </Button>
              <Button onClick={() => setIsEditing(false)} variant="outline" size="sm" disabled={isUpdating}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={handleToggleComplete}
                    className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      todo.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-green-400'
                    }`}
                    disabled={isUpdating}
                  >
                    {todo.completed && <Check className="w-3 h-3" />}
                  </button>
                  <h3 className={`font-medium ${todo.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {todo.title}
                  </h3>
                  {isOverdue && <AlertCircle className="w-4 h-4 text-red-500" />}
                </div>

                {todo.description && (
                  <p className={`text-sm text-muted-foreground mb-2 ${todo.completed ? 'line-through' : ''}`}>
                    {todo.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge className={getPriorityColor(todo.priority)}>{todo.priority} priority</Badge>
                  {todo.dueDate && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(todo.dueDate).toLocaleDateString()}
                    </Badge>
                  )}
                  {todo.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground">
                  Created: {new Date(todo.createdAt).toLocaleString()}
                  {todo.updatedAt !== todo.createdAt && (
                    <span> • Updated: {new Date(todo.updatedAt).toLocaleString()}</span>
                  )}
                </div>
              </div>

              <div className="flex gap-1 ml-4">
                <Button onClick={() => setIsEditing(true)} variant="ghost" size="sm" disabled={isUpdating}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button onClick={() => onDelete(todo.id)} variant="ghost" size="sm" disabled={isUpdating}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Todo Form Component
interface TodoFormProps {
  onSubmit: (data: CreateTodoRequest) => Promise<void>;
  isSubmitting?: boolean;
}

export function TodoForm({ onSubmit, isSubmitting }: TodoFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<CreateTodoRequest>({
    title: '',
    description: '',
    priority: 'medium',
    dueDate: '',
    tags: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    await onSubmit({
      ...formData,
      dueDate: formData.dueDate || undefined,
    });

    // Reset form
    setFormData({
      title: '',
      description: '',
      priority: 'medium',
      dueDate: '',
      tags: [],
    });
    setIsOpen(false);
  };

  const handleInputChange =
    (field: keyof CreateTodoRequest) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="w-full">
        <Plus className="w-4 h-4 mr-2" />
        Add New Todo
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Todo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            value={formData.title}
            onChange={handleInputChange('title')}
            placeholder="What needs to be done?"
            required
          />

          <Textarea
            value={formData.description}
            onChange={handleInputChange('description')}
            placeholder="Description (optional)"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <Select value={formData.priority} onChange={handleInputChange('priority')}>
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </Select>

            <Input type="date" value={formData.dueDate} onChange={handleInputChange('dueDate')} />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting || !formData.title.trim()}>
              {isSubmitting ? 'Adding...' : 'Add Todo'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// Todo Filters Component
interface TodoFiltersProps {
  onSearch: (query: string) => void;
  onFilterPriority: (priority: string | undefined) => void;
  onFilterCompleted: (completed: boolean | undefined) => void;
  searchQuery: string;
  priorityFilter: string | undefined;
  completedFilter: boolean | undefined;
}

export function TodoFilters({
  onSearch,
  onFilterPriority,
  onFilterCompleted,
  searchQuery,
  priorityFilter,
  completedFilter,
}: TodoFiltersProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterPriority(value === '' ? undefined : value);
  };

  const handleCompletedChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFilterCompleted(value === '' ? undefined : value === 'true');
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search todos..."
                className="pl-10"
              />
            </div>
          </div>

          <Select value={priorityFilter || ''} onChange={handlePriorityChange}>
            <option value="">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </Select>

          <Select
            value={completedFilter === undefined ? '' : completedFilter.toString()}
            onChange={handleCompletedChange}
          >
            <option value="">All Status</option>
            <option value="false">Pending</option>
            <option value="true">Completed</option>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

// Todo List Component
interface TodoListProps {
  todos: Todo[];
  onUpdate: (id: string, updates: UpdateTodoRequest) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
  updatingIds?: Set<string>;
}

export function TodoList({ todos, onUpdate, onDelete, isLoading, error, updatingIds = new Set() }: TodoListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="flex gap-2">
                  <div className="h-6 bg-muted rounded w-16"></div>
                  <div className="h-6 bg-muted rounded w-20"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (todos.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-muted-foreground">
            <div className="text-4xl mb-4">📝</div>
            <h3 className="text-lg font-medium mb-2">No todos found</h3>
            <p className="text-sm">Create your first todo to get started!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isUpdating={updatingIds.has(todo.id)}
        />
      ))}
    </div>
  );
}
