import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ServicesProvider, ServicesConfig } from '../context/ServicesProvider';
import { AccountType, AccountStatus } from '../types';
import React from 'react';

// Mock data factories
export const createMockAccount = (overrides = {}) => ({
  id: '507f1f77bcf86cd799439011',
  created: '2024-01-01T00:00:00.000Z',
  updated: '2024-01-01T00:00:00.000Z',
  accountType: AccountType.Local,
  status: AccountStatus.Active,
  userDetails: {
    firstName: 'John',
    lastName: 'Doe',
    name: 'John Doe',
    email: 'john.doe@example.com',
    imageUrl: 'https://example.com/avatar.jpg',
    username: 'johndoe',
    emailVerified: true,
  },
  security: {
    twoFactorEnabled: false,
    sessionTimeout: 3600,
    autoLock: false,
  },
  ...overrides,
});

export const createMockSessionAccount = (overrides = {}) => ({
  id: '507f1f77bcf86cd799439011',
  accountType: AccountType.Local,
  status: AccountStatus.Active,
  userDetails: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    username: 'johndoe',
    imageUrl: 'https://example.com/avatar.jpg',
  },
  ...overrides,
});

export const createMockSessionInfo = (overrides = {}) => ({
  hasSession: true,
  accountIds: ['507f1f77bcf86cd799439011'],
  currentAccountId: '507f1f77bcf86cd799439011',
  isValid: true,
  ...overrides,
});

export const createMockSDKConfig = (overrides = {}): ServicesConfig => ({
  sdkConfig: {
    backendUrl: 'http://localhost:3001',
    timeout: 30000,
    withCredentials: true,
    ...overrides,
  },
});

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  config?: Partial<ServicesConfig>;
}

export function renderWithProviders(ui: ReactElement, options: CustomRenderOptions = {}) {
  const { config = {}, ...renderOptions } = options;

  const mockConfig = createMockSDKConfig(config);

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ServicesProvider config={mockConfig}>{children}</ServicesProvider>;
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock fetch response helper
export const createMockFetchResponse = (data: any, ok = true, status = 200) => {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(ok ? { data } : data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
};

// Wait for async operations
export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
