"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthCallbackHandler } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"
import { CheckCircle, XCircle, AlertCircle } from "lucide-react"

type StatusType = 'processing' | 'success' | 'error' | 'redirecting'

interface StatusState {
    type: StatusType
    title: string
    message: string
    redirectIn?: number
}

export default function AuthCallbackPage() {
    const router = useRouter()
    const config = getEnvironmentConfig()

    const [status, setStatus] = useState<StatusState>({
        type: 'processing',
        title: 'Processing authentication...',
        message: 'Please wait while we complete your request.'
    })

    const [countdown, setCountdown] = useState<number>(0)

    // Countdown effect for redirects
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
            return () => clearTimeout(timer)
        }
    }, [countdown])

    const redirectWithCountdown = (url: string, delay: number = 3) => {
        setCountdown(delay)
        setTimeout(() => {
            router.replace(url)
        }, delay * 1000)
    }

    // Use the callback handler hook with custom overrides and disabled defaults
    const { handleAuthCallback } = useAuthCallbackHandler({
        // Disable default handlers since we're providing custom implementations
        disableDefaultHandlers: false,

        // OAuth success handlers with UI updates
        onOAuthSigninSuccess: async ({ name }) => {
            console.log("OAuth signin success:", name)
            setStatus({
                type: 'success',
                title: 'Sign in successful!',
                message: `Welcome back, ${name}! Redirecting to your dashboard...`
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 2)
        },

        onOAuthSignupSuccess: async ({ name }) => {
            console.log("OAuth signup success:", name)
            setStatus({
                type: 'success',
                title: 'Account created successfully!',
                message: `Welcome to our platform, ${name}! Redirecting to your dashboard...`
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 2)
        },

        onOAuthPermissionSuccess: async ({ service, scopeLevel }) => {
            console.log("OAuth permission success:", service, scopeLevel)
            setStatus({
                type: 'success',
                title: 'Permissions granted!',
                message: `Successfully granted ${service} ${scopeLevel} permissions. Redirecting...`
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 2)
        },

        // Local auth success handlers
        onLocalSigninSuccess: async ({ name }) => {
            console.log("Local signin success:", name)
            setStatus({
                type: 'success',
                title: 'Sign in successful!',
                message: `Welcome back, ${name}! Redirecting to your dashboard...`
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 2)
        },

        onLocalSignupSuccess: async ({ message }) => {
            console.log("Local signup success:", message)
            setStatus({
                type: 'success',
                title: 'Account created!',
                message: message || "Account created successfully. Redirecting to sign in..."
            })
            redirectWithCountdown("/login", 2)
        },

        onLocal2FARequired: async ({ tempToken }) => {
            console.log("2FA required:", tempToken)
            setStatus({
                type: 'redirecting',
                title: 'Two-factor authentication required',
                message: 'Redirecting to verification page...'
            })
            redirectWithCountdown(`/two-factor-verify?tempToken=${tempToken}`, 1)
        },

        onLocalEmailVerified: async ({ message }) => {
            console.log("Email verified:", message)
            setStatus({
                type: 'success',
                title: 'Email verified!',
                message: message || "Email verified successfully. You can now sign in."
            })
            redirectWithCountdown("/login", 2)
        },

        onLocalPasswordResetSuccess: async ({ message }) => {
            console.log("Password reset success:", message)
            setStatus({
                type: 'success',
                title: 'Password reset successful!',
                message: message || "Password reset successfully. You can now sign in."
            })
            redirectWithCountdown("/login", 2)
        },

        // Logout success handlers
        onLogoutSuccess: async ({ accountId, message }) => {
            console.log("Logout success:", accountId, message)
            setStatus({
                type: 'success',
                title: 'Logged out successfully',
                message: message || "You have been logged out successfully."
            })
            redirectWithCountdown("/accounts", 2)
        },

        onLogoutAllSuccess: async ({ accountIds, message }) => {
            console.log("Logout all success:", accountIds, message)
            setStatus({
                type: 'success',
                title: 'All accounts logged out',
                message: message || "All accounts have been logged out successfully."
            })
            redirectWithCountdown("/login", 2)
        },

        // Error handlers with UI updates
        onOAuthError: async ({ error }) => {
            console.error("OAuth error:", error)
            setStatus({
                type: 'error',
                title: 'OAuth authentication failed',
                message: error || "OAuth authentication failed. Please try again."
            })
            redirectWithCountdown("/login", 4)
        },

        onLocalAuthError: async ({ error }) => {
            console.error("Local auth error:", error)
            setStatus({
                type: 'error',
                title: 'Authentication failed',
                message: error || "Authentication failed. Please try again."
            })
            redirectWithCountdown("/login", 4)
        },

        onPermissionError: async ({ error }) => {
            console.error("Permission error:", error)
            setStatus({
                type: 'error',
                title: 'Permission request failed',
                message: error || "Permission request failed. Returning to dashboard."
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 4)
        },

        onUserNotFound: async () => {
            console.log("User not found")
            setStatus({
                type: 'error',
                title: 'Account not found',
                message: 'Please sign up for an account first.'
            })
            redirectWithCountdown("/signup", 3)
        },

        onUserExists: async () => {
            console.log("User exists")
            setStatus({
                type: 'error',
                title: 'Account already exists',
                message: 'Please sign in to your existing account.'
            })
            redirectWithCountdown("/login", 3)
        },

        onTokenExpired: async () => {
            console.log("Token expired")
            setStatus({
                type: 'error',
                title: 'Session expired',
                message: 'Your session has expired. Please sign in again.'
            })
            redirectWithCountdown("/login", 3)
        },

        // Special flow handlers
        onPermissionReauthorize: async ({ accountId }) => {
            console.log("Permission reauthorize:", accountId)
            setStatus({
                type: 'redirecting',
                title: 'Additional permissions needed',
                message: 'Redirecting to grant additional permissions...'
            })
            // The hook will handle the actual reauthorization call
            // We just need to show the UI feedback
            setTimeout(() => {
                // The hook already called client.reauthorizePermissions(accountId)
                // which will redirect to Google, so this timeout is just for UI
                setStatus({
                    type: 'processing',
                    title: 'Redirecting to Google...',
                    message: 'Please wait while we redirect you to grant permissions.'
                })
            }, 1000)
        },

        // Generic error handler
        onError: async (data) => {
            console.error('Callback error:', data)
            setStatus({
                type: 'error',
                title: 'Authentication failed',
                message: data.error || "There was a problem processing your authentication."
            })
            redirectWithCountdown("/login", 4)
        },

        // Unknown code handler
        onUnknownCode: async (data) => {
            console.warn('Unknown callback code:', data)
            setStatus({
                type: 'error',
                title: 'Unknown response',
                message: 'Received an unknown response from authentication.'
            })
            redirectWithCountdown("/login", 4)
        }
    })

    const handleCallback = async () => {
        try {
            // Get all URL parameters from current page
            const params = new URLSearchParams(window.location.search)

            // Check if we have a callback code
            const code = params.get('code')
            if (!code) {
                throw new Error('No callback code found')
            }

            console.log("Starting handleAuthCallback...")
            await handleAuthCallback(params)
            console.log("handleAuthCallback completed")

        } catch (error: any) {
            console.error('Auth callback error:', error)
            setStatus({
                type: 'error',
                title: 'Authentication failed',
                message: error.message || "There was a problem processing your authentication."
            })
            redirectWithCountdown("/login", 4)
        }
    }

    useEffect(() => {
        // Only handle callback if we have URL parameters
        const params = new URLSearchParams(window.location.search)
        if (params.has('code')) {
            console.log('Callback params:', params)
            // Add small delay to ensure component is fully mounted
            handleCallback()
        } else {
            // No callback code, redirect to login
            setStatus({
                type: 'error',
                title: 'Invalid callback',
                message: 'No authentication code found in the URL.'
            })
            redirectWithCountdown("/login", 3)
        }
    }, [])

    const getStatusIcon = () => {
        switch (status.type) {
            case 'success':
                return <CheckCircle className="w-16 h-16 md:w-20 md:h-20 text-green-500" />
            case 'error':
                return <XCircle className="w-16 h-16 md:w-20 md:h-20 text-red-500" />
            case 'redirecting':
                return <AlertCircle className="w-16 h-16 md:w-20 md:h-20 text-blue-500" />
            default:
                return <div className="w-16 h-16 md:w-20 md:h-20 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        }
    }

    const getStatusColor = () => {
        switch (status.type) {
            case 'success':
                return 'text-green-700'
            case 'error':
                return 'text-red-700'
            case 'redirecting':
                return 'text-blue-700'
            default:
                return 'text-gray-700'
        }
    }

    return (
        <div className="auth-container">
            <div className="auth-form-container text-center">
                <div className="auth-card p-8 space-y-6">
                    {/* Status Icon */}
                    <div className="flex justify-center">
                        {getStatusIcon()}
                    </div>

                    {/* Status Content */}
                    <div className="space-y-3">
                        <h2 className={`text-xl font-semibold ${getStatusColor()}`}>
                            {status.title}
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {status.message}
                        </p>
                    </div>

                    {/* Countdown - Just time display */}
                    {countdown > 0 && (
                        <div className="pt-4">
                            <div className="inline-flex items-center justify-center">
                                <p className="text-sm font-medium text-muted-foreground">
                                    Redirecting in {countdown} second{countdown !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Manual redirect link for errors */}
                    {status.type === 'error' && (
                        <div className="pt-4">
                            <button
                                onClick={() => router.push("/login")}
                                className="text-sm text-primary hover:underline transition-colors duration-200"
                            >
                                Click here if you&apos;re not redirected automatically
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}