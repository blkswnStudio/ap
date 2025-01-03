import { useQuery } from '@apollo/client';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import {
  GetBorrowerLiquidityPoolsQuery,
  GetBorrowerLiquidityPoolsQueryVariables,
  GetStakingVestingOperationsQuery,
  GetStakingVestingOperationsQueryVariables,
} from '../../../generated/gql-types';
import { GET_BORROWER_LIQUIDITY_POOLS, GET_STAKING_VESTING_OPERATIONS } from '../../../queries';
import { standardDataPollInterval } from '../../../utils/constants';
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
import { ClaimStakingVestingDialog } from './ClaimStakingVestingDialog';
import { OngoingVestingDialog } from './OngoingVestingDialog';

export default function ClaimStakingRewards() {
  const { enqueueSnackbar } = useSnackbar();

  const { address, currentNetwork } = useEthers();
  const { Sentry } = useErrorMonitoring();

  const { data: borrowerPoolsData } = useQuery<GetBorrowerLiquidityPoolsQuery, GetBorrowerLiquidityPoolsQueryVariables>(
    GET_BORROWER_LIQUIDITY_POOLS,
    {
      variables: { borrower: address },
      pollInterval: standardDataPollInterval,
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  const { data: stakingVestingData } = useQuery<
    GetStakingVestingOperationsQuery,
    GetStakingVestingOperationsQueryVariables
  >(GET_STAKING_VESTING_OPERATIONS, {
    variables: { token: currentNetwork!.contracts.ERC20.GOV },
    pollInterval: standardDataPollInterval,
    onError: (error) => {
      enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
      Sentry.captureException(error);
    },
  });

  if (!borrowerPoolsData || !stakingVestingData) {
    return <ClaimStakingRewardsLoader />;
  }

  const poolsWithRewards = borrowerPoolsData.pools.filter(({ pendingRewards }) => pendingRewards > 0);

  return (
    <FeatureBox title="Staking Rewards" noPadding border="full" sx={{ position: 'relative', left: '-0.5px' }}>
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
          {stakingVestingData.getStakingVestingOperations.remainingTime > 0 ? (
            <OngoingVestingDialog />
          ) : (
            <ClaimStakingVestingDialog />
          )}
        </div>
      </div>
    </FeatureBox>
  );
}
