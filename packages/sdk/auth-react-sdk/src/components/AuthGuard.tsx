import React, { JSX } from 'react';
import { AuthGuardOptions, useAuthGuard } from '../hooks/useAuthGuard';
import { AuthGuardDecision } from '../types';

interface AuthGuardProps extends AuthGuardOptions {
    children: React.ReactNode;

    // Customizable UI components
    loadingComponent?: React.ComponentType<{ reason?: string }>;
    redirectingComponent?: React.ComponentType<{
        destination?: string;
        reason?: string;
        decision: AuthGuardDecision;
    }>;
    errorComponent?: React.ComponentType<{
        error: string;
        retry?: () => void;
    }>;

    // Fallback component for any non-content state
    fallback?: React.ReactNode;
}

// Change from React.FC to regular function component
export function AuthGuard({
    children,
    loadingComponent: LoadingComponent,
    redirectingComponent: RedirectingComponent,
    errorComponent: ErrorComponent,
    fallback,
    ...authGuardOptions
}: AuthGuardProps): JSX.Element | null {
    const {
        decision,
        redirectDestination,
        redirectReason
    } = useAuthGuard(authGuardOptions);

    // Show content if auth checks passed
    if (decision === AuthGuardDecision.SHOW_CONTENT) {
        return <>{children}</>;
    }

    // Show loading state
    if (decision === AuthGuardDecision.LOADING) {
        if (LoadingComponent) {
            return <LoadingComponent reason={redirectReason} />;
        }

        if (fallback) {
            return <>{fallback}</>;
        }

        // Default loading UI
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    border: '2px solid #e2e8f0',
                    borderTop: '2px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
                <p style={{ color: '#64748b', fontSize: '14px' }}>
                    {redirectReason || 'Loading...'}
                </p>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // Show redirecting state
    if (decision === AuthGuardDecision.REDIRECT_TO_LOGIN ||
        decision === AuthGuardDecision.REDIRECT_TO_ACCOUNTS ||
        decision === AuthGuardDecision.REDIRECT_CUSTOM) {

        if (RedirectingComponent) {
            return (
                <RedirectingComponent
                    destination={redirectDestination}
                    reason={redirectReason}
                    decision={decision}
                />
            );
        }

        if (fallback) {
            return <>{fallback}</>;
        }

        // Default redirecting UI
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px',
                flexDirection: 'column',
                gap: '16px'
            }}>
                <div style={{
                    width: '32px',
                    height: '32px',
                    border: '2px solid #e2e8f0',
                    borderTop: '2px solid #3b82f6',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
                <p style={{ color: '#64748b', fontSize: '14px' }}>
                    {redirectReason || 'Redirecting...'}
                </p>
                <style>{`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    // Fallback for unknown states
    if (ErrorComponent) {
        return (
            <ErrorComponent
                error={`Unknown auth state: ${decision}`}
            />
        );
    } else {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '200px',
                padding: '32px',
                textAlign: 'center'
            }}>
                <p style={{
                    margin: '0',
                    fontSize: '14px',
                    color: '#dc2626',
                    lineHeight: '1.5'
                }}>
                    {decision}
                </p>
            </div>
        );
    }

    return fallback ? <>{fallback}</> : null;
}