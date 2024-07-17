import { Button, Typography } from '@mui/material';
import ApollonLogo from '../components/Icons/ApollonLogo';

function DeviceFallbackPage() {
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
        Your device is not yet supported.
      </Typography>

      <Typography
        variant="titleAlternate"
        fontWeight={400}
        fontSize={17}
        sx={{ maxWidth: '80vw' }}
        lineHeight={1.5}
        textAlign="center"
      >
        As of now the application is only providing a desktop experience. Please visit us again from your desktop
        computer or laptop or extend your browser window for an uncircumsized experience.
      </Typography>

      <Button
        sx={{ width: 170, borderColor: 'primary.contrastText', mt: '30px' }}
        variant="outlined"
        onClick={() => window.location.replace('/')}
      >
        Go Home
      </Button>
    </div>
  );
}

export default DeviceFallbackPage;
