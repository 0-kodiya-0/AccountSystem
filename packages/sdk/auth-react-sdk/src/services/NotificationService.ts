import {
  NotificationListResponse,
  CreateNotificationRequest,
  Notification,
} from '../types';
import { HttpClient } from '../client/HttpClient';

export class NotificationService {
  constructor(private httpClient: HttpClient) {}

  async getNotifications(
    accountId: string,
    options?: {
      read?: boolean;
      type?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<NotificationListResponse> {
    const params = new URLSearchParams();
    if (options?.read !== undefined)
      params.append('read', options.read.toString());
    if (options?.type) params.append('type', options.type);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    return this.httpClient.get(
      `/${accountId}/notifications?${params.toString()}`,
    );
  }

  async getUnreadCount(accountId: string): Promise<{ unreadCount: number }> {
    return this.httpClient.get(`/${accountId}/notifications/unread`);
  }

  async createNotification(
    accountId: string,
    notification: CreateNotificationRequest,
  ): Promise<Notification> {
    return this.httpClient.post(`/${accountId}/notifications`, notification);
  }

  async markNotificationAsRead(
    accountId: string,
    notificationId: string,
  ): Promise<Notification> {
    return this.httpClient.patch(
      `/${accountId}/notifications/${notificationId}/read`,
    );
  }

  async markAllNotificationsAsRead(
    accountId: string,
  ): Promise<{ modifiedCount: number }> {
    return this.httpClient.patch(`/${accountId}/notifications/read-all`);
  }

  async updateNotification(
    accountId: string,
    notificationId: string,
    updates: Partial<Notification>,
  ): Promise<Notification> {
    return this.httpClient.patch(
      `/${accountId}/notifications/${notificationId}`,
      updates,
    );
  }

  async deleteNotification(
    accountId: string,
    notificationId: string,
  ): Promise<{ success: boolean }> {
    return this.httpClient.delete(
      `/${accountId}/notifications/${notificationId}`,
    );
  }

  async deleteAllNotifications(
    accountId: string,
  ): Promise<{ deletedCount: number }> {
    return this.httpClient.delete(`/${accountId}/notifications`);
  }
}
