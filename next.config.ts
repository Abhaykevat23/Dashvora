import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent heavy server-side native modules from being bundled
  serverExternalPackages: ['bcryptjs', 'pg', 'mysql2', 'nodemailer', 'playwright'],

  // Optimize barrel-file imports — Turbopack only bundles what's actually used
  // This is the biggest win: lucide-react ships 1500+ icons as a barrel file
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
    ],
  },
};

export default nextConfig;
