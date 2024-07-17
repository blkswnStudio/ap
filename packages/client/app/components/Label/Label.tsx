import { Box, Typography } from '@mui/material';
import { PropsWithChildren } from 'react';

type Props = {
  variant: 'success' | 'error' | 'info' | 'none';
  fixedWidth?: boolean;
};

function Label({ variant, fixedWidth = true, children }: PropsWithChildren<Props>) {
  switch (variant) {
    case 'success':
      return (
        <div style={{ display: 'inline-block' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'success.background',
              padding: '6px',
              borderRadius: '3px',
              width: fixedWidth ? '50px' : 'auto',
            }}
          >
            <Typography variant="titleAlternate" color="success.main">
              {children}
            </Typography>
          </Box>
        </div>
      );
    case 'error':
      return (
        <div style={{ display: 'inline-block' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'error.background',
              padding: '6px',
              borderRadius: '3px',
              width: fixedWidth ? '50px' : 'auto',
            }}
          >
            <Typography variant="titleAlternate" color="error.main">
              {children}
            </Typography>
          </Box>
        </div>
      );
    case 'info':
      return (
        <div style={{ display: 'inline-block' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'info.background',
              padding: '6px',
              borderRadius: '3px',
              width: fixedWidth ? '50px' : 'auto',
            }}
          >
            <Typography variant="titleAlternate" color="info.main">
              {children}
            </Typography>
          </Box>
        </div>
      );
    case 'none':
      return (
        <div style={{ display: 'inline-block' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'background.emphasis',
              padding: '6px 4px',
              borderRadius: '3px',
              width: fixedWidth ? '50px' : 'auto',
            }}
          >
            <Typography variant="titleAlternate">{children}</Typography>
          </Box>
        </div>
      );

    default:
      const _: never = variant;
  }
}

export default Label;
