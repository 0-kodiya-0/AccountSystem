"use client"

import * as React from "react"
import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Eye, EyeOff, Chrome, Check } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { AuthLayout } from "@/components/layout/auth-layout"
import { PasswordStrengthIndicator } from "@/components/auth/password-strength-indicator"
import { useLocalAuth, useOAuth } from "@accountsystem/auth-react-sdk"
import { getEnvironmentConfig, validatePasswordStrength } from "@/lib/utils"

const signupSchema = z.object({
    firstName: z.string().min(1, "First name is required").max(50, "First name too long"),
    lastName: z.string().min(1, "Last name is required").max(50, "Last name too long"),
    email: z.string().email("Please enter a valid email address"),
    username: z.string().min(3, "Username must be at least 3 characters").max(30, "Username too long").optional(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    birthdate: z.string().optional(),
    agreeToTerms: z.boolean().refine(val => val === true, "You must agree to the terms"),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
})

type SignupFormData = z.infer<typeof signupSchema>

export default function SignupPage() {
    const router = useRouter()
    const { toast } = useToast()
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)

    const { signup, isAuthenticating } = useLocalAuth()
    const { signupWithProvider } = useOAuth()
    const config = getEnvironmentConfig()

    const {
        register,
        handleSubmit,
        formState: { errors, isSubmitting },
        watch,
    } = useForm<SignupFormData>({
        resolver: zodResolver(signupSchema),
        defaultValues: {
            agreeToTerms: false
        }
    })

    const watchedPassword = watch("password")
    const passwordStrength = watchedPassword ? validatePasswordStrength(watchedPassword) : null

    const onSubmit = async (data: SignupFormData) => {
        try {
            await signup(data)

            toast({
                title: "Account created successfully!",
                description: "Please check your email to verify your account.",
                variant: "success",
            })

            // Redirect to check email page
            router.push("/check-email")

        } catch (error: any) {
            toast({
                title: "Sign up failed",
                description: error.message || "Please check your information and try again.",
                variant: "destructive",
            })
        }
    }

    const handleOAuthSignup = (provider: "google" | "microsoft" | "facebook") => {
        try {
            const redirectUrl = config.homeUrl || "/dashboard"
            signupWithProvider(provider, redirectUrl)
        } catch (error: any) {
            toast({
                title: "OAuth sign up failed",
                description: error.message || "Unable to start OAuth sign up process.",
                variant: "destructive",
            })
        }
    }

    return (
        <AuthLayout
            title="Create your account"
            description="Get started with your secure account"
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
                            onClick={() => handleOAuthSignup("google")}
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

                {config.enableLocalAuth && (
                    <>
                        {/* Name Fields */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">First name</Label>
                                <Input
                                    id="firstName"
                                    placeholder="John"
                                    error={!!errors.firstName}
                                    disabled={isSubmitting || isAuthenticating}
                                    {...register("firstName")}
                                />
                                {errors.firstName && (
                                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="lastName">Last name</Label>
                                <Input
                                    id="lastName"
                                    placeholder="Doe"
                                    error={!!errors.lastName}
                                    disabled={isSubmitting || isAuthenticating}
                                    {...register("lastName")}
                                />
                                {errors.lastName && (
                                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                                )}
                            </div>
                        </div>

                        {/* Email Field */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="john@example.com"
                                error={!!errors.email}
                                disabled={isSubmitting || isAuthenticating}
                                {...register("email")}
                            />
                            {errors.email && (
                                <p className="text-sm text-destructive">{errors.email.message}</p>
                            )}
                        </div>

                        {/* Username Field (Optional) */}
                        <div className="space-y-2">
                            <Label htmlFor="username">Username (optional)</Label>
                            <Input
                                id="username"
                                placeholder="johndoe"
                                error={!!errors.username}
                                disabled={isSubmitting || isAuthenticating}
                                {...register("username")}
                            />
                            {errors.username && (
                                <p className="text-sm text-destructive">{errors.username.message}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                You can use this to sign in instead of your email
                            </p>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a strong password"
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
                            <Label htmlFor="confirmPassword">Confirm password</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm your password"
                                    error={!!errors.confirmPassword}
                                    disabled={isSubmitting || isAuthenticating}
                                    {...register("confirmPassword")}
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    disabled={isSubmitting || isAuthenticating}
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

                        {/* Birthdate Field (Optional) */}
                        <div className="space-y-2">
                            <Label htmlFor="birthdate">Date of birth (optional)</Label>
                            <Input
                                id="birthdate"
                                type="date"
                                error={!!errors.birthdate}
                                disabled={isSubmitting || isAuthenticating}
                                {...register("birthdate")}
                            />
                            {errors.birthdate && (
                                <p className="text-sm text-destructive">{errors.birthdate.message}</p>
                            )}
                        </div>

                        {/* Terms Agreement */}
                        <div className="space-y-2">
                            <div className="flex items-start space-x-2">
                                <input
                                    id="agreeToTerms"
                                    type="checkbox"
                                    className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                                    disabled={isSubmitting || isAuthenticating}
                                    {...register("agreeToTerms")}
                                />
                                <Label htmlFor="agreeToTerms" className="text-sm leading-5">
                                    I agree to the{" "}
                                    {config.termsUrl ? (
                                        <Link href={config.termsUrl} className="text-primary hover:underline" target="_blank">
                                            Terms of Service
                                        </Link>
                                    ) : (
                                        <span className="text-primary">Terms of Service</span>
                                    )}
                                    {" "}and{" "}
                                    {config.privacyUrl ? (
                                        <Link href={config.privacyUrl} className="text-primary hover:underline" target="_blank">
                                            Privacy Policy
                                        </Link>
                                    ) : (
                                        <span className="text-primary">Privacy Policy</span>
                                    )}
                                </Label>
                            </div>
                            {errors.agreeToTerms && (
                                <p className="text-sm text-destructive">{errors.agreeToTerms.message}</p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <Button
                            type="submit"
                            className="w-full"
                            loading={isSubmitting || isAuthenticating}
                            disabled={isSubmitting || isAuthenticating || !passwordStrength?.isValid}
                        >
                            Create account
                        </Button>
                    </>
                )}
            </form>

            {/* Sign In Link */}
            <div className="text-center text-sm">
                <span className="text-muted-foreground">Already have an account? </span>
                <Link href="/login" className="text-primary hover:underline font-medium">
                    Sign in
                </Link>
            </div>
        </AuthLayout>
    )
}