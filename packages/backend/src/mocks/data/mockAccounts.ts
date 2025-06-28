import { Account, AccountType, AccountStatus, OAuthProviders } from '../../feature/account/Account.types';

export const mockLocalAccount: Account = {
  id: '507f1f77bcf86cd799439011',
  created: '2024-01-15T10:30:00.000Z',
  updated: '2024-01-20T14:45:00.000Z',
  accountType: AccountType.Local,
  status: AccountStatus.Active,
  userDetails: {
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    email: 'john.doe@example.com',
    imageUrl: 'https://via.placeholder.com/150',
    birthdate: '1990-05-15',
    username: 'johndoe90',
    emailVerified: true,
  },
  security: {
    password: '$2b$10$hashedpasswordexamplestring',
    twoFactorEnabled: false,
    sessionTimeout: 3600,
    autoLock: false,
    passwordSalt: 'randomsalt123',
    lastPasswordChange: new Date('2024-01-20T14:45:00.000Z'),
    previousPasswords: [],
    failedLoginAttempts: 0,
  },
};

export const mockOAuthAccount: Account = {
  id: '507f1f77bcf86cd799439012',
  created: '2024-01-10T08:15:00.000Z',
  updated: '2024-01-25T16:20:00.000Z',
  accountType: AccountType.OAuth,
  status: AccountStatus.Active,
  provider: OAuthProviders.Google,
  userDetails: {
    name: 'Jane Smith',
    email: 'jane.smith@gmail.com',
    imageUrl: 'https://lh3.googleusercontent.com/a/example',
    emailVerified: true,
  },
  security: {
    twoFactorEnabled: true,
    twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    twoFactorBackupCodes: ['12345678', '87654321', '13579246'],
    sessionTimeout: 7200,
    autoLock: false,
  },
};

export const mockUnverifiedAccount: Account = {
  id: '507f1f77bcf86cd799439013',
  created: '2024-01-28T12:00:00.000Z',
  updated: '2024-01-28T12:00:00.000Z',
  accountType: AccountType.Local,
  status: AccountStatus.Unverified,
  userDetails: {
    firstName: 'Bob',
    lastName: 'Wilson',
    name: 'Bob Wilson',
    email: 'bob.wilson@example.com',
    username: 'bobwilson',
    emailVerified: false,
  },
  security: {
    password: '$2b$10$anotherhashed$example',
    twoFactorEnabled: false,
    sessionTimeout: 3600,
    autoLock: false,
    failedLoginAttempts: 2,
  },
};

export const mockAccounts = [mockLocalAccount, mockOAuthAccount, mockUnverifiedAccount];
