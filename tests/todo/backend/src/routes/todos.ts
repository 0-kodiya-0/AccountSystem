import express, { Request, Response, NextFunction } from 'express';
import { database } from '@/utils/database';
import { requireAuth, addUserContext, handleAuthError, authSdk } from '@/middleware/auth';
import type { CreateTodoData, UpdateTodoData, ApiResponse, Todo } from '@/types';

const router = express.Router();

// Apply authentication to all todo routes
router.use(requireAuth);
router.use(addUserContext);
router.use(handleAuthError);

// Input validation helpers with proper TypeScript typing
const validateTodoInput = (req: Request, res: Response, next: NextFunction): void => {
  const { title } = req.body as CreateTodoData;

  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Title is required and must be a non-empty string',
      },
    } as ApiResponse);
    return;
  }

  if (title.length > 200) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Title must be 200 characters or less',
      },
    } as ApiResponse);
    return;
  }

  next();
};

const validateTodoUpdate = (req: Request, res: Response, next: NextFunction): void => {
  const { title, description, priority, completed } = req.body as Partial<UpdateTodoData>;

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title must be a non-empty string',
        },
      } as ApiResponse);
      return;
    }

    if (title.length > 200) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Title must be 200 characters or less',
        },
      } as ApiResponse);
      return;
    }
  }

  if (description !== undefined && typeof description === 'string' && description.length > 1000) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Description must be 1000 characters or less',
      },
    } as ApiResponse);
    return;
  }

  if (priority !== undefined && !['low', 'medium', 'high'].includes(priority)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Priority must be one of: low, medium, high',
      },
    } as ApiResponse);
    return;
  }

  if (completed !== undefined && typeof completed !== 'boolean') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Completed must be a boolean',
      },
    } as ApiResponse);
    return;
  }

  next();
};

// Query parameter interfaces for better type safety
interface TodosQueryParams {
  search?: string;
  priority?: 'low' | 'medium' | 'high';
  completed?: string;
}

// GET /api/todos - Get all todos for authenticated user
router.get('/', async (req: Request<{}, any, any, TodosQueryParams>, res: Response): Promise<void> => {
  try {
    if (!req.userContext) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'User context is required',
        },
      } as ApiResponse);
      return;
    }

    const { search, priority, completed } = req.query;
    let todos: Todo[];

    // Get todos with optional search
    if (search && typeof search === 'string') {
      todos = database.searchUserTodos(req.userContext.userId, search);
    } else {
      todos = database.getUserTodos(req.userContext.userId);
    }

    // Apply priority filter
    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      todos = todos.filter((todo) => todo.priority === priority);
    }

    // Apply completion status filter
    if (completed !== undefined) {
      const isCompleted = completed === 'true';
      todos = todos.filter((todo) => todo.completed === isCompleted);
    }

    res.json({
      success: true,
      data: {
        todos,
        total: todos.length,
        user: {
          id: req.userContext.userId,
          name: req.userContext.name,
          email: req.userContext.email,
        },
      },
    } as ApiResponse<{
      todos: Todo[];
      total: number;
      user: {
        id: string;
        name?: string;
        email: string;
      };
    }>);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch todos',
      },
    } as ApiResponse);
  }
});

// GET /api/todos/stats - Get user's todo statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userContext) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'User context is required',
        },
      } as ApiResponse);
      return;
    }

    const stats = database.getUserStats(req.userContext.userId);

    res.json({
      success: true,
      data: {
        stats,
        user: {
          id: req.userContext.userId,
          name: req.userContext.name,
          email: req.userContext.email,
        },
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Error fetching todo stats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch todo statistics',
      },
    } as ApiResponse);
  }
});

// GET /api/todos/:id - Get specific todo
router.get('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    if (!req.userContext) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'User context is required',
        },
      } as ApiResponse);
      return;
    }

    const { id } = req.params;

    // Validate ID format (basic UUID validation)
    if (!id || id.trim() === '') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid todo ID is required',
        },
      } as ApiResponse);
      return;
    }

    const todo = database.getTodo(id, req.userContext.userId);

    if (!todo) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TODO_NOT_FOUND',
          message: 'Todo not found or access denied',
        },
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      data: { todo },
    } as ApiResponse<{ todo: Todo }>);
  } catch (error) {
    console.error('Error fetching todo:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch todo',
      },
    } as ApiResponse);
  }
});

// POST /api/todos - Create new todo
router.post('/', validateTodoInput, async (req: Request<{}, any, CreateTodoData>, res: Response): Promise<void> => {
  try {
    if (!req.userContext) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'User context is required',
        },
      } as ApiResponse);
      return;
    }

    // Sanitize and validate input data
    const todoData: CreateTodoData = {
      title: req.body.title.trim(),
      description: req.body.description?.trim() || '',
      priority: req.body.priority || 'medium',
      dueDate: req.body.dueDate || null,
      tags: Array.isArray(req.body.tags)
        ? req.body.tags.filter((tag) => typeof tag === 'string' && tag.trim().length > 0).map((tag) => tag.trim())
        : [],
    };

    // Additional validation
    if (todoData.dueDate && typeof todoData.dueDate === 'string') {
      const dueDate = new Date(todoData.dueDate);
      if (isNaN(dueDate.getTime())) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid due date format',
          },
        } as ApiResponse);
        return;
      }
    }

    const todo = database.createTodo(req.userContext.userId, todoData);

    res.status(201).json({
      success: true,
      data: { todo },
      message: 'Todo created successfully',
    } as ApiResponse<{ todo: Todo }>);
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create todo',
      },
    } as ApiResponse);
  }
});

