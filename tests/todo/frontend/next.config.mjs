/** @type {import('next').NextConfig} */
const nextConfig = {
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
