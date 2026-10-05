/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['@barber/shared'],
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
