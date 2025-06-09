"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Smartphone, AlertTriangle, Clock, RefreshCw, Key } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { AuthLayout } from "@/components/layout/auth-layout"
import { use2FAVerification, TwoFactorVerificationStatus } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"

const verificationSchema = z.object({
    token: z.string()
        .min(6, "Code must be at least 6 characters")
        .max(8, "Code must be at most 8 characters")
        .regex(/^[0-9A-Za-z]+$/, "Code can only contain letters and numbers"),
})

const backupCodeSchema = z.object({
    backupCode: z.string()
        .min(8, "Backup code must be at least 8 characters")
        .max(12, "Backup code must be at most 12 characters"),
})

type VerificationFormData = z.infer<typeof verificationSchema>
type BackupCodeFormData = z.infer<typeof backupCodeSchema>

export default function TwoFactorVerifyPage() {
    const { toast } = useToast()
    const config = getEnvironmentConfig()
    
    const [isBackupCode, setIsBackupCode] = useState(false)

    const {
        status,
        message,
        error,
        attemptsRemaining,
        lockoutTimeRemaining,
        isLoading,
        canRetry,
        verify,
        useBackupCode,
        clearError,
        redirect,
    } = use2FAVerification({
        redirectAfterSuccess: config.homeUrl || "/dashboard",
        redirectDelay: 2000,
        maxAttempts: 5,
        lockoutDuration: 300000, // 5 minutes
        onSuccess: (accountId, name) => {
            toast({
                title: "Authentication successful!",
                description: `Welcome back${name ? `, ${name}` : ''}!`,
                variant: "success",
            })
        },
        onError: (error) => {
            toast({
                title: "Verification failed",
                description: error,
                variant: "destructive",
            })
        },
        onLockout: (duration) => {
            toast({
                title: "Account temporarily locked",
                description: `Too many failed attempts. Try again in ${Math.ceil(duration / 60000)} minutes.`,
                variant: "destructive",
            })
        }
    })

    // Form instances
    const verificationForm = useForm<VerificationFormData>({
        resolver: zodResolver(verificationSchema),
    })

    const backupForm = useForm<BackupCodeFormData>({
        resolver: zodResolver(backupCodeSchema),
    })

    // Form handlers
    const onVerificationSubmit = async (data: VerificationFormData) => {
        await verify(data.token, false)
    }

    const onBackupSubmit = async (data: BackupCodeFormData) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        await useBackupCode(data.backupCode)
    }

    // Auto-focus appropriate input
    useEffect(() => {
        if (status === TwoFactorVerificationStatus.IDLE) {
            if (isBackupCode) {
                document.getElementById('backupCode')?.focus()
            } else {
                document.getElementById('token')?.focus()
            }
        }
    }, [status, isBackupCode])

    // Handle session expiration
    if (status === TwoFactorVerificationStatus.EXPIRED_SESSION) {
        return (
            <AuthLayout
                title="Session Expired"
                description="Your 2FA session has expired"
            >
                <div className="space-y-6">
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Session expired</h3>
                            <p className="text-sm text-muted-foreground">
                                Your 2FA session has expired. Please sign in again to continue.
                            </p>
                        </div>
                    </div>

                    <Button 
                        className="w-full"
                        onClick={() => redirect("/login")}
                    >
                        Back to Sign In
                    </Button>
                </div>
            </AuthLayout>
        )
    }

    // Handle success state
    if (status === TwoFactorVerificationStatus.SUCCESS) {
        return (
            <AuthLayout
                title="Authentication Successful"
                description="You have been successfully signed in"
            >
                <div className="space-y-6">
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                            <Smartphone className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Welcome back!</h3>
                            <p className="text-sm text-muted-foreground">
                                {message || "You have been successfully authenticated."}
                            </p>
                        </div>
                    </div>

                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">
                            You will be redirected to your dashboard shortly...
                        </p>
                    </div>
                </div>
            </AuthLayout>
        )
    }

    // Handle lockout state
    if (status === TwoFactorVerificationStatus.LOCKED_OUT) {
        const minutesRemaining = lockoutTimeRemaining ? Math.ceil(lockoutTimeRemaining / 60000) : 0
        
        return (
            <AuthLayout
                title="Too Many Failed Attempts"
                description="Your account has been temporarily locked"
            >
                <div className="space-y-6">
                    <div className="text-center space-y-4">
                        <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                            <Clock className="w-6 h-6 text-red-600 dark:text-red-400" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-medium">Account temporarily locked</h3>
                            <p className="text-sm text-muted-foreground">
                                Too many failed verification attempts. Please try again in {minutesRemaining} minute{minutesRemaining !== 1 ? 's' : ''}.
                            </p>
                        </div>
                    </div>

                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                    Security Lockout
                                </p>
                                <p className="text-xs text-red-700 dark:text-red-300">
                                    This is a security measure to protect your account from unauthorized access attempts.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Button 
                            variant="outline"
                            className="w-full"
                            onClick={() => redirect("/login")}
                        >
                            Back to Sign In
                        </Button>
                        
                        <div className="text-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => redirect("/forgot-password")}
                            >
                                Forgot your password?
                            </Button>
                        </div>
                    </div>
                </div>
            </AuthLayout>
        )
    }

    // Main verification form
    return (
        <AuthLayout
            title="Two-Factor Authentication"
            description={isBackupCode ? "Enter a backup recovery code" : "Enter the verification code from your authenticator app"}
        >
            <div className="space-y-6">
                {/* Icon and description */}
                <div className="text-center space-y-4">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        {isBackupCode ? (
                            <Key className="w-6 h-6 text-primary" />
                        ) : (
                            <Smartphone className="w-6 h-6 text-primary" />
                        )}
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-medium">
                            {isBackupCode ? "Enter backup code" : "Enter authenticator code"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {isBackupCode
                                ? "Enter one of your backup recovery codes to complete sign in."
                                : "Open your authenticator app and enter the 6-digit code."
                            }
                        </p>
                    </div>
                </div>

                {/* Attempts remaining warning */}
                {attemptsRemaining !== null && attemptsRemaining <= 2 && attemptsRemaining > 0 && (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                    Warning: {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''} remaining
                                </p>
                                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                    Your account will be temporarily locked after too many failed attempts.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Verification Form */}
                {!isBackupCode ? (
                    <form onSubmit={verificationForm.handleSubmit(onVerificationSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="token">Verification Code</Label>
                            <Input
                                id="token"
                                type="text"
                                placeholder="000000"
                                className="text-center text-lg tracking-widest"
                                maxLength={6}
                                error={!!verificationForm.formState.errors.token || !!error}
                                disabled={isLoading || !canRetry}
                                {...verificationForm.register("token")}
                                autoComplete="one-time-code"
                            />
                            {verificationForm.formState.errors.token && (
                                <p className="text-sm text-destructive">
                                    {verificationForm.formState.errors.token.message}
                                </p>
                            )}
                            {error && (
                                <p className="text-sm text-destructive">{error}</p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            loading={isLoading}
                            disabled={isLoading || !canRetry}
                        >
                            Verify and Sign In
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={backupForm.handleSubmit(onBackupSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="backupCode">Backup Code</Label>
                            <Input
                                id="backupCode"
                                type="text"
                                placeholder="Enter backup code"
                                className="text-center text-lg tracking-wider"
                                maxLength={12}
                                error={!!backupForm.formState.errors.backupCode || !!error}
                                disabled={isLoading || !canRetry}
                                {...backupForm.register("backupCode")}
                                autoComplete="one-time-code"
                            />
                            {backupForm.formState.errors.backupCode && (
                                <p className="text-sm text-destructive">
                                    {backupForm.formState.errors.backupCode.message}
                                </p>
                            )}
                            {error && (
                                <p className="text-sm text-destructive">{error}</p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full"
                            loading={isLoading}
                            disabled={isLoading || !canRetry}
                        >
                            Verify Backup Code
                        </Button>
                    </form>
                )}

                {/* Toggle between methods */}
                <div className="text-center">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                            setIsBackupCode(!isBackupCode)
                            clearError()
                            verificationForm.reset()
                            backupForm.reset()
                        }}
                        disabled={isLoading || !canRetry}
                        className="text-sm"
                    >
                        {isBackupCode
                            ? "Use authenticator app instead"
                            : "Use backup code instead"
                        }
                    </Button>
                </div>

                {/* Additional actions */}
                <div className="space-y-3">
                    {/* Refresh/try again */}
                    {!isBackupCode && canRetry && (
                        <div className="text-center">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    clearError()
                                    verificationForm.reset()
                                    document.getElementById('token')?.focus()
                                }}
                                disabled={isLoading}
                                className="text-sm text-muted-foreground"
                            >
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Generate new code
                            </Button>
                        </div>
                    )}

                    {/* Back to login */}
                    <div className="text-center">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => redirect("/login")}
                            disabled={isLoading}
                            className="text-sm text-muted-foreground"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to sign in
                        </Button>
                    </div>
                </div>
            </div>
        </AuthLayout>
    )
}