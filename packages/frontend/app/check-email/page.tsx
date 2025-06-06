"use client"

import * as React from "react"
import Link from "next/link"
import { Mail, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { AuthLayout } from "@/components/layout/auth-layout"
import { getEnvironmentConfig } from "@/lib/utils"

export default function CheckEmailPage() {
    const { toast } = useToast()
    const config = getEnvironmentConfig()

    const handleResend = () => {
        // Note: In a real implementation, you'd need to store the email
        // or get it from URL params to resend verification
        toast({
            title: "Feature not available",
            description: "Please sign up again to receive a new verification email.",
            variant: "destructive",
        })
    }

    return (
        <AuthLayout
            title="Check your email"
            description="We've sent you a verification link"
            showBackToHome={!!config.homeUrl}
        >
            <div className="space-y-6">
                {/* Success Icon */}
                <div className="text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <Mail className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold">Verify your email address</h3>
                        <p className="text-muted-foreground">
                            We've sent a verification link to your email address.
                            Click the link to activate your account and complete the signup process.
                        </p>
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-muted/50 rounded-lg p-6 space-y-3">
                    <h4 className="font-medium">What to do next:</h4>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                        <li>Check your email inbox (and spam/junk folder)</li>
                        <li>Find the email from {config.appName}</li>
                        <li>Click the "Verify Email Address" button in the email</li>
                        <li>You'll be redirected to sign in to your account</li>
                    </ol>
                </div>

                {/* Security Notice */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                        <div className="w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center mt-0.5">
                            <span className="text-yellow-800 text-xs font-bold">!</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                Important Security Notice
                            </p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                The verification link will expire in 24 hours for security reasons.
                                If you don't verify within this time, you'll need to sign up again.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleResend}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Resend verification email
                    </Button>

                    <div className="text-center text-sm text-muted-foreground">
                        Already verified?{" "}
                        <Link href="/login" className="text-primary hover:underline font-medium">
                            Sign in to your account
                        </Link>
                    </div>
                </div>

                {/* Help */}
                <div className="text-center">
                    <p className="text-xs text-muted-foreground">
                        Didn't receive the email?{" "}
                        {config.supportEmail ? (
                            <Link
                                href={`mailto:${config.supportEmail}`}
                                className="text-primary hover:underline"
                            >
                                Contact support
                            </Link>
                        ) : (
                            <span className="text-primary">Contact support</span>
                        )}
                    </p>
                </div>
            </div>
        </AuthLayout>
    )
}