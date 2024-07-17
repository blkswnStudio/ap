import { useTheme } from '@mui/material';

type Props = {
  isFavorite: boolean;
};

function PinnedIcon({ isFavorite }: Props) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  if (isDarkMode) {
    return isFavorite ? (
      <img
        src="assets/svgs/Pinned_active.svg"
        alt="a white pin icon with a transparent body"
        height="17"
        width="15.6"
        typeof="image/svg+xml"
      />
    ) : (
      <img
        src="assets/svgs/Pinned_inactive.svg"
        alt="a grey pin icon with a transparent body"
        height="17"
        width="15.6"
        typeof="image/svg+xml"
      />
    );
  }

  return isFavorite ? (
    <img
      src="assets/svgs/Pinned_active_light.svg"
      alt="a grey pin icon with a transparent body"
      height="17"
      width="15.6"
      typeof="image/svg+xml"
    />
  ) : (
    <img
      src="assets/svgs/Pinned_inactive_light.svg"
      alt="a grey pin icon with a transparent body"
      height="17"
      width="15.6"
      typeof="image/svg+xml"
    />
  );
}

export default PinnedIcon;
