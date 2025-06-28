import { AccountStatus, AccountType, OAuthProviders } from '../../feature/account';
import { AccountSessionInfo, SessionAccount } from '../../feature/session/session.types';

export const mockSessionAccount1: SessionAccount = {
  id: '507f1f77bcf86cd799439011',
  accountType: AccountType.Local,
  status: AccountStatus.Active,
  userDetails: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    username: 'johndoe90',
    imageUrl: 'https://via.placeholder.com/150',
  },
};

export const mockSessionAccount2: SessionAccount = {
  id: '507f1f77bcf86cd799439012',
  accountType: AccountType.OAuth,
  status: AccountStatus.Active,
  provider: OAuthProviders.Google,
  userDetails: {
    name: 'Jane Smith',
    email: 'jane.smith@gmail.com',
    imageUrl: 'https://lh3.googleusercontent.com/a/example',
  },
};

export const mockAccountSession: AccountSessionInfo = {
  hasSession: true,
  accountIds: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  currentAccountId: '507f1f77bcf86cd799439011',
  isValid: true,
};

export const mockEmptySession: AccountSessionInfo = {
  hasSession: false,
  accountIds: [],
  currentAccountId: null,
  isValid: false,
};
