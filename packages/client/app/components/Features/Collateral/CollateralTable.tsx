import { useQuery } from '@apollo/client';
import { Box, Skeleton, useTheme } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { useCallback, useMemo, useState } from 'react';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
} from '../../../generated/gql-types';
import { GET_BORROWER_COLLATERAL_TOKENS } from '../../../queries';
import { standardDataPollInterval } from '../../../utils/constants';
import {
  bigIntStringToFloat,
  dangerouslyConvertBigIntToNumber,
  displayPercentage,
  roundCurrency,
  roundNumber,
} from '../../../utils/math';
import DiamondIcon from '../../Icons/DiamondIcon';
import Label from '../../Label/Label';
import HeaderCell from '../../Table/HeaderCell';
import CollateralPieVisualization from '../../Visualizations/CollateralPieVisualization';
import CollateralRatioVisualization from '../../Visualizations/CollateralRatioVisualization';
import CollateralTableLoader from './CollateralTableLoader';
import CollateralUpdateDialog from './CollateralUpdateDialog';

const generateColorPalette = (paletteLength: number) => {
  // Initialize an array with the first 3 fixed colors
  const colors = ['#3DD755', '#E04A4A', '#33B6FF'];

  // Add 5 well-matching colors
  const matchingColors = ['#FFA07A', '#8A2BE2', '#5F9EA0', '#D2691E', '#FFD700'];
  colors.push(...matchingColors);

  // Generate random colors for the remaining spots
  while (colors.length < paletteLength) {
    const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
    colors.push(randomColor);
  }

  // Slice the array to the desired length
  return colors.slice(0, paletteLength);
};

function CollateralTable() {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const { Sentry } = useErrorMonitoring();
  const { address } = useEthers();

  const [oldRatio, setOldRatio] = useState<null | number>(null);
  const [oldCriticalRatio, setOldCriticalRatio] = useState<null | number>(null);

  const { data } = useQuery<GetBorrowerCollateralTokensQuery, GetBorrowerCollateralTokensQueryVariables>(
    GET_BORROWER_COLLATERAL_TOKENS,
    {
      variables: { borrower: address },
      skip: !address,
      pollInterval: standardDataPollInterval,
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  const borrowerCollateralTokens = useMemo(() => {
    const colorPalette: string[] = data ? generateColorPalette(data.collateralTokenMetas.length) : [];
    return (
      data?.collateralTokenMetas
        .filter(({ troveLockedAmount, walletAmount }) => walletAmount! > 0 || troveLockedAmount! > 0)
        .map((token) => ({
          ...token,
          troveValueUSD: token.troveLockedAmount
            ? roundNumber(
                dangerouslyConvertBigIntToNumber(
                  token.troveLockedAmount * token.token.priceUSDOracle,
                  token.token.decimals + 18 - 6,
                  6,
                ),
              )
            : 0,
        }))
        .sort((a, b) => b.troveValueUSD - a.troveValueUSD)
        // need to assign the color after sorting
        .map((token) => ({
          ...token,
          chartColor: colorPalette.shift() as string,
        })) ?? []
    );
  }, [data]);

  const ratioChangeCallback = useCallback(
    (_: number, oldRatio: number, __: number, ___: number, oldCrititcalRatio: number) => {
      setOldRatio(oldRatio);
      setOldCriticalRatio(oldCrititcalRatio);
    },
    [setOldRatio],
  );

  return (
    <div style={{ display: 'flex' }}>
      <Box
        style={{
          width: '40%',
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: isDarkMode ? '#1e1b27' : '#f8f8f8',
        }}
      >
        <CollateralPieVisualization
          borrowerCollateralTokens={borrowerCollateralTokens.filter(({ troveLockedAmount }) => troveLockedAmount > 0)}
        />
      </Box>
      <Box sx={{ width: '100%', borderLeft: '1px solid', borderColor: 'table.border' }}>
        <div style={{ padding: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div>
                <Typography
                  sx={{ fontFamily: 'Space Grotesk Variable', color: 'info.main', fontWeight: '700', fontSize: '20px' }}
                >
                  {oldRatio !== null ? (
                    displayPercentage(oldRatio, 'default', 0)
                  ) : (
                    <Skeleton variant="text" width={50} />
                  )}
                </Typography>

                <Typography variant="shady">
                  {oldCriticalRatio !== null ? (
                    displayPercentage(oldCriticalRatio, 'default', 0)
                  ) : (
                    <Skeleton variant="text" width={50} />
                  )}
                </Typography>
              </div>

              <DiamondIcon />

              <div>
                <Typography variant="h4">Collateral Ratio</Typography>
                <Typography variant="shady" sx={{ position: 'relative', bottom: -2 }}>
                  Minimal Collateral Ratio
                </Typography>
              </div>
            </Box>

            <CollateralUpdateDialog buttonVariant="outlined" />
          </div>
          <CollateralRatioVisualization callback={ratioChangeCallback} />
        </div>

        {!data ? (
          <CollateralTableLoader />
        ) : (
          <TableContainer data-testid="apollon-collateral-table">
            <Table>
              <TableHead>
                <TableRow>
                  <HeaderCell title="Trove" cellProps={{ align: 'right' }} />
                  <HeaderCell title="Wallet" cellProps={{ align: 'right' }} />
                  <HeaderCell title="Symbol" />
                  <HeaderCell
                    title="Minimal CR"
                    cellProps={{ align: 'right' }}
                    tooltipProps={{ title: 'Describes the minimal collateral ratio per collateral token.' }}
                  />
                </TableRow>
              </TableHead>
              <TableBody>
                {borrowerCollateralTokens.map(
                  ({ token, walletAmount, troveLockedAmount, chartColor, supportedCollateralRatio }) => (
                    <TableRow hover key={token.address}>
                      <TableCell align="right">
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" fill="none">
                            <path
                              fill={chartColor}
                              d="M4 0a6.449 6.449 0 0 0 4 4 6.449 6.449 0 0 0-4 4 6.449 6.449 0 0 0-4-4 6.449 6.449 0 0 0 4-4Z"
                            />
                          </svg>
                          <Typography color="primary.contrastText" fontWeight={400}>
                            {roundCurrency(
                              dangerouslyConvertBigIntToNumber(troveLockedAmount!, token.decimals - 6, 6),
                              5,
                              5,
                            )}
                          </Typography>
                        </div>
                      </TableCell>
                      <TableCell align="right">
                        {roundCurrency(dangerouslyConvertBigIntToNumber(walletAmount!, token.decimals - 6, 6), 5, 5)}
                      </TableCell>
                      <TableCell>
                        <Label variant="none">{token.symbol}</Label>
                      </TableCell>
                      <TableCell align="right">
                        {displayPercentage(bigIntStringToFloat(supportedCollateralRatio), 'positive')}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </div>
  );
}

export default CollateralTable;
