'use client';

import { useQuery } from '@apollo/client';
import { Typography } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useSnackbar } from 'notistack';
import { isDebtTokenAddress } from '../../../../../config';
import { useErrorMonitoring } from '../../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../../context/EthersProvider';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
} from '../../../../generated/gql-types';
import { GET_BORROWER_COLLATERAL_TOKENS } from '../../../../queries';
import { standardDataPollInterval } from '../../../../utils/constants';
import {
  bigIntStringToFloat,
  dangerouslyConvertBigIntToNumber,
  displayPercentage,
  percentageChange,
  roundCurrency,
  stdFormatter,
} from '../../../../utils/math';
import FeatureBox from '../../../FeatureBox/FeatureBox';
import DirectionIcon from '../../../Icons/DirectionIcon';
import Label from '../../../Label/Label';
import HeaderCell from '../../../Table/HeaderCell';
import CloseTroveDialog from '../CloseTroveDialog';
import CollateralUpdateDialog from '../CollateralUpdateDialog';
import SeedCollateral from '../SeedCollateral';
import CollateralTokenTableLoader from './CollateralTokenTableLoader';

const CollateralTokenTable = () => {
  const { enqueueSnackbar } = useSnackbar();

  const { address } = useEthers();
  const { Sentry } = useErrorMonitoring();

  const { data } = useQuery<GetBorrowerCollateralTokensQuery, GetBorrowerCollateralTokensQueryVariables>(
    GET_BORROWER_COLLATERAL_TOKENS,
    {
      variables: {
        borrower: address,
      },
      pollInterval: standardDataPollInterval,
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  if (!data) {
    return <CollateralTokenTableLoader />;
  }

  return (
    <FeatureBox title="Collateral Token" noPadding border="full" borderRadius>
      <div>
        <TableContainer>
          <Table size="small" data-testid="apollon-collateral-token-table">
            <TableHead>
              <TableRow>
                <HeaderCell title="Wallet" cellProps={{ align: 'right', sx: { borderRight: '1px solid' } }} />
                <HeaderCell title="Your Trove" cellProps={{ align: 'right', sx: { borderRight: '1px solid' } }} />
                <HeaderCell title="Token" />
                <HeaderCell
                  title="Minimal CR"
                  cellProps={{ align: 'right' }}
                  tooltipProps={{ title: 'Describes the minimal collateral ratio per collateral token.' }}
                />
                <HeaderCell
                  title="TVL"
                  cellProps={{ align: 'right', colSpan: 2 }}
                  tooltipProps={{ title: 'Total value locked, relative change based on 30d average.' }}
                />
              </TableRow>
            </TableHead>
            <TableBody>
              {[...data.collateralTokenMetas]
                .sort(({ token }) => (!isDebtTokenAddress(token.address) ? -1 : 1))
                .map((collToken) => ({
                  ...collToken,
                  totalValueLockedUSD: bigIntStringToFloat(collToken.totalValueLockedUSD),
                  totalValueLockedUSD30dAverage: bigIntStringToFloat(collToken.totalValueLockedUSD30dAverage.value),
                }))
                .map(
                  ({
                    token,
                    totalValueLockedUSD,
                    totalValueLockedUSD30dAverage,
                    troveLockedAmount,
                    walletAmount,
                    supportedCollateralRatio,
                  }) => (
                    <TableRow hover key={token.address}>
                      <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'table.border' }}>
                        {roundCurrency(dangerouslyConvertBigIntToNumber(walletAmount, token.decimals - 6, 6), 5, 5)}
                      </TableCell>
                      <TableCell align="right" sx={{ borderRight: '1px solid', borderColor: 'table.border' }}>
                        {roundCurrency(
                          dangerouslyConvertBigIntToNumber(troveLockedAmount, token.decimals - 6, 6),
                          5,
                          5,
                        )}
                      </TableCell>
                      <TableCell>
                        <Label variant="none">{token.symbol}</Label>
                      </TableCell>
                      <TableCell align="right">
                        {displayPercentage(bigIntStringToFloat(supportedCollateralRatio), 'positive')}
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 0 }}>
                        {stdFormatter.format(totalValueLockedUSD)} $
                      </TableCell>
                      <TableCell width={125}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography
                            fontWeight={400}
                            color={
                              percentageChange(totalValueLockedUSD, totalValueLockedUSD30dAverage) > 0
                                ? 'success.main'
                                : 'error.main'
                            }
                          >
                            {displayPercentage(
                              percentageChange(totalValueLockedUSD, totalValueLockedUSD30dAverage),
                              'positive',
                            )}
                          </Typography>
                          <DirectionIcon
                            showIncrease={percentageChange(totalValueLockedUSD, totalValueLockedUSD30dAverage) > 0}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ),
                )}

              <TableRow>
                <TableCell
                  sx={{ borderBottom: 'none', borderRight: '1px solid', borderColor: 'table.border', padding: '2px' }}
                >
                  <SeedCollateral />
                </TableCell>
                <TableCell
                  sx={{ borderBottom: 'none', borderRight: '1px solid', borderColor: 'table.border', padding: '2px' }}
                >
                  <CollateralUpdateDialog buttonVariant="text" buttonSx={{ p: '6px 8px', width: '100%' }} />
                </TableCell>
                <TableCell style={{ borderBottom: 'none', padding: '2px' }} colSpan={4} align="center">
                  <CloseTroveDialog buttonVariant="text" buttonSx={{ p: '6px 8px', width: '100%' }} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </FeatureBox>
  );
};

export default CollateralTokenTable;
