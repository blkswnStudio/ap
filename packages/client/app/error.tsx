'use client';

import { Button, Typography } from '@mui/material';
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import ApollonLogo from './components/Icons/ApollonLogo';

function Error(props: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(Error);
  }, [props.error]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 52px)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <ApollonLogo />
      </div>

      <img
        src="assets/svgs/client-side-error.svg"
        alt="A shape with circles, white diamonds and a big yellow diamond."
        height="332"
        typeof="image/svg+xml"
      />

      <Typography variant="h6" sx={{ mt: '50px', mb: '10px' }}>
        An error occurred.
      </Typography>

      <Typography variant="titleAlternate" fontWeight={400} fontSize={17}>
        We do our best, but something unexpected happened. You can try again now and we will investigate the issue as
        soon as possible.
      </Typography>

      <Button
        sx={{ width: 170, borderColor: 'primary.contrastText', mt: '30px' }}
        variant="outlined"
        onClick={props.reset}
      >
        Try again
      </Button>
    </div>
  );
}

export default Error;
