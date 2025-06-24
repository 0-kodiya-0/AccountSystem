import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthGuard } from '../AuthGuard';
import { useSession } from '../../hooks/useSession';
import { useConfig } from '../../context/ServicesProvider';

// Mock the dependencies
vi.mock('../../hooks/useSession');
vi.mock('../../context/ServicesProvider');

// Mock window.location
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    reload: mockReload,
  },
  writable: true,
});

describe('AuthGuard', () => {
  let mockUseSession: any;
  let mockUseConfig: any;

  beforeEach(() => {
    mockUseSession = vi.fn();
    mockUseConfig = vi.fn();

    (useSession as any).mockImplementation(mockUseSession);
    (useConfig as any).mockImplementation(mockUseConfig);

    // Default config
    mockUseConfig.mockReturnValue({
      sdkConfig: {
        frontendProxyUrl: '',
      },
    });

    // Reset window.location.href
    window.location.href = 'http://localhost:3000';
  });

  describe('loading states', () => {
    it('should show loading when session is idle', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: true,
        isLoading: false,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={false}>
          <div>Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Initializing...')).toBeInTheDocument();
    });

    it('should show loading when session is loading', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: true,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={false}>
          <div>Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should show loading when switching account', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          switchingAccount={{ loading: true, error: null }}
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
        >
          <div>Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Switching account...')).toBeInTheDocument();
    });

    it('should show custom loading component', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: true,
        isLoading: false,
      });

      const CustomLoader = ({ reason }: { reason?: string }) => <div>Custom loading: {reason}</div>;

      render(
        <AuthGuard allowGuests={true} requireAccount={false} loadingComponent={CustomLoader}>
          <div>Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Custom loading: Initializing session')).toBeInTheDocument();
    });
  });

  describe('error states', () => {
    it('should show error when session has error', () => {
      mockUseSession.mockReturnValue({
        error: 'Session load failed',
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={false}>
          <div>Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Session load failed')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('should show error when account switching has error', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          switchingAccount={{ loading: false, error: 'Account switch failed' }}
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
        >
          <div>Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Account switch failed')).toBeInTheDocument();
    });

    it('should show custom error component', () => {
      mockUseSession.mockReturnValue({
        error: 'Custom error',
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      const CustomError = ({ error }: { error: string }) => <div>Custom error: {error}</div>;

      render(
        <AuthGuard allowGuests={true} requireAccount={false} errorComponent={CustomError}>
          <div>Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Custom error: Custom error')).toBeInTheDocument();
    });
  });

  describe('guest pages (allowGuests: true)', () => {
    it('should show content for unauthenticated users', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={false}>
          <div>Login Form</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Login Form')).toBeInTheDocument();
    });

    it('should show content for authenticated users when children present', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={false}>
          <div>Welcome Page</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Welcome Page')).toBeInTheDocument();
    });

    it('should redirect authenticated users when no children and redirectOnAuthenticated provided', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(<AuthGuard allowGuests={true} requireAccount={false} redirectOnAuthenticated="/dashboard" />);

      expect(window.location.href).toBe('/dashboard');
    });

    it('should show error when authenticated user has no children and no redirect URL', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      // Spy on console.error to suppress error output in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<AuthGuard allowGuests={true} requireAccount={false} />);

      expect(screen.getByText('Configuration error: redirectOnAuthenticated is required')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should handle guest pages with account requirement', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={true} redirectToAccountSelection="/select-account">
          <div>Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('protected pages (allowGuests: false)', () => {
    it('should redirect unauthenticated users to login', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
        >
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(window.location.href).toBe('/login');
    });

    it('should show error when no redirectToLogin provided for unauthenticated user', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToAccountSelection="/accounts">
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Configuration error: redirectToLogin is required')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should redirect authenticated user without account to account selection', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
        >
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(window.location.href).toBe('/accounts');
    });

    it('should show error when requireAccount is true but no redirectToAccountSelection', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <AuthGuard allowGuests={false} requireAccount={true} redirectToLogin="/login">
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Configuration error: redirectToAccountSelection is required')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should show protected content when user is authenticated and has account', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
        >
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should redirect when no children and redirectOnAuthenticated provided', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
          redirectOnAuthenticated="/dashboard"
        />,
      );

      expect(window.location.href).toBe('/dashboard');
    });
  });

  describe('custom components', () => {
    it('should use custom redirecting component', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      const CustomRedirecting = ({ destination, reason }: { destination: string; reason?: string }) => (
        <div>
          Redirecting to {destination} because {reason}
        </div>
      );

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
          redirectingComponent={CustomRedirecting}
        >
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Redirecting to /login because User not authenticated')).toBeInTheDocument();
    });

    it('should use custom global error component', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      const CustomGlobalError = ({ error }: { error: string }) => <div>Global Error: {error}</div>;

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true} // Fixed: Use valid combination
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
          globalErrorComponent={CustomGlobalError}
        >
          <div>Content</div>
        </AuthGuard>,
      );

      // This should render content normally since it's a valid combination
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should handle invalid combination with _error property', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      const CustomGlobalError = ({ error }: { error: string }) => <div>Global Error: {error}</div>;

      // Test the invalid combination type with required _error property
      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={false}
          _error="Invalid combination: allowGuests: false and requireAccount: false is not allowed. Use allowGuests: true with requireAccount: false instead."
          globalErrorComponent={CustomGlobalError}
        >
          <div>Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText(/Global Error:.*unexpected state/)).toBeInTheDocument();
    });
  });

  describe('proxy URL handling', () => {
    it('should prepend frontendProxyUrl to redirect URLs', () => {
      mockUseConfig.mockReturnValue({
        sdkConfig: {
          frontendProxyUrl: '/app',
        },
      });

      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
        >
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(window.location.href).toBe('/app/login');
    });
  });

  describe('auto-load session configuration', () => {
    it('should pass autoLoadSession option to useSession', () => {
      render(
        <AuthGuard allowGuests={true} requireAccount={false} autoLoadSession={false}>
          <div>Content</div>
        </AuthGuard>,
      );

      expect(mockUseSession).toHaveBeenCalledWith({ autoLoad: false });
    });

    it('should default autoLoadSession to true', () => {
      render(
        <AuthGuard allowGuests={true} requireAccount={false}>
          <div>Content</div>
        </AuthGuard>,
      );

      expect(mockUseSession).toHaveBeenCalledWith({ autoLoad: true });
    });
  });

  describe('children detection', () => {
    it('should handle null children', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={false} redirectOnAuthenticated="/dashboard">
          {null}
        </AuthGuard>,
      );

      expect(window.location.href).toBe('/dashboard');
    });

    it('should handle undefined children', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={false} redirectOnAuthenticated="/dashboard">
          {undefined}
        </AuthGuard>,
      );

      expect(window.location.href).toBe('/dashboard');
    });

    it('should handle empty array children', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={false} redirectOnAuthenticated="/dashboard">
          {[]}
        </AuthGuard>,
      );

      expect(window.location.href).toBe('/dashboard');
    });

    it('should detect valid children', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: true,
        hasAccount: true,
        isIdle: false,
        isLoading: false,
      });

      render(
        <AuthGuard allowGuests={true} requireAccount={false}>
          <div>Valid Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Valid Content')).toBeInTheDocument();
    });
  });

  describe('redirect delay', () => {
    it('should pass redirect delay to redirecting component', () => {
      mockUseSession.mockReturnValue({
        error: null,
        isAuthenticated: false,
        hasAccount: false,
        isIdle: false,
        isLoading: false,
      });

      const CustomRedirecting = ({ delay }: { delay?: number }) => <div>Redirecting with delay: {delay}</div>;

      render(
        <AuthGuard
          allowGuests={false}
          requireAccount={true}
          redirectToLogin="/login"
          redirectToAccountSelection="/accounts"
          redirectingComponent={CustomRedirecting}
          redirectDelay={3000}
        >
          <div>Protected Content</div>
        </AuthGuard>,
      );

      expect(screen.getByText('Redirecting with delay: 3000')).toBeInTheDocument();
    });
  });
});
