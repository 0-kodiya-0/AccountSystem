"use client"

import * as React from "react"
import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Shield, Eye, EyeOff, Download, Copy, CheckCircle, Smartphone, Key, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { AuthGuard, use2FASetup, TwoFactorSetupStatus } from "@accountsystem/auth-react-sdk"
import { LoadingSpinner } from "@/components/auth/loading-spinner"
import { RedirectingSpinner } from "@/components/auth/redirecting-spinner"
import Image from "next/image"

// Form schemas
const passwordSchema = z.object({
    password: z.string().min(1, "Password is required"),
})

const verificationSchema = z.object({
    token: z.string().min(6, "Code must be at least 6 characters").max(8, "Code must be at most 8 characters"),
})

const backupCodeSchema = z.object({
    password: z.string().min(1, "Password is required to generate backup codes"),
})

type PasswordFormData = z.infer<typeof passwordSchema>
type VerificationFormData = z.infer<typeof verificationSchema>
type BackupCodeFormData = z.infer<typeof backupCodeSchema>

export default function TwoFactorSetupPage() {
    const params = useParams()
    const router = useRouter()
    const { toast } = useToast()
    const accountId = params.accountId as string

    const [showPassword, setShowPassword] = useState(false)
    const [showBackupPassword, setShowBackupPassword] = useState(false)
    const [copiedSecret, setCopiedSecret] = useState(false)

    // Use the SDK 2FA setup hook
    const {
        status,
        qrCode,
        secret,
        backupCodes,
        message,
        error,
        isLoading,
        startSetup,
        verifySetup,
        generateBackupCodes,
        downloadBackupCodes,
        reset,
        redirect
    } = use2FASetup({
        accountId,
        autoGenerateBackupCodes: false, // Manual generation for better UX
        redirectAfterComplete: undefined, // Stay on page to show backup codes
        onSetupReady: () => {
            toast({
                title: "2FA Setup Ready",
                description: "Scan the QR code with your authenticator app.",
                variant: "success",
            })
        },
        onVerified: (message) => {
            toast({
                title: "Verification Successful",
                description: message,
                variant: "success",
            })
        },
        onBackupCodesGenerated: (codes) => {
            toast({
                title: "Backup Codes Generated",
                description: `${codes.length} backup codes have been generated.`,
                variant: "success",
            })
        },
        onError: (error) => {
            toast({
                title: "2FA Setup Failed",
                description: error,
                variant: "destructive",
            })
        }
    })

    // Form instances
    const passwordForm = useForm<PasswordFormData>({
        resolver: zodResolver(passwordSchema),
    })

    const verificationForm = useForm<VerificationFormData>({
        resolver: zodResolver(verificationSchema),
    })

    const backupForm = useForm<BackupCodeFormData>({
        resolver: zodResolver(backupCodeSchema),
    })

    // Form handlers
    const onPasswordSubmit = async (data: PasswordFormData) => {
        await startSetup(data.password)
    }

    const onVerificationSubmit = async (data: VerificationFormData) => {
        await verifySetup(data.token)
    }

    const onBackupSubmit = async (data: BackupCodeFormData) => {
        await generateBackupCodes(data.password)
    }

    const copySecret = async () => {
        if (secret) {
            try {
                await navigator.clipboard.writeText(secret)
                setCopiedSecret(true)
                setTimeout(() => setCopiedSecret(false), 2000)
                toast({
                    title: "Secret Copied",
                    description: "Secret key copied to clipboard.",
                    variant: "success",
                })
            } catch {
                toast({
                    title: "Copy Failed",
                    description: "Failed to copy secret to clipboard.",
                    variant: "destructive",
                })
            }
        }
    }

    const handleDownloadCodes = () => {
        downloadBackupCodes('2fa-backup-codes.txt')
        toast({
            title: "Backup Codes Downloaded",
            description: "Save this file in a secure location.",
            variant: "success",
        })
    }

    const renderPasswordStep = () => (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5" />
                    <span>Enable Two-Factor Authentication</span>
                </CardTitle>
                <CardDescription>
                    Enter your password to begin setting up 2FA for your account
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">Current Password</Label>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your current password"
                                error={!!passwordForm.formState.errors.password}
                                disabled={isLoading}
                                {...passwordForm.register("password")}
                                autoComplete="current-password"
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
                        {passwordForm.formState.errors.password && (
                            <p className="text-sm text-destructive">
                                {passwordForm.formState.errors.password.message}
                            </p>
                        )}
                        {error && (
                            <p className="text-sm text-destructive">{error}</p>
                        )}
                    </div>

                    <div className="flex space-x-3">
                        <Button type="submit" disabled={isLoading} loading={isLoading}>
                            Continue Setup
                        </Button>
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => router.back()}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )

    const renderQRCodeStep = () => (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Smartphone className="h-5 w-5" />
                        <span>Scan QR Code</span>
                    </CardTitle>
                    <CardDescription>
                        Use your authenticator app to scan this QR code
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {qrCode && (
                        <div className="flex justify-center">
                            <div className="p-4 bg-white rounded-lg border">
                                <Image 
                                    src={qrCode} 
                                    alt="2FA QR Code" 
                                    className="w-48 h-48"
                                />
                            </div>
                        </div>
                    )}

                    {secret && (
                        <div className="space-y-2">
                            <Label>Manual Entry Key</Label>
                            <div className="flex items-center space-x-2">
                                <Input
                                    value={secret}
                                    readOnly
                                    className="font-mono text-sm"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={copySecret}
                                    className="shrink-0"
                                >
                                    {copiedSecret ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Copy this key if you can&apos;t scan the QR code
                            </p>
                        </div>
                    )}

                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                            Recommended Authenticator Apps
                        </h4>
                        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                            <li>• Google Authenticator</li>
                            <li>• Microsoft Authenticator</li>
                            <li>• Authy</li>
                            <li>• 1Password</li>
                        </ul>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Key className="h-5 w-5" />
                        <span>Verify Setup</span>
                    </CardTitle>
                    <CardDescription>
                        Enter the 6-digit code from your authenticator app
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={verificationForm.handleSubmit(onVerificationSubmit)} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="token">Verification Code</Label>
                            <Input
                                id="token"
                                type="text"
                                placeholder="000000"
                                className="text-center text-lg tracking-widest"
                                maxLength={8}
                                error={!!verificationForm.formState.errors.token}
                                disabled={isLoading}
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

                        <div className="flex space-x-3">
                            <Button type="submit" disabled={isLoading} loading={isLoading}>
                                Verify & Enable 2FA
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline" 
                                onClick={reset}
                                disabled={isLoading}
                            >
                                Start Over
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )

    const renderBackupCodesStep = () => (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <span>2FA Enabled Successfully!</span>
                    </CardTitle>
                    <CardDescription>
                        Your account is now protected with two-factor authentication
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <p className="text-sm text-green-800 dark:text-green-200">
                            {message || "Two-factor authentication has been successfully enabled for your account."}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {!backupCodes && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Shield className="h-5 w-5" />
                            <span>Generate Backup Codes</span>
                        </CardTitle>
                        <CardDescription>
                            Create backup codes for account recovery in case you lose access to your authenticator
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={backupForm.handleSubmit(onBackupSubmit)} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="backup-password">Confirm Password</Label>
                                <div className="relative">
                                    <Input
                                        id="backup-password"
                                        type={showBackupPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        error={!!backupForm.formState.errors.password}
                                        disabled={isLoading}
                                        {...backupForm.register("password")}
                                        autoComplete="current-password"
                                    />
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                        onClick={() => setShowBackupPassword(!showBackupPassword)}
                                        disabled={isLoading}
                                    >
                                        {showBackupPassword ? (
                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                        )}
                                    </Button>
                                </div>
                                {backupForm.formState.errors.password && (
                                    <p className="text-sm text-destructive">
                                        {backupForm.formState.errors.password.message}
                                    </p>
                                )}
                                {error && (
                                    <p className="text-sm text-destructive">{error}</p>
                                )}
                            </div>

                            <Button type="submit" disabled={isLoading} loading={isLoading}>
                                Generate Backup Codes
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {backupCodes && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Key className="h-5 w-5" />
                            <span>Backup Codes</span>
                        </CardTitle>
                        <CardDescription>
                            Save these codes in a secure location. Each code can only be used once.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                            <div className="flex items-start space-x-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                        Important: Save These Codes
                                    </p>
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                        These backup codes are your only way to access your account if you lose your authenticator device.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg font-mono text-sm">
                            {backupCodes.map((code, index) => (
                                <div key={index} className="text-center p-2 bg-white dark:bg-gray-800 rounded border">
                                    {code}
                                </div>
                            ))}
                        </div>

                        <div className="flex space-x-3">
                            <Button onClick={handleDownloadCodes} variant="outline">
                                <Download className="w-4 h-4 mr-2" />
                                Download Codes
                            </Button>
                            <Button onClick={() => redirect(`/accounts/${accountId}/settings`)}>
                                Back to Settings
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )

    const renderContent = () => {
        switch (status) {
            case TwoFactorSetupStatus.IDLE:
            case TwoFactorSetupStatus.ERROR:
                return renderPasswordStep()
            
            case TwoFactorSetupStatus.SETUP_READY:
                return renderQRCodeStep()
            
            case TwoFactorSetupStatus.COMPLETE:
                return renderBackupCodesStep()
            
            case TwoFactorSetupStatus.REQUESTING_SETUP:
            case TwoFactorSetupStatus.VERIFYING_TOKEN:
            case TwoFactorSetupStatus.GENERATING_BACKUP_CODES:
            default:
                return (
                    <Card>
                        <CardContent className="flex items-center justify-center py-8">
                            <LoadingSpinner reason={message || "Setting up 2FA..."} />
                        </CardContent>
                    </Card>
                )
        }
    }

    return (
        <AuthGuard
            requireAccount={true}
            loadingComponent={LoadingSpinner}
            redirectingComponent={RedirectingSpinner}
        >
            <div className="min-h-screen bg-background">
                {/* Header */}
                <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                    <div className="container mx-auto px-4 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => router.back()}
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                                <div>
                                    <h1 className="text-xl font-bold">Two-Factor Authentication</h1>
                                    <p className="text-sm text-muted-foreground">
                                        Secure your account with 2FA
                                    </p>
                                </div>
                            </div>
                            <Badge variant="outline" className="text-blue-600 border-blue-200">
                                <Shield className="w-3 h-3 mr-1" />
                                Security Setup
                            </Badge>
                        </div>
                    </div>
                </header>

                {/* Main Content */}
                <main className="container mx-auto px-4 py-8 max-w-2xl">
                    {renderContent()}
                </main>
            </div>
        </AuthGuard>
    )
}