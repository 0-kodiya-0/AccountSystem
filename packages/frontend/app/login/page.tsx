"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Chrome } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { AuthLayout } from "@/components/layout/auth-layout"
import { useLocalAuth, useOAuth } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig } from "@/lib/utils"

const loginSchema = z.object({
    email: z.string().email("Please enter a valid email address").optional(),
    username: z.string().min(1, "Username is required").optional(),
    password: z.string().min(1, "Password is required"),
    rememberMe: z.boolean().default(false),
}).refine((data) => data.email || data.username, {
    message: "Either email or username is required",
    path: ["email"]
})

type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [showPassword, setShowPassword] = useState(false)
    const [useEmail, setUseEmail] = useState(true)

    const { login, isAuthenticating, error: authError } = useLocalAuth()
    const { signupWithProvider, signinWithProvider } = useOAuth()
    const config = getEnvironmentConfig()

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        watch,
        setError,
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            rememberMe: false
        }
    })

    // Watch form values for conditional validation
    const watchedEmail = watch("email")
    const watchedUsername = watch("username")

    const onSubmit = async (data: LoginFormData) => {
        try {
            const loginData = {
                email: useEmail ? data.email : undefined,
                username: !useEmail ? data.username : undefined,
                password: data.password,
                rememberMe: data.rememberMe,
            }

            const result = await login(loginData)

            if (result?.requiresTwoFactor) {
                // Redirect to 2FA verification page
                router.push("/two-factor-verify")
                return
            }

            // Success - redirect to intended destination
            toast({
                title: "Welcome back!",
                description: "You have been successfully signed in.",
                variant: "success",
            })

            // Redirect to home URL or dashboard
            const redirectUrl = config.homeUrl || "/dashboard"
            router.push(redirectUrl)

        } catch (error: any) {
            toast({
                title: "Sign in failed",
                description: error.message || "Please check your credentials and try again.",
                variant: "destructive",
            })
        }
    }

    const handleOAuthLogin = (provider: "google" | "microsoft" | "facebook") => {
        try {
            const redirectUrl = config.homeUrl || "/dashboard"
            signinWithProvider(provider, redirectUrl)
        } catch (error: any) {
            toast({
                title: "OAuth sign in failed",
                description: error.message || "Unable to start OAuth sign in process.",
                variant: "destructive",
            })
        }
    }

    return (
        <AuthLayout
            title="Welcome back"
            description="Sign in to your account to continue"
            showBackToHome={!!config.homeUrl}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* OAuth Buttons */}
                {config.enableOAuth && (
                    <div className="space-y-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={() => handleOAuthLogin("google")}
                            disabled={isSubmitting || isAuthenticating}
                        >
                            <Chrome className="mr-2 h-4 w-4" />
                            Continue with Google
                        </Button>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">Or</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Login Type Toggle */}
                {config.enableLocalAuth && (
                    <div className="flex items-center justify-center space-x-2">
                        <Button
                            type="button"
                            variant={useEmail ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setUseEmail(true)}
                            className="text-xs"
                        >
                            Email
                        </Button>
                        <Button
                            type="button"
                            variant={!useEmail ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setUseEmail(false)}
                            className="text-xs"
                        >
                            Username
                        </Button>
                    </div>
                )}

                {/* Email/Username Field */}
                {config.enableLocalAuth && (
                    <div className="space-y-2">
                        <Label htmlFor={useEmail ? "email" : "username"}>
                            {useEmail ? "Email address" : "Username"}
                        </Label>
                        <Input
                            id={useEmail ? "email" : "username"}
                            type={useEmail ? "email" : "text"}
                            placeholder={useEmail ? "Enter your email" : "Enter your username"}
                            error={!!(useEmail ? errors.email : errors.username)}
                            disabled={isSubmitting || isAuthenticating}
                            {...register(useEmail ? "email" : "username")}
                        />
                        {(useEmail ? errors.email : errors.username) && (
                            <p className="text-sm text-destructive">
                                {(useEmail ? errors.email : errors.username)?.message}
                            </p>
                        )}
                    </div>
                )}

                {/* Password Field */}
                {config.enableLocalAuth && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <Link
                                href="/forgot-password"
                                className="text-sm text-primary hover:underline"
                            >
                                Forgot password?
                            </Link>
                        </div>
                        <div className="relative">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your password"
                                error={!!errors.password}
                                disabled={isSubmitting || isAuthenticating}
                                {...register("password")}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                                disabled={isSubmitting || isAuthenticating}
                            >
                                {showPassword ? (
                                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                )}
                                <span className="sr-only">
                                    {showPassword ? "Hide password" : "Show password"}
                                </span>
                            </Button>
                        </div>
                        {errors.password && (
                            <p className="text-sm text-destructive">{errors.password.message}</p>
                        )}
                    </div>
                )}

                {/* Remember Me */}
                {config.enableLocalAuth && (
                    <div className="flex items-center space-x-2">
                        <input
                            id="rememberMe"
                            type="checkbox"
                            className="rounded border-gray-300 text-primary focus:ring-primary"
                            disabled={isSubmitting || isAuthenticating}
                            {...register("rememberMe")}
                        />
                        <Label htmlFor="rememberMe" className="text-sm">
                            Remember me for 30 days
                        </Label>
                    </div>
                )}

                {/* Submit Button */}
                {config.enableLocalAuth && (
                    <Button
                        type="submit"
                        className="w-full"
                        loading={isSubmitting || isAuthenticating}
                        disabled={isSubmitting || isAuthenticating}
                    >
                        Sign in
                    </Button>
                )}
            </form>

            {/* Sign Up Link */}
            <div className="text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <Link href="/signup" className="text-primary hover:underline font-medium">
                    Sign up
                </Link>
            </div>
        </AuthLayout>
    )
}