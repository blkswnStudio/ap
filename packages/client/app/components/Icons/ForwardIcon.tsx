import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useTheme } from '@mui/material';

function ForwardIcon({ fontSize = '18px' }: { fontSize?: string }) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return <ArrowForwardIosIcon sx={{ color: isDarkMode ? '#46434F' : '#AEAEAE', fontSize }} />;
}

export default ForwardIcon;
