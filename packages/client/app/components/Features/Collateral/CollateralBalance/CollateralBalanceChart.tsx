import { useQuery } from '@apollo/client';
import { Box, Typography, useTheme } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip } from 'recharts';
import { useErrorMonitoring } from '../../../../context/ErrorMonitoringContext';
import { GetCollateralUsdHistoryQuery, GetCollateralUsdHistoryQueryVariables } from '../../../../generated/gql-types';
import { GET_COLLATERAL_USD_HISTORY } from '../../../../queries';
import { DARK_BACKGROUND_EMPHASIS, LIGHT_BACKGROUND_EMPHASIS } from '../../../../theme';
import { standardDataPollInterval } from '../../../../utils/constants';
import { bigIntStringToFloat, roundCurrency, stdFormatter } from '../../../../utils/math';
import ChartTooltip from '../../../Label/ChartTooltip';
import DiagramPlaceholder from '../../../Loader/DiagramPlaceholder';

function CollateralBalanceChart() {
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();

  const { Sentry } = useErrorMonitoring();

  const isDarkMode = theme.palette.mode === 'dark';

  const { data } = useQuery<GetCollateralUsdHistoryQuery, GetCollateralUsdHistoryQueryVariables>(
    GET_COLLATERAL_USD_HISTORY,
    {
      pollInterval: standardDataPollInterval,
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  const chartData = useMemo(() => {
    return (
      data?.totalValueLockedUSDHistoryChunks.map(({ timestamp, value }) => ({
        timestamp: Number(timestamp),
        value: bigIntStringToFloat(value),
        label: `${roundCurrency(bigIntStringToFloat(value))} $`,
      })) ?? []
    );
  }, [data]);

  if (chartData.length === 0) return <DiagramPlaceholder />;

  const totalValueLocked = chartData[chartData.length - 1].value;

  return (
    <Box sx={{ backgroundColor: 'table.border' }}>
      <LineChart width={320} height={190} data={chartData}>
        {/* @ts-ignore */}
        <Tooltip content={<ChartTooltip />} />

        <CartesianGrid stroke={isDarkMode ? DARK_BACKGROUND_EMPHASIS : LIGHT_BACKGROUND_EMPHASIS} />

        <Line type="linear" dataKey="value" stroke={theme.palette.info.main} dot={false} isAnimationActive={false} />
      </LineChart>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5, pt: 0.5, pb: 1, px: 2 }}>
        <Typography variant="titleAlternate" color="info.main">
          ≈ {stdFormatter.format(totalValueLocked)}
        </Typography>

        <Typography variant="titleAlternate">$</Typography>
      </Box>
    </Box>
  );
}

export default CollateralBalanceChart;
