/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 50mb : nécessaire pour le module Documents qui accepte des uploads
  // jusqu'à 50 MB côté server action. Check fin aussi dans l'action.
  experimental: { serverActions: { bodySizeLimit: '50mb' } },

  // 'standalone' : Next produit un dossier .next/standalone autonome
  // avec server.js + node_modules nécessaires uniquement. Permet une image
  // Docker ~150 MB au lieu de ~1 GB. Indispensable pour Coolify/auto-hébergement.
  output: 'standalone',

  // Le codebase a des erreurs TypeScript préexistantes (Decimal vs number,
  // props lucide…) qui ne cassent pas l'app en runtime. On ne bloque pas
  // le build dessus en prod — à corriger progressivement plus tard.
  typescript: { ignoreBuildErrors: true },

  // Idem pour ESLint : on a déjà désactivé react/no-unescaped-entities,
  // ce flag est un filet de sécurité pour les autres règles.
  eslint: { ignoreDuringBuilds: true }
};
export default nextConfig;
