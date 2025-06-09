import Link from "next/link"
import { Home, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { getEnvironmentConfig } from "@/lib/utils"

export default function NotFound() {
    const config = getEnvironmentConfig()

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <Link href="/" className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">A</span>
                            </div>
                            <span className="text-xl font-bold">{config.appName}</span>
                        </Link>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                <div className="text-center space-y-8 max-w-md">
                    {/* 404 Illustration */}
                    <div className="space-y-4">
                        <div className="text-8xl font-bold text-primary/20">404</div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-foreground">
                                Page not found
                            </h1>
                            <p className="text-muted-foreground">
                                The page you&apos;re looking for doesn&apos;t exist or has been moved.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <Link href="/login">
                                <Button className="w-full sm:w-auto">
                                    <Home className="w-4 h-4 mr-2" />
                                    Go to Sign In
                                </Button>
                            </Link>

                            <Button
                                variant="outline"
                                onClick={() => window.history.back()}
                                className="w-full sm:w-auto"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Go Back
                            </Button>
                        </div>

                        {/* Help Links */}
                        <div className="pt-4 border-t">
                            <p className="text-sm text-muted-foreground mb-3">
                                Need help? Try these options:
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2 justify-center text-sm">
                                <Link
                                    href="/signup"
                                    className="text-primary hover:underline"
                                >
                                    Create Account
                                </Link>
                                <span className="hidden sm:inline text-muted-foreground">•</span>
                                <Link
                                    href="/forgot-password"
                                    className="text-primary hover:underline"
                                >
                                    Reset Password
                                </Link>
                                {config.supportEmail && (
                                    <>
                                        <span className="hidden sm:inline text-muted-foreground">•</span>
                                        <Link
                                            href={`mailto:${config.supportEmail}`}
                                            className="text-primary hover:underline"
                                        >
                                            Contact Support
                                        </Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Additional Info */}
                    <div className="text-xs text-muted-foreground">
                        <p>
                            If you believe this is an error, please{" "}
                            {config.supportEmail ? (
                                <Link
                                    href={`mailto:${config.supportEmail}`}
                                    className="text-primary hover:underline"
                                >
                                    contact support
                                </Link>
                            ) : (
                                "contact support"
                            )}
                            .
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t py-6">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-center space-x-4 text-sm text-muted-foreground">
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
                        {config.companyName && (
                            <span>© 2024 {config.companyName}</span>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    )
}