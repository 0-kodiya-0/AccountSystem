import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

import { ThemeProvider } from "@/components/theme/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@accountsystem/auth-react-sdk"
import { authClient } from "@/lib/auth"
import { getEnvironmentConfig } from "@/lib/utils"

const inter = Inter({ subsets: ["latin"] })
const config = getEnvironmentConfig()

export const metadata: Metadata = {
  title: {
    default: config.appName,
    template: `%s | ${config.appName}`,
  },
  description: "Secure authentication and account management system",
  keywords: ["authentication", "login", "signup", "account", "security", "2fa"],
  authors: [{ name: config.companyName || config.appName }],
  creator: config.companyName || config.appName,
  metadataBase: new URL(config.backendUrl),
  openGraph: {
    type: "website",
    title: config.appName,
    description: "Secure authentication and account management system",
    siteName: config.appName,
  },
  twitter: {
    card: "summary",
    title: config.appName,
    description: "Secure authentication and account management system",
  },
  robots: {
    index: false, // Auth pages shouldn't be indexed
    follow: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
          {/* @ts-ignore - AuthProvider types issue with Next.js 13+ */}
          <AuthProvider
            client={authClient}
            autoLoadSession
            prefetchAccountData
          >
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}