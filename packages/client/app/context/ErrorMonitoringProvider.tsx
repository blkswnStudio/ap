'use client';

import * as Sentry from '@sentry/nextjs';
import { ErrorMonitoringContext } from './ErrorMonitoringContext';

export default function ErrorMonitoringProvider({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <ErrorMonitoringContext.Provider
      value={{
        Sentry,
      }}
    >
      {children}
    </ErrorMonitoringContext.Provider>
  );
}
