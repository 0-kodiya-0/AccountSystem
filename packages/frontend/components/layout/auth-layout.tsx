import * as React from "react"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { getEnvironmentConfig } from "@/lib/utils"

interface AuthLayoutProps {
    children: React.ReactNode
    title: string
    description?: string
    showBackToHome?: boolean
}

export function AuthLayout({
    children,
    title,
    description,
    showBackToHome = false
}: AuthLayoutProps) {
    const config = getEnvironmentConfig()

    return (
        <div className="min-h-screen flex">
            {/* Left side - Branding */}
            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20" />
                <div className="relative z-10 flex flex-col justify-between p-12 text-white">
                    <div>
                        <Link href="/" className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                                <span className="text-primary-600 font-bold text-lg">A</span>
                            </div>
                            <span className="text-2xl font-bold">{config.appName}</span>
                        </Link>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h1 className="text-4xl font-bold leading-tight">
                                Secure Authentication
                                <br />
                                Made Simple
                            </h1>
                            <p className="text-primary-100 text-lg mt-4 leading-relaxed">
                                Manage your accounts securely with support for multiple authentication
                                methods, two-factor authentication, and seamless account switching.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="flex items-center space-x-3">
                                <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-green-800" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <span className="text-primary-100">Multi-factor authentication</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-green-800" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <span className="text-primary-100">OAuth & Local authentication</span>
                            </div>
                            <div className="flex items-center space-x-3">
                                <div className="w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-green-800" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <span className="text-primary-100">Account management</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-primary-200 text-sm">
                        {config.companyName && (
                            <>© 2024 {config.companyName}. All rights reserved.</>
                        )}
                    </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
            </div>

            {/* Right side - Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-background">
                <div className="w-full max-w-md space-y-8">
                    {/* Header */}
                    <div className="text-center lg:hidden">
                        <Link href="/" className="inline-flex items-center space-x-2 mb-8">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">A</span>
                            </div>
                            <span className="text-2xl font-bold text-foreground">{config.appName}</span>
                        </Link>
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold text-center lg:text-left">{title}</h2>
                        {description && (
                            <p className="text-muted-foreground text-center lg:text-left">
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Form Content */}
                    <div className="space-y-6">
                        {children}
                    </div>

                    {/* Footer Links */}
                    <div className="space-y-4">
                        {showBackToHome && config.homeUrl && (
                            <div className="text-center">
                                <Link
                                    href={config.homeUrl}
                                    className="text-sm text-muted-foreground hover:text-primary"
                                >
                                    ← Back to {config.companyName || 'Home'}
                                </Link>
                            </div>
                        )}

                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center space-x-4">
                                {config.termsUrl && (
                                    <Link href={config.termsUrl} className="hover:text-primary">
                                        Terms
                                    </Link>
                                )}
                                {config.privacyUrl && (
                                    <Link href={config.privacyUrl} className="hover:text-primary">
                                        Privacy
                                    </Link>
                                )}
                                {config.supportEmail && (
                                    <Link href={`mailto:${config.supportEmail}`} className="hover:text-primary">
                                        Support
                                    </Link>
                                )}
                            </div>
                            <ThemeToggle />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}