"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { AuthLayout } from "@/components/layout/auth-layout"
import { authClient } from "@/lib/auth"

export default function EmailVerificationPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        const verifyEmail = async () => {
            const token = searchParams.get("token")

            if (!token) {
                setStatus("error")
                setErrorMessage("Verification token is missing from the URL")
                return
            }

            try {
                await authClient.verifyEmail(token)
                setStatus("success")

                toast({
                    title: "Email verified successfully!",
                    description: "Your account has been activated. You can now sign in.",
                    variant: "success",
                })

                // Redirect to login after a short delay
                setTimeout(() => {
                    router.push("/login")
                }, 3000)

            } catch (error: any) {
                setStatus("error")
                setErrorMessage(error.message || "Failed to verify email address")

                toast({
                    title: "Verification failed",
                    description: error.message || "The verification link may be invalid or expired.",
                    variant: "destructive",
                })
            }
        }

        verifyEmail()
    }, [searchParams, router, toast])

    const getContent = () => {
        switch (status) {
            case "loading":
                return {
                    icon: <Loader2 className="w-12 h-12 text-primary animate-spin" />,
                    title: "Verifying your email...",
                    description: "Please wait while we verify your email address.",
                    showActions: false,
                }

            case "success":
                return {
                    icon: <CheckCircle className="w-12 h-12 text-green-600" />,
                    title: "Email verified successfully!",
                    description: "Your account has been activated. You will be redirected to sign in shortly.",
                    showActions: true,
                    actionText: "Continue to sign in",
                    actionHref: "/login",
                }

            case "error":
                return {
                    icon: <XCircle className="w-12 h-12 text-destructive" />,
                    title: "Verification failed",
                    description: errorMessage || "We couldn't verify your email address.",
                    showActions: true,
                    actionText: "Back to sign up",
                    actionHref: "/signup",
                    secondaryActionText: "Try signing in",
                    secondaryActionHref: "/login",
                }
        }
    }

    const content = getContent()

    return (
        <AuthLayout
            title={content.title}
            description={content.description}
        >
            <div className="space-y-6">
                {/* Status Icon */}
                <div className="text-center">
                    <div className="mx-auto w-16 h-16 flex items-center justify-center">
                        {content.icon}
                    </div>
                </div>

                {/* Additional Information */}
                {status === "success" && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                    Account Activated
                                </p>
                                <p className="text-xs text-green-700 dark:text-green-300">
                                    Your email address has been successfully verified and your account is now active.
                                    You can now sign in and access all features.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {status === "error" && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                        <div className="flex items-start space-x-3">
                            <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-destructive">
                                    Verification Failed
                                </p>
                                <p className="text-xs text-destructive/80">
                                    The verification link may be invalid, expired, or already used.
                                    You can try signing up again or contact support for assistance.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                {content.showActions && (
                    <div className="space-y-3">
                        {content.actionHref && (
                            <Link href={content.actionHref}>
                                <Button className="w-full">
                                    {content.actionText}
                                </Button>
                            </Link>
                        )}

                        {content.secondaryActionHref && (
                            <Link href={content.secondaryActionHref}>
                                <Button variant="outline" className="w-full">
                                    {content.secondaryActionText}
                                </Button>
                            </Link>
                        )}
                    </div>
                )}

                {/* Auto-redirect notice for success */}
                {status === "success" && (
                    <div className="text-center">
                        <p className="text-xs text-muted-foreground">
                            You will be automatically redirected to sign in in a few seconds.
                        </p>
                    </div>
                )}
            </div>
        </AuthLayout>
    )
}