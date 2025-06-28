import { Notification, NotificationType } from '../../feature/notifications/Notification.model';

export const mockInfoNotification: Notification = {
  id: '65a1b2c3d4e5f6789abcdef0',
  accountId: '507f1f77bcf86cd799439011',
  title: 'Welcome to AccountSystem',
  message: 'Your account has been successfully created. Start exploring the features!',
  type: 'info' as NotificationType,
  read: false,
  link: '/dashboard',
  timestamp: Date.now() - 3600000, // 1 hour ago
  metadata: {
    category: 'welcome',
    priority: 'normal',
  },
};

export const mockSuccessNotification: Notification = {
  id: '65a1b2c3d4e5f6789abcdef1',
  accountId: '507f1f77bcf86cd799439011',
  title: 'Password Updated',
  message: 'Your password has been successfully updated.',
  type: 'success' as NotificationType,
  read: true,
  timestamp: Date.now() - 7200000, // 2 hours ago
  metadata: {
    category: 'security',
    action: 'password_change',
  },
};

export const mockWarningNotification: Notification = {
  id: '65a1b2c3d4e5f6789abcdef2',
  accountId: '507f1f77bcf86cd799439012',
  title: 'Unusual Login Activity',
  message: 'We detected a login from a new device. If this was not you, please secure your account.',
  type: 'warning' as NotificationType,
  read: false,
  link: '/account/security',
  timestamp: Date.now() - 1800000, // 30 minutes ago
  expiresAt: Date.now() + 86400000, // Expires in 24 hours
  metadata: {
    category: 'security',
    deviceInfo: 'Chrome on Windows',
    location: 'New York, US',
  },
};

export const mockErrorNotification: Notification = {
  id: '65a1b2c3d4e5f6789abcdef3',
  accountId: '507f1f77bcf86cd799439011',
  title: 'Login Failed',
  message: 'Multiple failed login attempts detected. Your account has been temporarily locked.',
  type: 'error' as NotificationType,
  read: false,
  timestamp: Date.now() - 900000, // 15 minutes ago
  metadata: {
    category: 'security',
    attempts: 5,
    lockDuration: '15 minutes',
  },
};

export const mockNotifications = [
  mockInfoNotification,
  mockSuccessNotification,
  mockWarningNotification,
  mockErrorNotification,
];
