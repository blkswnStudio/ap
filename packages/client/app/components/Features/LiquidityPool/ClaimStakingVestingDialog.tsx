import { useQuery } from '@apollo/client';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Typography,
} from '@mui/material';
import { parseEther } from 'ethers';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { isGOVTokenAddress } from '../../../../config';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
  GetBorrowerLiquidityPoolsQuery,
  GetBorrowerLiquidityPoolsQueryVariables,
} from '../../../generated/gql-types';
import { GET_BORROWER_COLLATERAL_TOKENS, GET_BORROWER_LIQUIDITY_POOLS } from '../../../queries';
import { standardDataPollInterval } from '../../../utils/constants';
import { dangerouslyConvertBigIntToNumber, roundCurrency, roundNumber } from '../../../utils/math';
import CrossIcon from '../../Icons/CrossIcon';
import DiamondIcon from '../../Icons/DiamondIcon';
import Label from '../../Label/Label';

export function ClaimStakingVestingDialog() {
  const { enqueueSnackbar } = useSnackbar();

  const [isOpen, setIsOpen] = useState(false);

  const {
    address,
    contracts: { stakingOperationsContract },
  } = useEthers();
  const { setSteps } = useTransactionDialog();
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

  const { data: borrowerCollTokenData } = useQuery<
    GetBorrowerCollateralTokensQuery,
    GetBorrowerCollateralTokensQueryVariables
  >(GET_BORROWER_COLLATERAL_TOKENS, {
    variables: { borrower: address },
    skip: !address,
    pollInterval: standardDataPollInterval,
    onError: (error) => {
      enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
      Sentry.captureException(error);
    },
  });

  if (!borrowerPoolsData || !borrowerCollTokenData) {
    return (
      <Button variant="outlined" sx={{ marginY: '10px' }} disabled>
        Claim Rewards
      </Button>
    );
  }

  const poolsWithRewards = borrowerPoolsData.pools.filter(({ pendingRewards }) => pendingRewards > 0);
  const accumulatedRewards = poolsWithRewards.reduce((acc, { pendingRewards }) => acc + pendingRewards, 0n);

  const govToken = borrowerCollTokenData.collateralTokenMetas.find(({ token }) => isGOVTokenAddress(token.address))!;
  const totalRewardValueUSD = (accumulatedRewards * govToken.token.priceUSDOracle) / parseEther('1');

  const handleClaimStakingRewardsInstantly = () => {
    setSteps([
      {
        title: `Claim staking rewards for ${poolsWithRewards.length} pools now.`,
        transaction: {
          methodCall: async () => {
            return stakingOperationsContract
              .batchClaim(
                poolsWithRewards.map(({ address }) => address),
                true,
                true,
              )
              .catch((err) => {
                throw new Error(err, { cause: stakingOperationsContract });
              });
          },
          waitForResponseOf: [],
          reloadQueriesAfterMined: [GET_BORROWER_LIQUIDITY_POOLS, GET_BORROWER_COLLATERAL_TOKENS],
        },
      },
    ]);
  };

  const handleClaimStakingRewardsWithBoost = () => {
    setSteps([
      {
        title: `Boosting staking rewards for ${poolsWithRewards.length} pools over a 30-day period.`,
        transaction: {
          methodCall: async () => {
            return stakingOperationsContract
              .batchClaim(
                poolsWithRewards.map(({ address }) => address),
                true,
                false,
              )
              .catch((err) => {
                throw new Error(err, { cause: stakingOperationsContract });
              });
          },
          waitForResponseOf: [],
          reloadQueriesAfterMined: [GET_BORROWER_LIQUIDITY_POOLS, GET_BORROWER_COLLATERAL_TOKENS],
        },
      },
    ]);
  };

  return (
    <>
      <Button
        variant="outlined"
        sx={{ marginY: '10px' }}
        disabled={poolsWithRewards.length === 0 || !address}
        onClick={() => setIsOpen(true)}
      >
        Claim Rewards
      </Button>
      <Dialog
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'background.default',
            border: '1px solid',
            borderColor: 'background.paper',
            borderBottom: 'none',
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DiamondIcon isDialog />
            <Typography variant="h6" display="inline-block">
              CLAIM STAKING REWARDS
            </Typography>
          </div>
          <IconButton onClick={() => setIsOpen(false)} aria-label="close collateral update dialog">
            <CrossIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent
          sx={{
            p: 0,
            backgroundColor: 'background.default',
            border: '1px solid',
            borderColor: 'background.paper',
            borderBottom: 'none',
          }}
        >
          <div
            style={{
              padding: '20px',
            }}
          >
            Boosting occurs <span style={{ textDecoration: 'underline' }}>linearly over 30 days</span>. The 2x boost
            becomes fully available for claim once this period is complete. At any point you have the option to expedite
            the boosting period and immediately claim your rewards; however, doing so will result in a lower boost.
            <Divider sx={{ my: 2 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Label variant="success">{govToken.token.symbol}</Label>

                {roundNumber(dangerouslyConvertBigIntToNumber(accumulatedRewards / 2n, 9, 9))}
              </div>
              <span style={{ textDecoration: 'underline' }}>
                ${roundCurrency(dangerouslyConvertBigIntToNumber(totalRewardValueUSD / 2n, 9, 9))}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
              <Typography variant="h6" sx={{ color: 'success.dark' }}>
                Boosted after 30 days:
              </Typography>

              <div>
                <Typography variant="h6" sx={{ textDecoration: 'underline', color: 'success.dark' }}>
                  ${roundCurrency(dangerouslyConvertBigIntToNumber(totalRewardValueUSD, 9, 9))}
                </Typography>
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions
          sx={{
            border: '1px solid',
            borderColor: 'background.paper',
            backgroundColor: 'background.default',
            p: '30px 20px',
            borderBottomLeftRadius: '4px',
            borderBottomRightRadius: '4px',
          }}
        >
          <div style={{ width: '50%' }}>
            <Button
              onClick={handleClaimStakingRewardsInstantly}
              variant="text"
              sx={{ borderColor: 'primary.contrastText', width: '100%', height: '40px' }}
            >
              Claim rewards now
            </Button>
          </div>
          <div style={{ width: '50%' }}>
            <Button
              onClick={handleClaimStakingRewardsWithBoost}
              variant="outlined"
              sx={{ borderColor: 'primary.contrastText' }}
            >
              Start boosting
            </Button>
          </div>
        </DialogActions>
      </Dialog>
    </>
  );
}
