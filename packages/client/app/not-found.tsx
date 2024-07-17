import { Button, Typography } from '@mui/material';
import Link from 'next/link';

function NotFound() {
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
      <img src="assets/svgs/404.svg" alt="Green colored diamond shape" height="332" typeof="image/svg+xml" />

      <Typography variant="h6" sx={{ mt: '50px', mb: '10px' }}>
        Nothing found
      </Typography>

      <Typography variant="titleAlternate" fontWeight={400} fontSize={17}>
        We do our best, but it seems something is missing.
      </Typography>

      <Button
        sx={{ width: 170, borderColor: 'primary.contrastText', mt: '30px' }}
        variant="outlined"
        href="/"
        LinkComponent={Link}
      >
        Go to Homepage
      </Button>
    </div>
  );
}

export default NotFound;
