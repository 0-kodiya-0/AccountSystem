"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, CheckCircle, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthLayout } from "@/components/layout/auth-layout"
import { PasswordStrengthIndicator } from "@/components/auth/password-strength-indicator"
import { usePasswordReset, PasswordResetStatus } from "../../../sdk/auth-react-sdk/src"
import { validatePasswordStrength } from "@/lib/utils"

const resetPasswordSchema = z.object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>

export default function ResetPasswordPage() {
    const searchParams = useSearchParams()
    const token = searchParams.get("token")
    
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const {
        status,
        message,
        error,
        isLoading,
        resetPassword,
        redirect
    } = usePasswordReset({
        redirectAfterReset: "/login",
        redirectDelay: 3000,
        onResetSuccess: (message) => {
            console.log("Password reset successful:", message)
        },
        onError: (error) => {
            console.error("Password reset failed:", error)
        }
    })

    const {
        register,
        handleSubmit,
        formState: { errors },
        watch,
    } = useForm<ResetPasswordFormData>({
        resolver: zodResolver(resetPasswordSchema),
    })

    const watchedPassword = watch("password")
    const passwordStrength = watchedPassword ? validatePasswordStrength(watchedPassword) : null

    const onSubmit = async (data: ResetPasswordFormData) => {
        if (!token) {
            return
        }
        await resetPassword(token, data.password, data.confirmPassword)
    }

    // Show success state
    if (status === PasswordResetStatus.RESET_SUCCESS) {
        return (
            <AuthLayout
                title="Password Reset Successful"
                description="Your password has been updated"
            >
                <div className="space-y-6">
                    {/* Success Icon */}
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Password updated successfully!</h3>
                            <p className="text-sm text-muted-foreground">
                                {message || "Your password has been reset. You can now sign in with your new password."}
                            </p>
                        </div>
                    </div>

                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                    Security Tip
                                </p>
                                <p className="text-xs text-green-700 dark:text-green-300">
                                    For your security, you&apos;ll need to sign in again with your new password.
                                </p>
                            </div>
                        </div>
                    </div>

                    <Button 
                        className="w-full"
                        onClick={() => redirect("/login")}
                    >
                        Continue to Sign In
                    </Button>

                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">
                            You will be automatically redirected to sign in in a few seconds.
                        </p>
                    </div>
                </div>
            </AuthLayout>
        )
    }

    // Show error state if no token
    if (!token) {
        return (
            <AuthLayout
                title="Invalid Reset Link"
                description="This password reset link is invalid"
            >
                <div className="space-y-6">
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
                            <XCircle className="w-6 h-6 text-destructive" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Invalid reset link</h3>
                            <p className="text-sm text-muted-foreground">
                                This password reset link is invalid or has expired. Please request a new one.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Button 
                            className="w-full"
                            onClick={() => redirect("/forgot-password")}
                        >
                            Request New Reset Link
                        </Button>
                        <Button 
                            variant="outline" 
                            className="w-full"
                            onClick={() => redirect("/login")}
                        >
                            Back to Sign In
                        </Button>
                    </div>
                </div>
            </AuthLayout>
        )
    }

    // Show reset form
    return (
        <AuthLayout
            title="Reset Your Password"
            description="Enter your new password below"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* New Password Field */}
                <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <div className="relative">
                        <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your new password"
                            error={!!errors.password}
                            disabled={isLoading}
                            {...register("password")}
                            autoComplete="new-password"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                        </Button>
                    </div>
                    {errors.password && (
                        <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                    {watchedPassword && (
                        <PasswordStrengthIndicator password={watchedPassword} />
                    )}
                </div>

                {/* Confirm Password Field */}
                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <div className="relative">
                        <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your new password"
                            error={!!errors.confirmPassword}
                            disabled={isLoading}
                            {...register("confirmPassword")}
                            autoComplete="new-password"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            disabled={isLoading}
                        >
                            {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                        </Button>
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                </div>

                {/* Error Display */}
                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                        <p className="text-sm text-destructive">{error}</p>
                    </div>
                )}

                {/* Submit Button */}
                <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading || !passwordStrength?.isValid}
                    loading={isLoading}
                >
                    Reset Password
                </Button>
            </form>

            {/* Back to login */}
            <div className="text-center">
                <Button 
                    variant="ghost" 
                    className="text-sm"
                    onClick={() => redirect("/login")}
                    disabled={isLoading}
                >
                    Back to Sign In
                </Button>
            </div>
        </AuthLayout>
    )
}