'use client';

import { ThemeProvider } from '@emotion/react';
import { PaletteMode } from '@mui/material';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { ThemeModeLocalStorageKey } from '../components/Buttons/ThemeSwitch';
import buildTheme from '../theme';

function BaseThemeWrapper({ children }: PropsWithChildren) {
  // The initial mode will be taken from LS or from the browser if the user didnt select any before.
  const [themeMode, setTheme] = useState<PaletteMode>('dark');

  useEffect(() => {
    const storedThemeMode = localStorage.getItem(ThemeModeLocalStorageKey) as PaletteMode | null;

    if (storedThemeMode) {
      setTheme(storedThemeMode);
      document.body.classList.add(storedThemeMode);
    } else {
      const newThemeMode =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      setTheme(newThemeMode);

      document.body.classList.add(newThemeMode);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const theme = useMemo(() => buildTheme(themeMode), [themeMode]);

  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

export default BaseThemeWrapper;
