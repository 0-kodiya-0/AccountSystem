"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { AuthLayout } from "@/components/layout/auth-layout"
import { useLocalAuth } from "@/hooks/useLocalAuth"
import { getEnvironmentConfig } from "@/lib/utils"

const twoFactorSchema = z.object({
    code: z.string()
        .min(6, "Code must be at least 6 characters")
        .max(8, "Code must be at most 8 characters")
        .regex(/^[0-9A-Za-z]+$/, "Code can only contain letters and numbers"),
})

type TwoFactorFormData = z.infer<typeof twoFactorSchema>

export default function TwoFactorVerifyPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [isBackupCode, setIsBackupCode] = useState(false)

    const { verify2FA, isAuthenticating, requires2FA } = useLocalAuth()
    const config = getEnvironmentConfig()

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        watch,
        setFocus,
    } = useForm<TwoFactorFormData>({
        resolver: zodResolver(twoFactorSchema),
    })

    const watchedCode = watch("code")

    // Redirect if 2FA is not required
    useEffect(() => {
        if (!requires2FA) {
            router.replace("/login")
        }
    }, [requires2FA, router])

    // Auto-focus code input on mount
    useEffect(() => {
        setFocus("code")
    }, [setFocus])

    const onSubmit = async (data: TwoFactorFormData) => {
        try {
            await verify2FA(data.code)

            toast({
                title: "Verification successful!",
                description: "You have been successfully signed in.",
                variant: "success",
            })

            // Redirect to home URL or dashboard
            const redirectUrl = config.homeUrl || "/dashboard"
            router.push(redirectUrl)

        } catch (error: unknown) {
            toast({
                title: "Verification failed",
                description: error instanceof Error ? error.message : "Please check your code and try again.",
                variant: "destructive",
            })
        }
    }

    if (!requires2FA) {
        return null // Will redirect via useEffect
    }

    return (
        <AuthLayout
            title="Two-Factor Authentication"
            description="Enter the verification code from your authenticator app"
        >
            <div className="space-y-6">
                {/* Icon and description */}
                <div className="text-center space-y-4">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Smartphone className="w-6 h-6 text-primary" />
                    </div>
                    <div className="space-y-2">
                        <h3 className="text-lg font-medium">
                            {isBackupCode ? "Enter backup code" : "Enter authenticator code"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {isBackupCode
                                ? "Enter one of your backup codes to complete sign in."
                                : "Open your authenticator app and enter the 6-digit code."
                            }
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    {/* Code Input */}
                    <div className="space-y-2">
                        <Label htmlFor="code">
                            {isBackupCode ? "Backup code" : "Verification code"}
                        </Label>
                        <Input
                            id="code"
                            type="text"
                            placeholder={isBackupCode ? "Enter backup code" : "000000"}
                            className="text-center text-lg tracking-widest"
                            maxLength={isBackupCode ? 8 : 6}
                            error={!!errors.code}
                            disabled={isSubmitting || isAuthenticating}
                            {...register("code")}
                            autoComplete="one-time-code"
                        />
                        {errors.code && (
                            <p className="text-sm text-destructive">{errors.code.message}</p>
                        )}
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full"
                        loading={isSubmitting || isAuthenticating}
                        disabled={isSubmitting || isAuthenticating || !watchedCode}
                    >
                        Verify and sign in
                    </Button>
                </form>

                {/* Backup code toggle */}
                <div className="text-center">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsBackupCode(!isBackupCode)}
                        disabled={isSubmitting || isAuthenticating}
                        className="text-sm"
                    >
                        {isBackupCode
                            ? "Use authenticator app instead"
                            : "Use backup code instead"
                        }
                    </Button>
                </div>

                {/* Back to login */}
                <div className="text-center">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => router.push("/login")}
                        disabled={isSubmitting || isAuthenticating}
                        className="text-sm text-muted-foreground"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to sign in
                    </Button>
                </div>
            </div>
        </AuthLayout>
    )
}