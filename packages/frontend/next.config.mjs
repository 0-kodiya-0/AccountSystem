/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    experimental: {
        // Enable server components
        serverComponentsExternalPackages: []
    },
    env: {
        // Expose environment variables to the client
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
        NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
        NEXT_PUBLIC_HOME_URL: process.env.NEXT_PUBLIC_HOME_URL,
        NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
    },
    async redirects() {
        return [
            {
                source: '/',
                destination: '/auth/redirect',
                permanent: false,
            },
        ]
    },
    // Enable static generation for auth pages
    trailingSlash: false,
    poweredByHeader: false,
    compress: true,

    // Image optimization
    images: {
        domains: ['lh3.googleusercontent.com', 'graph.microsoft.com'],
        formats: ['image/webp', 'image/avif'],
    },

    // Security headers
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                ],
            },
        ]
    },
}

export default nextConfig;
