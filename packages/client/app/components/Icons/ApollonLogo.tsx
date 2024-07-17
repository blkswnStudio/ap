import { useTheme } from '@mui/material';

function ApollonLogo() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return isDarkMode ? (
    <img src="assets/svgs/Apollon_logo_negative.svg" alt="Apollon Logo" height="30" typeof="image/svg+xml" />
  ) : (
    <img src="assets/svgs/Apollon_logo_negative_light.svg" alt="Apollon Logo" height="30" typeof="image/svg+xml" />
  );
}

export default ApollonLogo;
