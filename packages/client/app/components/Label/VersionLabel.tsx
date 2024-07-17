import { Typography } from '@mui/material';
import packageInfo from '../../../package.json';

function VersionLabel() {
  if (process.env.NEXT_PUBLIC_ENVIRONMENT !== 'staging') return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <img src="assets/svgs/Star24_green.svg" alt="Green colored diamond shape" height="11" typeof="image/svg+xml" />

      <Typography variant="titleAlternate">{`v${packageInfo.version} BETA`}</Typography>
    </div>
  );
}

export default VersionLabel;
