import { useQuery } from '@apollo/client';
import { Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useEthers } from '../../../context/EthersProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { GetBorrowerLiquidityPoolsQuery, GetBorrowerLiquidityPoolsQueryVariables } from '../../../generated/gql-types';
import { GET_BORROWER_LIQUIDITY_POOLS } from '../../../queries';
import { standardDataPollInterval } from '../../../utils/contants';
import {
  bigIntStringToFloat,
  dangerouslyConvertBigIntToNumber,
  displayPercentage,
  roundNumber,
} from '../../../utils/math';
import FeatureBox from '../../FeatureBox/FeatureBox';
import ExchangeIcon from '../../Icons/ExchangeIcon';
import Label from '../../Label/Label';
import DiagramPlaceholder from '../../Loader/DiagramPlaceholder';
import HeaderCell from '../../Table/HeaderCell';
import ClaimStakingRewardsLoader from './ClaimStakingRewardsLoader';

export default function ClaimStakingRewards() {
  const {
    address,
    contracts: { stakingOperationsContract },
  } = useEthers();
  const { setSteps } = useTransactionDialog();

  const { data: borrowerPoolsData } = useQuery<GetBorrowerLiquidityPoolsQuery, GetBorrowerLiquidityPoolsQueryVariables>(
    GET_BORROWER_LIQUIDITY_POOLS,
    {
      variables: { borrower: address },
      pollInterval: standardDataPollInterval,
    },
  );

  if (!borrowerPoolsData) {
    return <ClaimStakingRewardsLoader />;
  }

  const poolsWithRewards = borrowerPoolsData.pools.filter(({ pendingRewards }) => pendingRewards > 0);

  const handleClaimStakingRewards = () => {
    setSteps([
      {
        title: `Claim staking rewards for ${poolsWithRewards.length} pools.`,
        transaction: {
          methodCall: async () => {
            return stakingOperationsContract.batchClaim(poolsWithRewards.map(({ address }) => address)).catch((err) => {
              throw new Error(err, { cause: stakingOperationsContract });
            });
          },
          waitForResponseOf: [],
          reloadQueriesAfterMined: [GET_BORROWER_LIQUIDITY_POOLS],
        },
      },
    ]);
  };

  return (
    <FeatureBox title="Stability Pool" noPadding border="full" sx={{ position: 'relative', left: '-0.5px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <TableContainer>
          <Table sx={{ borderRight: '1px solid', borderColor: 'background.emphasis' }}>
            <TableHead>
              <TableRow>
                <HeaderCell title="Pool" />
                <HeaderCell
                  title="Staking APR"
                  tooltipProps={{
                    title:
                      "APR (Annual Percentage Rate) shows your estimated yearly rewards for staking tokens. It's calculated based on current staking rates and token emissions.",
                  }}
                />
                <HeaderCell title="Pending Rewards" />
              </TableRow>
            </TableHead>
            <TableBody>
              {address && poolsWithRewards.length > 0 ? (
                <>
                  {poolsWithRewards.map(({ liquidity, address, pendingRewards, stakingPool }) => {
                    return (
                      <TableRow hover key={address}>
                        <TableCell>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                            <Label variant="none">{liquidity[0].token.symbol}</Label>

                            <ExchangeIcon />
                            <Label variant="none">{liquidity[1].token.symbol}</Label>
                          </div>
                        </TableCell>

                        {/* TODO: Must be reuqired when deployment is fixed */}
                        <TableCell>{displayPercentage(bigIntStringToFloat(stakingPool?.stakingAPR ?? '0n'))}</TableCell>

                        <TableCell>
                          <span style={{ marginRight: 15 }}>
                            {roundNumber(dangerouslyConvertBigIntToNumber(pendingRewards, 12, 6), 5)}
                          </span>

                          <Label variant="success">JLY</Label>
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  <TableRow sx={{ borderTop: '2px solid', borderTopColor: 'table.border' }}>
                    <TableCell sx={{ borderBottom: 'none' }}></TableCell>

                    <TableCell sx={{ borderBottom: 'none' }}>
                      <span style={{ marginRight: 15 }}>
                        ={' '}
                        {roundNumber(
                          dangerouslyConvertBigIntToNumber(
                            poolsWithRewards.reduce((acc, { pendingRewards }) => acc + pendingRewards, 0n),
                            12,
                            6,
                          ),
                          5,
                        )}
                      </span>

                      <Label variant="success">JLY</Label>
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
          <Button
            variant="outlined"
            sx={{ marginY: '10px' }}
            onClick={handleClaimStakingRewards}
            disabled={poolsWithRewards.length === 0 || !address}
          >
            CLAIM
          </Button>
        </div>
      </div>
    </FeatureBox>
  );
}
