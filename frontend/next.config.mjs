import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const skipBuildValidation = process.env.SKIP_BUILD_VALIDATION === "true";
const outputMode = process.env.NEXT_OUTPUT_MODE;

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: outputMode === "standalone" ? "standalone" : undefined,
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
