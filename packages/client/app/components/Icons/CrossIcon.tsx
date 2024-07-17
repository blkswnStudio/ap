import CloseIcon from '@mui/icons-material/Close';
import { useTheme } from '@mui/material';

function CrossIcon() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return isDarkMode ? (
    <CloseIcon
      sx={{
        color: '#64616D',
      }}
    />
  ) : (
    <CloseIcon
      sx={{
        color: '#696969',
      }}
    />
  );
}

export default CrossIcon;
