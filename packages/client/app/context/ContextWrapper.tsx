'use client';

import { PaletteMode } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import { feedbackIntegration } from '@sentry/nextjs';
import { SnackbarProvider } from 'notistack';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { ThemeModeLocalStorageKey } from '../components/Buttons/ThemeSwitch';
import MockServer from '../components/MockServer';
import NavigationBar from '../components/NavigationBar/NavigationBar';
import buildTheme from '../theme';
import { getAllowance, getDynamicSwapFee } from '../utils/crypto';
import { CustomApolloProvider } from './CustomApolloProvider';
import DeviceFallbackController from './DeviceFallbackController';
import ErrorMonitoringProvider from './ErrorMonitoringProvider';
import EthersProvider from './EthersProvider';
import SelectedTokenProvider from './SelectedTokenProvider';
import TransactionDialogProvider from './TransactionDialogProvider';
import UtilityProvider from './UtilityProvider';

function ContextWrapper({ children }: PropsWithChildren<{}>) {
  // The initial mode will be taken from LS or from the browser if the user didnt select any before.
  const [themeMode, setTheme] = useState<PaletteMode>('dark');

  const setThemeMode = (theme: PaletteMode) => {
    document.body.classList.remove(themeMode);
    document.body.classList.add(theme);

    setTheme(theme);
    if (process.env.NEXT_PUBLIC_ENVIRONMENT === 'staging') {
      const feedback = feedbackIntegration({ colorScheme: theme, autoInject: true, showBranding: false });
      feedback.setupOnce();
    }
  };

  // TODO: Use this in case of caching ressources
  // useEffect(() => {
  //   if ('serviceWorker' in navigator) {
  //     navigator.serviceWorker.register('/service-worker.js')
  //       .then((registration) => {
  //         console.log('Service Worker registered with scope:', registration.scope);

  //       })
  //       .catch((error) => {
  //         console.error('Service Worker registration failed:', error);
  //       });
  //   }
  // }, []);

  // FIXME: Cant access LS in useState initializer because of page pre-rendering.
  useEffect(() => {
    const storedThemeMode = localStorage.getItem(ThemeModeLocalStorageKey) as PaletteMode | null;

    if (storedThemeMode) {
      setThemeMode(storedThemeMode);
    } else {
      setThemeMode(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);

  return (
    <ErrorMonitoringProvider>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <CssBaseline enableColorScheme />

          <DeviceFallbackController>
            <MockServer>
              <EthersProvider>
                <CustomApolloProvider>
                  <UtilityProvider getDynamicSwapFeeOverride={getDynamicSwapFee} getAllowanceOverride={getAllowance}>
                    <NavigationBar themeMode={themeMode} setThemeMode={setThemeMode} />

                    <SelectedTokenProvider>
                      <TransactionDialogProvider>{children}</TransactionDialogProvider>
                    </SelectedTokenProvider>
                  </UtilityProvider>
                </CustomApolloProvider>
              </EthersProvider>
            </MockServer>
          </DeviceFallbackController>
        </SnackbarProvider>
      </ThemeProvider>
    </ErrorMonitoringProvider>
  );
}

export default ContextWrapper;
