import { useTheme } from '@mui/material';

function InfoIcon() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return isDarkMode ? (
    <img
      src="assets/svgs/Info_dark.svg"
      alt="an lower case i info icon with a rounded square"
      height="16"
      typeof="image/svg+xml"
    />
  ) : (
    <img
      src="assets/svgs/Info_light.svg"
      alt="an lower case i info icon with a rounded square"
      height="16"
      typeof="image/svg+xml"
    />
  );
}

export default InfoIcon;
