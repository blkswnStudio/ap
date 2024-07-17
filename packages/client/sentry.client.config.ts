// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://852d1f75b75a686cadd6eef7b72d7d2a@o4506819436609536.ingest.sentry.io/4506819601301504',

  // Adjust this value in production, or use tracesSampler for greater control
  // We can not sample traces on the graph node as it doesnt allow specific headers
  // tracesSampleRate: 1,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT,

  replaysOnErrorSampleRate:
    process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging' || process.env.NEXT_PUBLIC_ENVIRONMENT === 'production' ? 1.0 : 0,

  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate:
    process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging' || process.env.NEXT_PUBLIC_ENVIRONMENT === 'production'
      ? 0.05
      : 0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: true,
    }),
    ...(process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging' || process.env.NEXT_PUBLIC_ENVIRONMENT === 'production'
      ? [new Sentry.BrowserTracing({ tracingOrigins: ['*'] })]
      : []),
    new Sentry.Integrations.Breadcrumbs({ console: true }),
  ],
});
