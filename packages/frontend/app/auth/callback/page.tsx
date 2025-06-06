"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@accountsystem/auth-react-sdk"
import { useToast } from "@/components/ui/use-toast"
import { getEnvironmentConfig } from "@/lib/utils"

export default function AuthCallbackPage() {
    const router = useRouter()
    const { toast } = useToast()
    const { handleOAuthCallback } = useAuth()
    const config = getEnvironmentConfig()

    const handleCallback = async () => {
        try {
            // Get all URL parameters from current page
            const params = new URLSearchParams(window.location.search)

            // Check for error parameter
            const error = params.get('error')
            if (error) {
                throw new Error(`OAuth error: ${error}`)
            }

            // Check for required parameters
            const state = params.get('state')
            const code = params.get('code')

            if (!state || !code) {
                throw new Error('Missing required OAuth parameters')
            }

            // Handle the OAuth callback using the auth context method
            await handleOAuthCallback(params)

            // Success toast
            toast({
                title: "Sign in successful!",
                description: "Welcome back to your account.",
                variant: "success",
            })

            // Redirect to configured home URL or default dashboard
            const redirectUrl = config.homeUrl || "/dashboard"
            router.replace(redirectUrl)

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error('OAuth callback error:', error)

            toast({
                title: "Sign in failed",
                description: error.message || "There was a problem signing you in.",
                variant: "destructive",
            })

            // Redirect to login on error
            router.replace("/login")
        }
    };

    useEffect(() => {
        // Only handle callback if we have URL parameters
        const params = new URLSearchParams(window.location.search)
        if (params.has('state') || params.has('code')) {
            handleCallback()
        } else {
            // No parameters, redirect to login
            router.replace("/login")
        }
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="space-y-2">
                    <h2 className="text-lg font-semibold">Processing sign in...</h2>
                    <p className="text-sm text-muted-foreground">
                        Please wait while we complete your authentication.
                    </p>
                </div>
            </div>
        </div>
    )
}