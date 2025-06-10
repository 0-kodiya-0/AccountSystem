"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthCallbackHandler } from "../../../../sdk/auth-react-sdk/src"
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

    // Use the callback handler hook with custom overrides
    const { handleAuthCallback } = useAuthCallbackHandler({
        // OAuth success handlers with UI updates
        onOAuthSigninSuccess: async (data) => {
            console.log("OAuth signin success:", data.name)
            setStatus({
                type: 'success',
                title: 'Sign in successful!',
                message: `Welcome back, ${data.name}! Redirecting to your dashboard...`
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 2)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onOAuthSignupSuccess: async (data) => {
            console.log("OAuth signup success:", data.name)
            setStatus({
                type: 'success',
                title: 'Account created successfully!',
                message: `Welcome to our platform, ${data.name}! Redirecting to your dashboard...`
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 2)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onOAuthPermissionSuccess: async (data) => {
            console.log("OAuth permission success:", data.service, data.scopeLevel)
            setStatus({
                type: 'success',
                title: 'Permissions granted!',
                message: `Successfully granted ${data.service} ${data.scopeLevel} permissions. Redirecting...`
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 2)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        // Local auth success handlers
        onLocalSigninSuccess: async (data) => {
            console.log("Local signin success:", data.name)
            setStatus({
                type: 'success',
                title: 'Sign in successful!',
                message: `Welcome back, ${data.name}! Redirecting to your dashboard...`
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 2)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onLocalSignupSuccess: async (data) => {
            console.log("Local signup success:", data.message)
            setStatus({
                type: 'success',
                title: 'Account created!',
                message: data.message || "Account created successfully. Redirecting to sign in..."
            })
            redirectWithCountdown("/login", 2)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onLocal2FARequired: async (data) => {
            console.log("2FA required:", data.tempToken)
            setStatus({
                type: 'redirecting',
                title: 'Two-factor authentication required',
                message: 'Redirecting to verification page...'
            })
            redirectWithCountdown(`/two-factor-verify?tempToken=${data.tempToken}`, 1)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onLocalEmailVerified: async (data) => {
            console.log("Email verified:", data.message)
            setStatus({
                type: 'success',
                title: 'Email verified!',
                message: data.message || "Email verified successfully. You can now sign in."
            })
            redirectWithCountdown("/login", 2)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onLocalPasswordResetSuccess: async (data) => {
            console.log("Password reset success:", data.message)
            setStatus({
                type: 'success',
                title: 'Password reset successful!',
                message: data.message || "Password reset successfully. You can now sign in."
            })
            redirectWithCountdown("/login", 2)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        // Logout success handlers
        onLogoutSuccess: async (data) => {
            console.log("Logout success:", data.accountId, data.message)
            setStatus({
                type: 'success',
                title: 'Logged out successfully',
                message: data.message || "You have been logged out successfully."
            })
            redirectWithCountdown("/accounts", 2)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onLogoutAllSuccess: async (data) => {
            console.log("Logout all success:", data.accountIds, data.message)
            setStatus({
                type: 'success',
                title: 'All accounts logged out',
                message: data.message || "All accounts have been logged out successfully."
            })
            redirectWithCountdown("/login", 2)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        // Error handlers with UI updates
        onOAuthError: async (data) => {
            console.error("OAuth error:", data.error)
            setStatus({
                type: 'error',
                title: 'OAuth authentication failed',
                message: data.error || "OAuth authentication failed. Please try again."
            })
            redirectWithCountdown("/login", 4)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onLocalAuthError: async (data) => {
            console.error("Local auth error:", data.error)
            setStatus({
                type: 'error',
                title: 'Authentication failed',
                message: data.error || "Authentication failed. Please try again."
            })
            redirectWithCountdown("/login", 4)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onPermissionError: async (data) => {
            console.error("Permission error:", data.error)
            setStatus({
                type: 'error',
                title: 'Permission request failed',
                message: data.error || "Permission request failed. Returning to dashboard."
            })
            redirectWithCountdown(config.homeUrl || "/dashboard", 4)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onUserNotFound: async () => {
            console.log("User not found")
            setStatus({
                type: 'error',
                title: 'Account not found',
                message: 'Please sign up for an account first.'
            })
            redirectWithCountdown("/signup", 3)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onUserExists: async () => {
            console.log("User exists")
            setStatus({
                type: 'error',
                title: 'Account already exists',
                message: 'Please sign in to your existing account.'
            })
            redirectWithCountdown("/login", 3)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        onTokenExpired: async () => {
            console.log("Token expired")
            setStatus({
                type: 'error',
                title: 'Session expired',
                message: 'Your session has expired. Please sign in again.'
            })
            redirectWithCountdown("/login", 3)
            
            // Don't call defaultHandler since we're handling redirect ourselves
        },

        // Special flow handlers
        onPermissionReauthorize: async (data, defaultHandler) => {
            console.log("Permission reauthorize:", data.accountId)
            setStatus({
                type: 'redirecting',
                title: 'Additional permissions needed',
                message: 'Redirecting to grant additional permissions...'
            })
            
            // Use default handler for this special case since it involves complex logic
            await defaultHandler()
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
            
            // Don't call defaultHandler since we're handling redirect ourselves
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