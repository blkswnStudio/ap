import { useQuery } from '@apollo/client';
import { Box, Typography, useTheme } from '@mui/material';
import { parseEther } from 'ethers';
import { useSnackbar } from 'notistack';
import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip } from 'recharts';
import { useErrorMonitoring } from '../../../../context/ErrorMonitoringContext';
import {
  GetCollateralUsdHistoryQuery,
  GetCollateralUsdHistoryQueryVariables,
  GetDebtUsdHistoryQuery,
  GetDebtUsdHistoryQueryVariables,
} from '../../../../generated/gql-types';
import { GET_COLLATERAL_USD_HISTORY, GET_DEBT_USD_HISTORY } from '../../../../queries';
import { DARK_BACKGROUND_EMPHASIS, LIGHT_BACKGROUND_EMPHASIS } from '../../../../theme';
import { bigIntStringToFloat, displayPercentage, stdFormatter } from '../../../../utils/math';
import ChartTooltip from '../../../Label/ChartTooltip';
import DiagramPlaceholder from '../../../Loader/DiagramPlaceholder';

function SystemCollateralRatioChart() {
  const { enqueueSnackbar } = useSnackbar();

  const { Sentry } = useErrorMonitoring();
  const theme = useTheme();

  const isDarkMode = theme.palette.mode === 'dark';

  const { data: collateralLockedData } = useQuery<GetCollateralUsdHistoryQuery, GetCollateralUsdHistoryQueryVariables>(
    GET_COLLATERAL_USD_HISTORY,
    {
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  const { data: debtMintedData } = useQuery<GetDebtUsdHistoryQuery, GetDebtUsdHistoryQueryVariables>(
    GET_DEBT_USD_HISTORY,
    {
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  const chartData = useMemo(() => {
    return debtMintedData && collateralLockedData
      ? collateralLockedData.totalValueLockedUSDHistoryChunks.map(({ timestamp, value: collateralLocked }, index) => {
          // When there isnt a daily value for minted yet use the value from last day or nothing.
          const valueMinted =
            debtMintedData.totalValueMintedUSDHistoryChunks[index]?.value ??
            debtMintedData.totalValueMintedUSDHistoryChunks[debtMintedData.totalValueMintedUSDHistoryChunks.length - 1]
              ?.value ??
            parseEther('1').toString();

          const delta = bigIntStringToFloat(collateralLocked) / bigIntStringToFloat(valueMinted);
          return {
            timestamp: Number(timestamp),
            value: isNaN(delta) ? 0 : delta * 100,
            label: displayPercentage(delta),
          };
        })
      : [];
  }, [collateralLockedData, debtMintedData]);

  if (chartData.length === 0) return <DiagramPlaceholder />;

  const systemCollateralRatio = chartData[chartData.length - 1].value;

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
          {stdFormatter.format(systemCollateralRatio)}
        </Typography>

        <Typography variant="titleAlternate">%</Typography>
      </Box>
    </Box>
  );
}

export default SystemCollateralRatioChart;
