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
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { GetDebtTokensQuery, GetDebtTokensQueryVariables } from '../../../generated/gql-types';
import { GET_ALL_DEBT_TOKENS } from '../../../queries';
import { standardDataPollInterval } from '../../../utils/constants';
import {
  bigIntStringToFloat,
  displayPercentage,
  percentageChange,
  roundCurrency,
  stdFormatter,
} from '../../../utils/math';
import FeatureBox from '../../FeatureBox/FeatureBox';
import DirectionIcon from '../../Icons/DirectionIcon';
import Label from '../../Label/Label';
import HeaderCell from '../../Table/HeaderCell';
import TreasuryTableLoader from './TreasuryTableLoader';

function TreasuryTable() {
  const { enqueueSnackbar } = useSnackbar();

  const { Sentry } = useErrorMonitoring();

  const { data } = useQuery<GetDebtTokensQuery, GetDebtTokensQueryVariables>(GET_ALL_DEBT_TOKENS, {
    pollInterval: standardDataPollInterval,
    onError: (error) => {
      enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
      Sentry.captureException(error);
    },
  });

  if (!data) return <TreasuryTableLoader />;

  const debtTokensInReserve = data.debtTokenMetas
    .map((debtToken) => ({
      ...debtToken,
      totalReserve: bigIntStringToFloat(debtToken.totalReserve),
      totalSupplyUSD: bigIntStringToFloat(debtToken.totalSupplyUSD),
      totalReserve30dAverage: debtToken.totalReserve30dAverage
        ? {
            ...debtToken.totalReserve30dAverage,
            value: bigIntStringToFloat(debtToken.totalReserve30dAverage.value),
          }
        : null,
    }))
    .filter(({ totalReserve }) => totalReserve > 0);

  return (
    <FeatureBox title="Treasury" noPadding border="full" borderRadius>
      <TableContainer>
        <Table data-testid="apollon-treasury-table">
          <TableHead>
            <TableRow>
              <HeaderCell title="Deposited Token" cellProps={{ colSpan: 2, align: 'right' }} />
              <HeaderCell title="Difference from 30d average" cellProps={{ colSpan: 2, align: 'right' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {debtTokensInReserve.map(({ token, totalReserve, totalReserve30dAverage }, index) => (
              <TableRow hover key={token.address}>
                <TableCell
                  align="right"
                  sx={{ borderBottom: index === debtTokensInReserve.length - 1 ? 'none' : '', pr: 0 }}
                >
                  {stdFormatter.format(totalReserve)}
                </TableCell>
                <TableCell width={50} sx={{ borderBottom: index === debtTokensInReserve.length - 1 ? 'none' : '' }}>
                  <Label variant="none">{token.symbol}</Label>
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ borderBottom: index === debtTokensInReserve.length - 1 ? 'none' : '', pr: 0 }}
                >
                  {roundCurrency(totalReserve - totalReserve30dAverage!.value)}
                </TableCell>
                <TableCell width={125} sx={{ borderBottom: index === debtTokensInReserve.length - 1 ? 'none' : '' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography
                      fontWeight={400}
                      color={
                        percentageChange(totalReserve, totalReserve30dAverage!.value) > 0
                          ? 'success.main'
                          : 'error.main'
                      }
                    >
                      {displayPercentage(percentageChange(totalReserve, totalReserve30dAverage!.value), 'positive')}
                    </Typography>

                    <DirectionIcon showIncrease={percentageChange(totalReserve, totalReserve30dAverage!.value) > 0} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </FeatureBox>
  );
}

export default TreasuryTable;
