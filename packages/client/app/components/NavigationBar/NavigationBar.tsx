'use client';

import { PaletteMode, Tab, Tabs, Typography } from '@mui/material';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SyntheticEvent, useState } from 'react';
import ThemeSwitch from '../Buttons/ThemeSwitch';
import ApollonLogo from '../Icons/ApollonLogo';
import EthersAddressLabel from '../Label/EthersAddressLabel/EthersAddressLabel';
import VersionLabel from '../Label/VersionLabel';
import TCRChip from '../TCRChip/TCRChip';

export const ROUTES = ['/balance', '/spot', '/pools', '/'];

type Props = {
  themeMode: PaletteMode;
  setThemeMode: (theme: PaletteMode) => void;
};

function NavigationBar({ themeMode, setThemeMode }: Props) {
  const pathname = usePathname();
  const [tabValue, setTabValue] = useState<'/balance' | '/spot' | '/pools'>(() =>
    pathname !== '/' ? (pathname as any) : '/spot',
  );

  const handleChange = (_: SyntheticEvent, newValue: '/balance' | '/spot' | '/pools') => {
    setTabValue(newValue);
  };

  return (
    <AppBar sx={{ height: 48, boxShadow: 'none' }} position="sticky">
      <Toolbar
        style={{
          minHeight: '48px',
        }}
        sx={{
          backgroundColor: 'background.default',
          borderBottom: '1px solid',
          borderBottomColor: 'background.paper',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="apollon-navigation-bar" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/" style={{ height: 30 }}>
              <ApollonLogo />
            </Link>
            <Tabs
              value={tabValue}
              onChange={handleChange}
              sx={{
                '.MuiTabs-flexContainer': { border: 'none' },
              }}
            >
              <Tab
                sx={{ p: 0 }}
                LinkComponent={Link}
                href="/balance"
                label={
                  <Typography
                    sx={{
                      padding: '12px 16px',
                    }}
                    variant={pathname === '/balance' ? 'body1' : 'subtitle2'}
                    fontFamily="Space Grotesk Variable"
                  >
                    Balance
                  </Typography>
                }
                value="/balance"
                disableRipple
              />
              <Tab
                sx={{ p: 0 }}
                LinkComponent={Link}
                href="/spot"
                label={
                  <Typography
                    variant={pathname === '/spot' ? 'body1' : 'subtitle2'}
                    fontFamily="Space Grotesk Variable"
                    sx={{
                      padding: '12px 16px',
                    }}
                  >
                    Spot
                  </Typography>
                }
                value="/spot"
                disableRipple
              />
              <Tab
                LinkComponent={Link}
                href="/pools"
                sx={{ p: 0 }}
                label={
                  <Typography
                    sx={{
                      padding: '12px 16px',
                    }}
                    variant={pathname === '/pools' ? 'body1' : 'subtitle2'}
                    fontFamily="Space Grotesk Variable"
                  >
                    Pools
                  </Typography>
                }
                value="/pools"
                disableRipple
              />
            </Tabs>

            <VersionLabel />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <EthersAddressLabel />

            <TCRChip />

            {/* Moved to Web3Modal instead */}
            {/* <NetworkSwitch /> */}

            <ThemeSwitch themeMode={themeMode} setThemeMode={setThemeMode} />
          </div>
        </div>
      </Toolbar>
    </AppBar>
  );
}
export default NavigationBar;
