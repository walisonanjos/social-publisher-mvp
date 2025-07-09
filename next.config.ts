// next.config.ts

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Usando a configuração 'domains', que é mais simples que 'remotePatterns'
    domains: ['res.cloudinary.com', 'i.ytimg.com'],
  },
};

export default nextConfig;