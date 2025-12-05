/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    optimizeCss: true,
    serverActions: true,
  },

  webpack: (config) => {
    // Enable WebAssembly for physics engines / Three.js extensions
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    return config;
  },
};

export default nextConfig;
