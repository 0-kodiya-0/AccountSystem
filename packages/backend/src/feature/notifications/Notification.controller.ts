import { asyncHandler } from "../../utils/response";
import { JsonSuccess } from "../../types/response.types";
import * as NotificationService from "./Notification.service";
import {
  CreateNotificationRequest,
  UpdateNotificationRequest,
} from "./Notification.model";
import { ValidationUtils } from "../../utils/validation";

/**
 * Get all notifications for the current user
 */
export const getNotifications = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const { read, type, limit, offset } = req.query;

  // Use centralized pagination validation
  const paginationParams = ValidationUtils.validatePaginationParams({
    limit: limit as string,
    offset: offset as string,
  });

  const params = {
    accountId,
    read: read === "true" ? true : read === "false" ? false : undefined,
    type: type as any,
    limit: paginationParams.limit,
    offset: paginationParams.offset,
  };

  const result = await NotificationService.getUserNotifications(params);
  next(new JsonSuccess(result));
});

/**
 * Get unread count
 */
export const getUnreadCount = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  const result = await NotificationService.getUserNotifications({
    accountId,
    read: false,
    limit: 0,
  });

  next(new JsonSuccess({ unreadCount: result.unreadCount }));
});

/**
 * Create a new notification
 */
export const createNotification = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const notificationData = req.body as Omit<
    CreateNotificationRequest,
    "accountId"
  >;

  const notification = await NotificationService.addUserNotification({
    accountId,
    ...notificationData,
  });

  next(new JsonSuccess(notification, 201));
});

/**
 * Mark a notification as read
 */
export const markAsRead = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const notificationId = req.params.notificationId;

  const notification = await NotificationService.markNotificationAsRead(
    accountId,
    notificationId,
  );

  next(new JsonSuccess(notification));
});

/**
 * Mark all notifications as read
 */
export const markAllAsRead = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  const count = await NotificationService.markAllNotificationsAsRead(accountId);

  next(new JsonSuccess({ modifiedCount: count }));
});

/**
 * Update a notification
 */
export const updateNotification = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const notificationId = req.params.notificationId;
  const updates = req.body as UpdateNotificationRequest;

  const notification = await NotificationService.updateNotification(
    accountId,
    notificationId,
    updates,
  );

  next(new JsonSuccess(notification));
});

/**
 * Delete a notification
 */
export const deleteNotification = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;
  const notificationId = req.params.notificationId;

  await NotificationService.deleteNotification(accountId, notificationId);

  next(new JsonSuccess({ success: true }));
});

/**
 * Delete all notifications
 */
export const deleteAllNotifications = asyncHandler(async (req, res, next) => {
  const accountId = req.params.accountId;

  const count = await NotificationService.deleteAllNotifications(accountId);

  next(new JsonSuccess({ deletedCount: count }));
});
