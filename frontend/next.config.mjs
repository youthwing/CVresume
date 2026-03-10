import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const skipBuildValidation = process.env.SKIP_BUILD_VALIDATION === "true";

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: false
  },
  eslint: {
    ignoreDuringBuilds: skipBuildValidation
  },
  typescript: {
    ignoreBuildErrors: skipBuildValidation
  }
};

export default withNextIntl(nextConfig);
