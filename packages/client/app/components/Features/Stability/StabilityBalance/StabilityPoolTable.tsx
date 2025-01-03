import { useQuery } from '@apollo/client';
import { Button } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useSnackbar } from 'notistack';
import { useErrorMonitoring } from '../../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../../context/EthersProvider';
import { useTransactionDialog } from '../../../../context/TransactionDialogProvider';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
  GetBorrowerDebtTokensQuery,
  GetBorrowerDebtTokensQueryVariables,
} from '../../../../generated/gql-types';
import {
  GET_BORROWER_COLLATERAL_TOKENS,
  GET_BORROWER_DEBT_TOKENS,
  GET_BORROWER_STABILITY_HISTORY,
} from '../../../../queries';
import {
  dangerouslyConvertBigIntToNumber,
  displayPercentage,
  percentageChange,
  roundCurrency,
} from '../../../../utils/math';
import FeatureBox from '../../../FeatureBox/FeatureBox';
import Label from '../../../Label/Label';
import DiagramPlaceholder from '../../../Loader/DiagramPlaceholder';
import HeaderCell from '../../../Table/HeaderCell';
import StabilityHistoryDialog from '../StabilityHistoryDialog';
import StabilityUpdateDialog from '../StabilityUpdateDialog';
import StabilityPoolTableLoader from './StabilityPoolTableLoader';

