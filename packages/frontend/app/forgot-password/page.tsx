"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Mail } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { AuthLayout } from "@/components/layout/auth-layout"
import { useLocalAuth } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"

const forgotPasswordSchema = z.object({
    email: z.string().email("Please enter a valid email address"),
})

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>

export default function ForgotPasswordPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [isSubmitted, setIsSubmitted] = useState(false)

    const { requestPasswordReset, isAuthenticating } = useLocalAuth()
    const config = getEnvironmentConfig()

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        getValues,
    } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
    })

    const onSubmit = async (data: ForgotPasswordFormData) => {
        try {
            await requestPasswordReset(data.email)
            setIsSubmitted(true)

            toast({
                title: "Reset link sent!",
                description: "Check your email for password reset instructions.",
                variant: "success",
            })

        } catch (error: any) {
            toast({
                title: "Failed to send reset email",
                description: error.message || "Please try again later.",
                variant: "destructive",
            })
        }
    }

    const handleResend = async () => {
        const email = getValues("email")
        if (email) {
            await onSubmit({ email })
        }
    }

    if (isSubmitted) {
        return (
            <AuthLayout
                title="Check your email"
                description="We've sent password reset instructions to your email"
            >
                <div className="space-y-6">
                    {/* Success Icon */}
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <Mail className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Password reset email sent</h3>
                            <p className="text-sm text-muted-foreground">
                                We've sent a password reset link to <strong>{getValues("email")}</strong>.
                                Click the link in the email to reset your password.
                            </p>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <h4 className="text-sm font-medium">What to do next:</h4>
                        <ul className="text-sm text-muted-foreground space-y-1">
                            <li>• Check your email inbox (and spam folder)</li>
                            <li>• Click the reset link in the email</li>
                            <li>• Create a new password</li>
                            <li>• Sign in with your new password</li>
                        </ul>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={handleResend}
                            disabled={isSubmitting || isAuthenticating}
                            loading={isSubmitting || isAuthenticating}
                        >
                            Resend email
                        </Button>

                        <div className="text-center">
                            <Link href="/login">
                                <Button variant="ghost" className="text-sm">
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Back to sign in
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </AuthLayout>
        )
    }

    return (
        <AuthLayout
            title="Forgot your password?"
            description="Enter your email address and we'll send you a reset link"
            showBackToHome={!!config.homeUrl}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Email Field */}
                <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="Enter your email address"
                        error={!!errors.email}
                        disabled={isSubmitting || isAuthenticating}
                        {...register("email")}
                        autoComplete="email"
                    />
                    {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                        We'll send reset instructions to this email address
                    </p>
                </div>

                {/* Submit Button */}
                <Button
                    type="submit"
                    className="w-full"
                    loading={isSubmitting || isAuthenticating}
                    disabled={isSubmitting || isAuthenticating}
                >
                    Send reset email
                </Button>
            </form>

            {/* Back to login */}
            <div className="text-center">
                <Link href="/login">
                    <Button variant="ghost" className="text-sm">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to sign in
                    </Button>
                </Link>
            </div>
        </AuthLayout>
    )
}