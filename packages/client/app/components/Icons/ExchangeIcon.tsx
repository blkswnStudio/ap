import { useTheme } from '@mui/material';
import { CSSProperties } from 'react';

type Props = {
  style?: CSSProperties;
};

function ExchangeIcon({ style }: Props) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return isDarkMode ? (
    <img
      src="assets/svgs/Exchange.svg"
      alt="Arrow indicating trading direction"
      height="21"
      typeof="image/svg+xml"
      style={style}
    />
  ) : (
    <img
      src="assets/svgs/Exchange_light.svg"
      alt="Arrow indicating trading direction"
      height="21"
      typeof="image/svg+xml"
      style={style}
    />
  );
}

export default ExchangeIcon;