function StabilityPoolTable() {
  const { enqueueSnackbar } = useSnackbar();

  const { Sentry } = useErrorMonitoring();
  const {
    address,
    contracts: { stabilityPoolManagerContract },
  } = useEthers();
  const { setSteps } = useTransactionDialog();

  const { data: collateralData, loading: collateralDataLoading } = useQuery<
    GetBorrowerCollateralTokensQuery,
    GetBorrowerCollateralTokensQueryVariables
  >(GET_BORROWER_COLLATERAL_TOKENS, {
    variables: { borrower: address },
    skip: !address,
    onError: (error) => {
      enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
      Sentry.captureException(error);
    },
  });
  const { data: debtData, loading: debtDataLoading } = useQuery<
    GetBorrowerDebtTokensQuery,
    GetBorrowerDebtTokensQueryVariables
  >(GET_BORROWER_DEBT_TOKENS, {
    variables: {
      borrower: address,
    },
    skip: !address,
    onError: (error) => {
      enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
      Sentry.captureException(error);
    },
  });

  if ((!collateralData && collateralDataLoading) || (!debtData && debtDataLoading)) {
    return <StabilityPoolTableLoader />;
  }

  const rewards =
    collateralData?.collateralTokenMetas.filter(({ stabilityGainedAmount }) => stabilityGainedAmount > 0) ?? [];
  const stabilityLost =
    debtData?.debtTokenMetas.filter(
      ({ compoundedDeposit, providedStability }) => compoundedDeposit > 0 || providedStability > 0,
    ) ?? [];

  const rewardsTotalInUSD = rewards.reduce(
    (acc, { stabilityGainedAmount, token }) =>
      acc +
      dangerouslyConvertBigIntToNumber(stabilityGainedAmount, 9, 9) *
        dangerouslyConvertBigIntToNumber(token.priceUSDOracle, 9, 9),
    0,
  );
  const lossTotalInUSD = stabilityLost.reduce(
    (acc, { compoundedDeposit, token, providedStability }) =>
      acc +
      dangerouslyConvertBigIntToNumber(providedStability - compoundedDeposit, 9, 9) *
        dangerouslyConvertBigIntToNumber(token.priceUSDOracle, 9, 9),
    0,
  );

  const listLength = Math.max(rewards.length, stabilityLost.length);

  const withdrawRewards = async () => {
    setSteps([
      {
        title: 'Withdraw Gains from the Stability Pool.',
        transaction: {
          methodCall: () => {
            return stabilityPoolManagerContract.withdrawGains().catch((err) => {
              throw new Error(err, { cause: stabilityPoolManagerContract });
            });
          },
          waitForResponseOf: [],
          reloadQueriesAfterMined: [GET_BORROWER_DEBT_TOKENS, GET_BORROWER_STABILITY_HISTORY],
        },
      },
    ]);
  };

  return (
    <FeatureBox title="Stability Pool" noPadding border="full" borderRadius>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <TableContainer>
          <Table
            sx={{ borderRight: '1px solid', borderColor: 'background.emphasis' }}
            data-testid="apollon-stability-pool-table"
          >
            <TableHead>
              <TableRow>
                <HeaderCell title="Provided Stability" cellProps={{ align: 'right', sx: { pr: 0 } }} />
                <HeaderCell title="" />
                <HeaderCell title="Remaining" cellProps={{ align: 'right' }} />
                <HeaderCell title="Gained collateral" cellProps={{ align: 'right', colSpan: 2 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {address ? (
                <>
                  {Array(listLength)
                    .fill(null)
                    .map((_, index) => {
                      const { compoundedDeposit, token: lostToken, providedStability } = stabilityLost[index] ?? {};
                      const { stabilityGainedAmount, token: rewardToken } = rewards[index] ?? {};
                      const noBorder = index === listLength - 1;

                      return (
                        <TableRow hover key={index}>
                          <TableCell sx={noBorder ? { borderBottom: 'none', pr: 0 } : { pr: 0 }} align="right">
                            {providedStability >= 0
                              ? roundCurrency(dangerouslyConvertBigIntToNumber(providedStability, 12, 6), 5, 5)
                              : null}
                          </TableCell>

                          <TableCell
                            width={40}
                            sx={noBorder ? { borderBottom: 'none' } : {}}
                            data-testid="apollon-stability-pool-table-lost-token"
                          >
                            {lostToken && <Label variant="error">{lostToken.symbol}</Label>}
                          </TableCell>
                          <TableCell align="right" sx={noBorder ? { borderBottom: 'none', pl: 0 } : { pl: 0 }}>
                            {compoundedDeposit >= 0
                              ? roundCurrency(dangerouslyConvertBigIntToNumber(compoundedDeposit, 12, 6), 5, 5)
                              : null}
                          </TableCell>
                          <TableCell sx={noBorder ? { borderBottom: 'none', pr: 0 } : { pr: 0 }} align="right">
                            {stabilityGainedAmount >= 0
                              ? roundCurrency(dangerouslyConvertBigIntToNumber(stabilityGainedAmount, 12, 6), 5, 5)
                              : null}
                          </TableCell>
                          <TableCell
                            width={50}
                            align="right"
                            sx={noBorder ? { borderBottom: 'none' } : {}}
                            data-testid="apollon-stability-pool-table-reward-token"
                          >
                            {rewardToken && <Label variant="success">{rewardToken.symbol}</Label>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  <TableRow>
                    <TableCell sx={{ borderBottom: 'none' }} colSpan={2}></TableCell>
                    <TableCell sx={{ borderBottom: 'none' }}></TableCell>

                    <TableCell sx={{ borderBottom: 'none' }} colSpan={2} align="right">
                      {`+ ${displayPercentage(
                        percentageChange(rewardsTotalInUSD, lossTotalInUSD),
                      )} (≈ ${roundCurrency(rewardsTotalInUSD - lossTotalInUSD)} $)`}
                    </TableCell>
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  <TableCell sx={{ borderBottom: 'none' }} colSpan={4}>
                    <DiagramPlaceholder fullWidth />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <div style={{ minWidth: 190, margin: '0 30px' }}>
          <StabilityHistoryDialog />

          <div style={{ marginTop: '10px' }}>
            <StabilityUpdateDialog />
          </div>

          <Button
            variant="outlined"
            sx={{ marginY: '10px' }}
            disabled={!address || rewards.length === 0}
            onClick={async () => await withdrawRewards()}
          >
            CLAIM
          </Button>
        </div>
      </div>
    </FeatureBox>
  );
}

export default StabilityPoolTable;