// PUT /api/todos/:id - Update todo
router.put(
  '/:id',
  validateTodoUpdate,
  async (req: Request<{ id: string }, any, Partial<UpdateTodoData>>, res: Response): Promise<void> => {
    try {
      if (!req.userContext) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'User context is required',
          },
        } as ApiResponse);
        return;
      }

      const { id } = req.params;

      // Validate ID format
      if (!id || id.trim() === '') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Valid todo ID is required',
          },
        } as ApiResponse);
        return;
      }

      // Build updates object with type safety
      const updates: UpdateTodoData = {};
      const allowedFields: (keyof UpdateTodoData)[] = [
        'title',
        'description',
        'priority',
        'completed',
        'dueDate',
        'tags',
      ];

      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          (updates as any)[field] = req.body[field];
        }
      });

      // Sanitize string fields
      if (updates.title && typeof updates.title === 'string') {
        updates.title = updates.title.trim();
      }

      if (updates.description && typeof updates.description === 'string') {
        updates.description = updates.description.trim();
      }

      // Validate and sanitize tags
      if (updates.tags && Array.isArray(updates.tags)) {
        updates.tags = updates.tags
          .filter((tag) => typeof tag === 'string' && tag.trim().length > 0)
          .map((tag) => tag.trim());
      }

      // Validate due date if provided
      if (updates.dueDate && typeof updates.dueDate === 'string') {
        const dueDate = new Date(updates.dueDate);
        if (isNaN(dueDate.getTime())) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid due date format',
            },
          } as ApiResponse);
          return;
        }
      }

      const todo = database.updateTodo(id, req.userContext.userId, updates);

      if (!todo) {
        res.status(404).json({
          success: false,
          error: {
            code: 'TODO_NOT_FOUND',
            message: 'Todo not found or access denied',
          },
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: { todo },
        message: 'Todo updated successfully',
      } as ApiResponse<{ todo: Todo }>);
    } catch (error) {
      console.error('Error updating todo:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update todo',
        },
      } as ApiResponse);
    }
  },
);

// DELETE /api/todos/:id - Delete todo
router.delete('/:id', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    if (!req.userContext) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'User context is required',
        },
      } as ApiResponse);
      return;
    }

    const { id } = req.params;

    // Validate ID format
    if (!id || id.trim() === '') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Valid todo ID is required',
        },
      } as ApiResponse);
      return;
    }

    const deleted = database.deleteTodo(id, req.userContext.userId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: {
          code: 'TODO_NOT_FOUND',
          message: 'Todo not found or access denied',
        },
      } as ApiResponse);
      return;
    }

    res.json({
      success: true,
      message: 'Todo deleted successfully',
    } as ApiResponse<null>);
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete todo',
      },
    } as ApiResponse);
  }
});

// Testing routes for different auth client methods

// GET /api/todos/test/http - Force HTTP client usage
router.get('/test/http', authSdk.useHttp().verifyAccessToken(), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.userContext) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'User context is required',
        },
      } as ApiResponse);
      return;
    }

    const todos = database.getUserTodos(req.userContext.userId);

    res.json({
      success: true,
      data: {
        todos,
        clientType: 'HTTP' as const,
        message: 'Using HTTP client for authentication',
        testTimestamp: new Date().toISOString(),
      },
    } as ApiResponse<{
      todos: Todo[];
      clientType: 'HTTP';
      message: string;
      testTimestamp: string;
    }>);
  } catch (error) {
    console.error('Error in HTTP client test:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'HTTP client test failed',
      },
    } as ApiResponse);
  }
});

// GET /api/todos/test/socket - Force Socket client usage
router.get(
  '/test/socket',
  authSdk.useSocket().verifyAccessToken(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.userContext) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'User context is required',
          },
        } as ApiResponse);
        return;
      }

      const todos = database.getUserTodos(req.userContext.userId);

      res.json({
        success: true,
        data: {
          todos,
          clientType: 'Socket' as const,
          message: 'Using Socket client for authentication',
          testTimestamp: new Date().toISOString(),
        },
      } as ApiResponse<{
        todos: Todo[];
        clientType: 'Socket';
        message: string;
        testTimestamp: string;
      }>);
    } catch (error) {
      console.error('Error in Socket client test:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Socket client test failed',
        },
      } as ApiResponse);
    }
  },
);

// GET /api/todos/debug/user-context - Debug endpoint to check user context
router.get('/debug/user-context', async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        userContext: req.userContext || null,
        currentUser: req.currentUser || null,
        tokenData: req.tokenData || null,
        hasInternalApi: !!req.internalApi,
        timestamp: new Date().toISOString(),
      },
    } as ApiResponse);
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Debug endpoint failed',
      },
    } as ApiResponse);
  }
});

export default router;
