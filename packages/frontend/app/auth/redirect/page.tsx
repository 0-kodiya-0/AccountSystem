"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"

export default function AuthRedirect() {
    const router = useRouter()
    const { isAuthenticated, hasActiveAccounts, currentAccount, isLoading } = useAuth()
    const config = getEnvironmentConfig()

    useEffect(() => {
        if (isLoading) return // Wait for auth state to load

        if (isAuthenticated && hasActiveAccounts() && currentAccount) {
            // User is authenticated, redirect to home
            const redirectUrl = config.homeUrl || "/dashboard"
            router.replace(redirectUrl)
        } else if (hasActiveAccounts()) {
            // User has accounts but none currently active, go to account selection
            router.replace("/accounts")
        } else {
            // No authentication, redirect to login
            router.replace("/login")
        }
    }, [isAuthenticated, hasActiveAccounts, currentAccount, isLoading, router, config.homeUrl])

    // Show loading spinner while redirecting
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground">Redirecting...</p>
            </div>
        </div>
    )
}