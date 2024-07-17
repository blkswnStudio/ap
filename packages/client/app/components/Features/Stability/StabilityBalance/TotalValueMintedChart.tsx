import { useQuery } from '@apollo/client';
import { Box, Typography, useTheme } from '@mui/material';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip } from 'recharts';
import { GetDebtUsdHistoryQuery, GetDebtUsdHistoryQueryVariables } from '../../../../generated/gql-types';
import { GET_DEBT_USD_HISTORY } from '../../../../queries';
import { DARK_BACKGROUND_EMPHASIS, LIGHT_BACKGROUND_EMPHASIS } from '../../../../theme';
import { standardDataPollInterval } from '../../../../utils/contants';
import { bigIntStringToFloat, roundCurrency, stdFormatter } from '../../../../utils/math';
import ChartTooltip from '../../../Label/ChartTooltip';
import DiagramPlaceholder from '../../../Loader/DiagramPlaceholder';

function TotalValueMintedChart() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const { data } = useQuery<GetDebtUsdHistoryQuery, GetDebtUsdHistoryQueryVariables>(GET_DEBT_USD_HISTORY, {
    pollInterval: standardDataPollInterval,
  });

  const chartData = useMemo(() => {
    return (
      data?.totalValueMintedUSDHistoryChunks.map(({ timestamp, value }) => ({
        timestamp: Number(timestamp),
        value: bigIntStringToFloat(value),
        label: `${roundCurrency(bigIntStringToFloat(value))} $`,
      })) ?? []
    );
  }, [data]);

  if (chartData.length === 0) return <DiagramPlaceholder />;

  const totalValueMintedChart = chartData[chartData.length - 1].value;

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
          ≈ {stdFormatter.format(totalValueMintedChart)}
        </Typography>

        <Typography variant="titleAlternate">$</Typography>
      </Box>
    </Box>
  );
}

export default TotalValueMintedChart;
