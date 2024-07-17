import { createContext, useContext } from 'react';

export const ErrorMonitoringContext = createContext<{
  Sentry: any;
}>({
  Sentry: undefined,
});

export function useErrorMonitoring(): {
  Sentry: any;
} {
  const context = useContext(ErrorMonitoringContext);
  if (context === undefined) {
    throw new Error('useErrorMonitoring must be used within an ErrorMonitoringContext');
  }
  return context;
}
