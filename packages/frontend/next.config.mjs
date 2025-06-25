/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    // Expose environment variables to the client
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_PROXY_PATH: process.env.NEXT_PUBLIC_PROXY_PATH,
    NEXT_PUBLIC_BACKEND_PROXY_PATH: process.env.NEXT_PUBLIC_BACKEND_PROXY_PATH,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_HOME_URL: process.env.NEXT_PUBLIC_HOME_URL,
  },
  basePath: '/account',

  // Image optimization
  images: {
    domains: ['lh3.googleusercontent.com', 'graph.microsoft.com'],
    formats: ['image/webp', 'image/avif'],
  },

  logging: {
    fetches: {
      fullUrl: true,
      hmrRefreshes: true,
    },
  },
};

export default nextConfig;
