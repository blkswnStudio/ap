/** @type {import('next').NextConfig} */
const nextConfig = {
  // For now we are creating a SPA without performance feature of Next.
  // This comes with some limitations: https://nextjs.org/docs/pages/building-your-application/deploying/static-exports
  // Once we migrate change MUI integration: https://mui.com/material-ui/guides/nextjs/
  // Can not define a runTime config as this is a static export
  output: 'export',
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
};

// Injected content via Sentry wizard below

const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(
  nextConfig,
  {
    // For all available options, see:
    // https://github.com/getsentry/sentry-webpack-plugin#options

    org: 'blkswn-studio',
    project: 'apollon-client',
  },
  {
    // For all available options, see:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Transpiles SDK to be compatible with IE11 (increases bundle size)
    transpileClientSDK: false,

    // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
    // The Sentry Next.js SDK `tunnelRoute` option will not work in combination with Next.js static exports. The `tunnelRoute` option uses serverside features that cannot be accessed in export mode. If you still want to tunnel Sentry events, set up your own tunnel: https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
    // tunnelRoute: "/monitoring",

    // Hides source maps from generated client bundles
    hideSourceMaps:
      process.env.NEXT_PUBLIC_ENVIRONMENT !== 'development' || process.env.NEXT_PUBLIC_ENVIRONMENT !== 'staging',

    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: true,

    // Enables automatic instrumentation of Vercel Cron Monitors.
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,
  },
);
