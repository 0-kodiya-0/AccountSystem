import { NotificationListResponse, CreateNotificationRequest, Notification } from '../types';
import { HttpClient } from '../client/HttpClient';

// Validation utility functions
const validateAccountId = (accountId: string | null | undefined, context: string): void => {
  if (!accountId || typeof accountId !== 'string' || accountId.trim() === '') {
    throw new Error(`Valid accountId is required for ${context}`);
  }
};

const validateNotificationId = (notificationId: string | null | undefined, context: string): void => {
  if (!notificationId || typeof notificationId !== 'string' || notificationId.trim() === '') {
    throw new Error(`Valid notificationId is required for ${context}`);
  }
};

const validateRequired = (value: any, fieldName: string, context: string): void => {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    throw new Error(`${fieldName} is required for ${context}`);
  }
};

const validateNotificationData = (notification: CreateNotificationRequest, context: string): void => {
  validateRequired(notification, 'notification data', context);
  validateRequired(notification.title, 'notification title', context);
  validateRequired(notification.message, 'notification message', context);
  validateRequired(notification.type, 'notification type', context);

  // Validate notification type
  const validTypes = ['info', 'success', 'warning', 'error'];
  if (!validTypes.includes(notification.type)) {
    throw new Error(`Invalid notification type for ${context}. Must be one of: ${validTypes.join(', ')}`);
  }

  // Validate optional fields
  if (notification.expiresAt !== undefined) {
    if (typeof notification.expiresAt !== 'number' || notification.expiresAt <= Date.now()) {
      throw new Error(`expiresAt must be a future timestamp for ${context}`);
    }
  }

  if (notification.link && (typeof notification.link !== 'string' || notification.link.trim() === '')) {
    throw new Error(`link must be a non-empty string for ${context}`);
  }
};

const validatePaginationOptions = (options: any, context: string): void => {
  if (options.limit !== undefined) {
    if (typeof options.limit !== 'number' || options.limit < 1 || options.limit > 100) {
      throw new Error(`limit must be between 1 and 100 for ${context}`);
    }
  }

  if (options.offset !== undefined) {
    if (typeof options.offset !== 'number' || options.offset < 0) {
      throw new Error(`offset must be a non-negative number for ${context}`);
    }
  }

  if (options.read !== undefined) {
    if (typeof options.read !== 'boolean') {
      throw new Error(`read filter must be a boolean for ${context}`);
    }
  }

  if (options.type !== undefined) {
    if (typeof options.type !== 'string' || options.type.trim() === '') {
      throw new Error(`type filter must be a non-empty string for ${context}`);
    }
  }
};

export class NotificationService {
  constructor(private httpClient: HttpClient) {
    if (!httpClient) {
      throw new Error('HttpClient is required for NotificationService');
    }
  }

  async getNotifications(
    accountId: string,
    options?: {
      read?: boolean;
      type?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<NotificationListResponse> {
    validateAccountId(accountId, 'get notifications');

    if (options) {
      validatePaginationOptions(options, 'get notifications');
    }

    const params = new URLSearchParams();
    if (options?.read !== undefined) {
      params.append('read', options.read.toString());
    }
    if (options?.type) {
      params.append('type', options.type);
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.offset) {
      params.append('offset', options.offset.toString());
    }

    const queryString = params.toString();
    return this.httpClient.get(`/${accountId}/notifications${queryString ? `?${queryString}` : ''}`);
  }

  async getUnreadCount(accountId: string): Promise<{ unreadCount: number }> {
    validateAccountId(accountId, 'get unread count');

    return this.httpClient.get(`/${accountId}/notifications/unread`);
  }

  async createNotification(accountId: string, notification: CreateNotificationRequest): Promise<Notification> {
    validateAccountId(accountId, 'create notification');
    validateNotificationData(notification, 'create notification');

    return this.httpClient.post(`/${accountId}/notifications`, notification);
  }

  async markNotificationAsRead(accountId: string, notificationId: string): Promise<Notification> {
    validateAccountId(accountId, 'mark notification as read');
    validateNotificationId(notificationId, 'mark notification as read');

    return this.httpClient.patch(`/${accountId}/notifications/${notificationId}/read`);
  }

  async markAllNotificationsAsRead(accountId: string): Promise<{ modifiedCount: number }> {
    validateAccountId(accountId, 'mark all notifications as read');

    return this.httpClient.patch(`/${accountId}/notifications/read-all`);
  }

  async updateNotification(
    accountId: string,
    notificationId: string,
    updates: Partial<Notification>,
  ): Promise<Notification> {
    validateAccountId(accountId, 'update notification');
    validateNotificationId(notificationId, 'update notification');
    validateRequired(updates, 'notification updates', 'update notification');

    // Validate specific update fields if they exist
    if (updates.title !== undefined) {
      validateRequired(updates.title, 'notification title', 'update notification');
    }

    if (updates.message !== undefined) {
      validateRequired(updates.message, 'notification message', 'update notification');
    }

    if (updates.type !== undefined) {
      const validTypes = ['info', 'success', 'warning', 'error'];
      if (!validTypes.includes(updates.type)) {
        throw new Error(`Invalid notification type for update notification. Must be one of: ${validTypes.join(', ')}`);
      }
    }

    if (updates.read !== undefined) {
      if (typeof updates.read !== 'boolean') {
        throw new Error('read status must be a boolean for update notification');
      }
    }

    return this.httpClient.patch(`/${accountId}/notifications/${notificationId}`, updates);
  }

  async deleteNotification(accountId: string, notificationId: string): Promise<{ success: boolean }> {
    validateAccountId(accountId, 'delete notification');
    validateNotificationId(notificationId, 'delete notification');

    return this.httpClient.delete(`/${accountId}/notifications/${notificationId}`);
  }

  async deleteAllNotifications(accountId: string): Promise<{ deletedCount: number }> {
    validateAccountId(accountId, 'delete all notifications');

    return this.httpClient.delete(`/${accountId}/notifications`);
  }
}
