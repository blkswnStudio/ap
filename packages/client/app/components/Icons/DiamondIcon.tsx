import { useTheme } from '@mui/material';

type Props = {
  isDialog?: boolean;
};

function DiamondIcon({ isDialog = false }: Props) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  if (isDialog) {
    return (
      <img src="assets/svgs/Star24_grey.svg" alt="Gray colored diamond shape" height="11" typeof="image/svg+xml" />
    );
  }

  return isDarkMode ? (
    <img src="assets/svgs/Star24_white.svg" alt="White colored diamond shape" height="11" typeof="image/svg+xml" />
  ) : (
    <img src="assets/svgs/Star24_black.svg" alt="Black colored diamond shape" height="11" typeof="image/svg+xml" />
  );
}

export default DiamondIcon;
