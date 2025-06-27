import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AuthGuard } from '../AuthGuard';
import { useSession } from '../../hooks/useSession';
import { useConfig } from '../../context/ServicesProvider';

// Mock dependencies
vi.mock('../../hooks/useSession');
vi.mock('../../context/ServicesProvider');

const mockUseSession = vi.mocked(useSession);
const mockUseConfig = vi.mocked(useConfig);

// Mock window.location
const mockLocation = {
  href: 'http://localhost:3000',
  reload: vi.fn(),
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Test components
const TestChildren = () => <div data-testid="test-children">Protected Content</div>;
const CustomLoadingComponent = ({ reason }: { reason?: string }) => (
  <div data-testid="custom-loading">Custom Loading: {reason}</div>
);
const CustomErrorComponent = ({ error }: { error: string }) => (
  <div data-testid="custom-error">Custom Error: {error}</div>
);
const CustomRedirectComponent = ({ destination }: { destination: string }) => (
  <div data-testid="custom-redirect">Redirecting to: {destination}</div>
);

describe('AuthGuard', () => {
  const defaultConfig = {
    sdkConfig: {
      backendUrl: 'https://api.example.com',
      frontendProxyUrl: undefined,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocation.href = 'http://localhost:3000';
    mockUseConfig.mockReturnValue(defaultConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Guest Mode', () => {
    test('should allow guests with allowGuests=true', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={true} requireAccount={false}>
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('test-children')).toBeInTheDocument();
    });

    test('should redirect authenticated users on guest pages', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(<AuthGuard allowGuests={true} requireAccount={false} redirectOnAuthenticated="/dashboard" />);

      expect(mockLocation.href).toBe('/dashboard');
    });

    test('should show children when allowGuests=true and user authenticated', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={true} requireAccount={false}>
          <TestChildren />
        </AuthGuard>,
      );

      // Should show children when children are provided, even if authenticated
      expect(screen.getByTestId('test-children')).toBeInTheDocument();
    });

    test('should handle guest mode with custom redirect component', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={true}
          requireAccount={false}
          redirectOnAuthenticated="/dashboard"
          redirectingComponent={CustomRedirectComponent}
        />,
      );

      expect(screen.getByTestId('custom-redirect')).toBeInTheDocument();
      expect(screen.getByText('Redirecting to: /dashboard')).toBeInTheDocument();
    });

    test('should show error when redirectOnAuthenticated is missing', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(<AuthGuard allowGuests={true} requireAccount={false} />);

      expect(screen.getByText(/Configuration error: redirectOnAuthenticated is required/)).toBeInTheDocument();
    });
  });

  describe('Protected Mode', () => {
    test('should redirect unauthenticated users', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login">
          <TestChildren />
        </AuthGuard>,
      );

      expect(mockLocation.href).toBe('/login');
    });

    test('should show content when authenticated', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/select-account"
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('test-children')).toBeInTheDocument();
    });

    test('should handle account requirement', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: false, // No account selected
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/select-account"
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(mockLocation.href).toBe('/select-account');
    });

    test('should redirect to account selection when needed', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/select-account"
          redirectingComponent={CustomRedirectComponent}
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('custom-redirect')).toBeInTheDocument();
      expect(screen.getByText('Redirecting to: /select-account')).toBeInTheDocument();
    });

    test('should show error when redirectToLogin is missing', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true}>
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByText(/Configuration error: redirectToLogin is required/)).toBeInTheDocument();
    });

    test('should show error when redirectToAccountSelection is missing', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login">
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByText(/Configuration error: redirectToAccountSelection is required/)).toBeInTheDocument();
    });
  });

  describe('Loading States', () => {
    test('should show loading spinner during session load', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: true, // Session initializing
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login">
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByText('Initializing...')).toBeInTheDocument();
    });

    test('should show loading during session loading', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: true,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login">
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('should show loading during account switching', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          switchingAccount={{
            loading: true,
            error: null,
          }}
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByText('Switching account...')).toBeInTheDocument();
    });

    test('should use custom loading component', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: true,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          loadingComponent={CustomLoadingComponent}
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
      expect(screen.getByText('Custom Loading: Initializing session')).toBeInTheDocument();
    });
  });

  describe('Error States', () => {
    test('should show error display on session error', () => {
      mockUseSession.mockReturnValue({
        error: 'Session failed to load',
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login">
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByText('Session failed to load')).toBeInTheDocument();
    });

    test('should show error on account switching error', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          switchingAccount={{
            loading: false,
            error: 'Failed to switch account',
          }}
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByText('Failed to switch account')).toBeInTheDocument();
    });

    test('should use custom error component', () => {
      mockUseSession.mockReturnValue({
        error: 'Custom session error',
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          errorComponent={CustomErrorComponent}
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('custom-error')).toBeInTheDocument();
      expect(screen.getByText('Custom Error: Custom session error')).toBeInTheDocument();
    });

    test('should provide retry function to error component', () => {
      mockUseSession.mockReturnValue({
        error: 'Session error',
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      const ErrorWithRetry = ({ error, retry }: { error: string; retry?: () => void }) => (
        <div>
          <span>{error}</span>
          {retry && (
            <button onClick={retry} data-testid="retry-button">
              Retry
            </button>
          )}
        </div>
      );

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login" errorComponent={ErrorWithRetry}>
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('retry-button')).toBeInTheDocument();
    });
  });

  describe('Redirects', () => {
    test('should redirect with custom component', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectingComponent={CustomRedirectComponent}
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('custom-redirect')).toBeInTheDocument();
      expect(screen.getByText('Redirecting to: /login')).toBeInTheDocument();
    });

    test('should use window.location for redirects', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login">
          <TestChildren />
        </AuthGuard>,
      );

      expect(mockLocation.href).toBe('/login');
    });

    test('should apply proxy URLs to redirect URLs', () => {
      mockUseConfig.mockReturnValue({
        sdkConfig: {
          backendUrl: 'https://api.example.com',
          frontendProxyUrl: '/app',
        },
      });

      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login">
          <TestChildren />
        </AuthGuard>,
      );

      expect(mockLocation.href).toBe('/app/login');
    });

    test('should handle redirect delays', () => {
      vi.useFakeTimers();

      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectDelay={1000}
          redirectingComponent={CustomRedirectComponent}
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('custom-redirect')).toBeInTheDocument();

      vi.useRealTimers();
    });
  });

  describe('Children Handling', () => {
    test('should render children correctly', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/select-account"
        >
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('test-children')).toBeInTheDocument();
    });

    test('should handle empty children', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/select-account"
        />,
      );

      // Should not render anything when no children and user is authenticated
      expect(screen.queryByTestId('test-children')).not.toBeInTheDocument();
    });

    test('should handle redirect-only pages', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/select-account"
          redirectOnAuthenticated="/dashboard"
        />,
      );

      expect(mockLocation.href).toBe('/dashboard');
    });

    test('should handle multiple children', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/select-account"
        >
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </AuthGuard>,
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    test('should handle null children', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/select-account"
        >
          {null}
        </AuthGuard>,
      );

      // Should handle null children gracefully
      expect(screen.queryByTestId('test-children')).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('should handle unexpected state', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: undefined,
        hasAccount: undefined,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true}>
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByText(/AuthGuard reached an unexpected state/)).toBeInTheDocument();
    });

    test('should handle custom global error component', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: undefined,
        hasAccount: undefined,
        isIdle: false,
        isLoading: false,
      } as any);

      const CustomGlobalError = ({ error }: { error: string }) => (
        <div data-testid="custom-global-error">Global: {error}</div>
      );

      render(
        <AuthGuard allowGuests={false} requireAccount={true} globalErrorComponent={CustomGlobalError}>
          <TestChildren />
        </AuthGuard>,
      );

      expect(screen.getByTestId('custom-global-error')).toBeInTheDocument();
    });

    test('should handle browser environment check', () => {
      // Mock typeof window === 'undefined'
      const originalWindow = global.window;
      // @ts-expect-error - Testing server-side rendering
      delete global.window;

      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      } as any);

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login">
          <TestChildren />
        </AuthGuard>,
      );

      // Should handle server-side rendering gracefully
      expect(screen.getByText('Redirecting to login...')).toBeInTheDocument();

      // Restore window
      global.window = originalWindow;
    });
  });
});
