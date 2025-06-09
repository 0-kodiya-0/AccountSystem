"use client"

import { useAuthRedirectHandler, RedirectCode } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"

export default function AuthRedirect() {
    const config = getEnvironmentConfig()

    // Use the auth redirect handler with minimal configuration
    // All redirect logic is handled by the SDK's default handlers
    const { redirectCode } = useAuthRedirectHandler({
        defaultHomeUrl: config.homeUrl || "/dashboard",
        defaultLoginUrl: "/login",
        defaultAccountsUrl: "/accounts",
        autoRedirect: true,
        disableDefaultHandlers: false
    })

    // Get user-friendly message based on redirect code
    const getStatusMessage = (code: RedirectCode | null): string => {
        switch (code) {
            case RedirectCode.LOADING_AUTH_STATE:
                return "Loading authentication state..."
            case RedirectCode.LOADING_ACCOUNT_DATA:
                return "Loading account data..."
            default:
                return "Redirecting..."
        }
    }

    // Show loading spinner while determining redirect
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">
                    {getStatusMessage(redirectCode)}
                </p>
            </div>
        </div>
    )
}