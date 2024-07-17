import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Typography, useTheme } from '@mui/material';

type Props = {
  fullWidth?: boolean;
};

function DiagramPlaceholder({ fullWidth = false }: Props) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <div
      style={{
        background: isDarkMode ? '#1e1b27' : '#f8f8f8',
        height: '216px',
        width: fullWidth ? '100%' : '320px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          border: `2px solid ${isDarkMode ? '#3C3945' : '#CBCBCB'}`,
          backgroundColor: isDarkMode ? '#282531' : '#ECECEC',
          borderRadius: 5,
          padding: '3px 10px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <InfoOutlinedIcon sx={{ marginRight: '3px' }} color="primary" fontSize="small" />
        <Typography variant="titleAlternate">No Data to Show</Typography>
      </div>
    </div>
  );
}

export default DiagramPlaceholder;
