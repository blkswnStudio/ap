import { useQuery } from '@apollo/client';
import { Typography } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useEthers } from '../../../../context/EthersProvider';
import { GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables } from '../../../../generated/gql-types';
import { GET_BORROWER_DEBT_TOKENS } from '../../../../queries';
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
import MintStableDialog from '../../Debt/MintStableDialog';
import RedemptionDialog from '../../Debt/RedemptionDialog';
import RepayDebtDialog from '../../Debt/RepayDebtDialog';
import DebtTokenTableLoader from './DebtTokenTableLoader';

function DebtTokenTable() {
  const { address } = useEthers();

  const { data } = useQuery<GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables>(GET_BORROWER_DEBT_TOKENS, {
    variables: {
      borrower: address,
    },
  });

  if (!data) return <DebtTokenTableLoader />;

  return (
    <FeatureBox title="Debt Token" noPadding border="full" borderRadius>
      <TableContainer>
        <Table data-testid="apollon-debt-token-table">
          <TableHead>
            <TableRow>
              <HeaderCell title="Personal" cellProps={{ align: 'right' }} />
              <HeaderCell title="" />
              <HeaderCell title="" cellProps={{ sx: { borderRight: '1px solid', borderColor: 'background.paper' } }} />
              <HeaderCell title="" />
              <HeaderCell title="" />
              <HeaderCell title="" />
              <HeaderCell title="Protocol Level" cellProps={{ align: 'right' }} />
            </TableRow>
          </TableHead>
          <TableHead>
            <TableRow>
              <HeaderCell title="Wallet" cellProps={{ align: 'right' }} />
              <HeaderCell title="Debt" cellProps={{ align: 'right' }} />
              <HeaderCell
                title="Token"
                cellProps={{ align: 'right', sx: { borderRight: '1px solid', borderColor: 'background.paper' } }}
              />

              <HeaderCell title="Minted" cellProps={{ align: 'right', colSpan: 2 }} />
              <HeaderCell title="Stability" cellProps={{ align: 'right' }} />
              <HeaderCell
                title="Rewards"
                cellProps={{ align: 'right' }}
                tooltipProps={{
                  title: 'APR based on the last 30 days liquidations.',
                  arrow: true,
                  placement: 'bottom',
                }}
              />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.debtTokenMetas
              .map((debtToken) => ({
                ...debtToken,
                totalSupplyUSD: bigIntStringToFloat(debtToken.totalSupplyUSD),
                totalDepositedStability: bigIntStringToFloat(debtToken.totalDepositedStability),
                totalSupplyUSD30dAverage: {
                  ...debtToken.totalSupplyUSD30dAverage,
                  value: bigIntStringToFloat(debtToken.totalSupplyUSD30dAverage.value),
                },
                stabilityDepositAPY: {
                  ...debtToken.stabilityDepositAPY,
                  value:
                    bigIntStringToFloat(debtToken.stabilityDepositAPY.volume) > 0
                      ? bigIntStringToFloat(debtToken.stabilityDepositAPY.profit) /
                        bigIntStringToFloat(debtToken.stabilityDepositAPY.volume)
                      : 0,
                },
                walletAmount: dangerouslyConvertBigIntToNumber(debtToken.walletAmount, 12, 6),
                troveDebtAmount: dangerouslyConvertBigIntToNumber(debtToken.troveDebtAmount, 12, 6),
              }))
              .map(
                (
                  {
                    stabilityDepositAPY,
                    totalDepositedStability,
                    token,
                    walletAmount,
                    troveDebtAmount,
                    totalSupplyUSD,
                    totalSupplyUSD30dAverage,
                  },
                  index,
                ) => (
                  <TableRow hover key={token.address}>
                    <TableCell align="right">{roundCurrency(walletAmount, 5, 5)}</TableCell>
                    <TableCell align="right">{roundCurrency(troveDebtAmount, 5, 5)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        borderRight: '1px solid',
                        borderColor: 'table.border',
                      }}
                    >
                      <Label variant="none">{token.symbol}</Label>
                    </TableCell>
                    <TableCell align="right">{stdFormatter.format(totalSupplyUSD)}</TableCell>
                    <TableCell width={125}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography
                          fontWeight={400}
                          color={
                            percentageChange(totalSupplyUSD, totalSupplyUSD30dAverage.value) > 0
                              ? 'success.main'
                              : 'error.main'
                          }
                        >
                          {displayPercentage(
                            percentageChange(totalSupplyUSD, totalSupplyUSD30dAverage.value),
                            'positive',
                          )}
                        </Typography>

                        <DirectionIcon
                          showIncrease={percentageChange(totalSupplyUSD, totalSupplyUSD30dAverage.value) > 0}
                        />
                      </div>
                    </TableCell>
                    <TableCell align="right">{roundCurrency(totalDepositedStability)}</TableCell>
                    <TableCell align="right">{displayPercentage(stabilityDepositAPY.value)}</TableCell>
                  </TableRow>
                ),
              )}

            <TableRow>
              <TableCell
                colSpan={3}
                sx={{ borderBottom: 'none', borderRight: '1px solid', borderColor: 'table.border', padding: '2px' }}
              >
                <RepayDebtDialog buttonVariant="text" buttonSx={{ p: '6px 8px', width: '100%' }} />
              </TableCell>
              <TableCell
                colSpan={2}
                sx={{ borderBottom: 'none', borderRight: '1px solid', borderColor: 'table.border', padding: '2px' }}
              >
                <MintStableDialog buttonVariant="text" buttonSx={{ p: '6px 8px', width: '100%' }} />
              </TableCell>
              <TableCell style={{ borderBottom: 'none', padding: '2px' }} colSpan={2} align="center">
                <RedemptionDialog buttonVariant="text" buttonSx={{ p: '6px 8px', width: '100%' }} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </FeatureBox>
  );
}

export default DebtTokenTable;
