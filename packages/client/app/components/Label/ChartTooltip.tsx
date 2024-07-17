import { Typography, useTheme } from '@mui/material';
import { formatUnixTimestamp } from '../../utils/date';

type Props = {
  active: boolean;
  payload: { payload: { timestamp: number; value: number; label: string } }[];
};

export default function ChartTooltip({ active, payload }: Props) {
  const theme = useTheme();

  if (active) {
    return (
      <div
        style={{
          backgroundColor: theme.palette.background.default,
          padding: '10px',
          borderRadius: '8px',
          fontFamily: 'Inter Variable',
        }}
      >
        <Typography variant="body2">
          {`${formatUnixTimestamp(payload[0].payload.timestamp.toString(), false, false)}: `}

          <strong style={{ textDecoration: 'underline' }}>{payload[0].payload.label}</strong>
        </Typography>
      </div>
    );
  } else {
    return null;
  }
}
