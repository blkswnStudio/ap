import { useQuery } from '@apollo/client';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Typography,
} from '@mui/material';
import { parseEther } from 'ethers';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { isGOVTokenAddress } from '../../../../config';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
  GetStakingVestingOperationsQuery,
  GetStakingVestingOperationsQueryVariables,
} from '../../../generated/gql-types';
import {
  GET_BORROWER_COLLATERAL_TOKENS,
  GET_BORROWER_LIQUIDITY_POOLS,
  GET_STAKING_VESTING_OPERATIONS,
} from '../../../queries';
import { standardDataPollInterval } from '../../../utils/constants';
import { formatTimeInSeconds } from '../../../utils/date';
import { dangerouslyConvertBigIntToNumber, displayPercentage, roundCurrency, roundNumber } from '../../../utils/math';
import CrossIcon from '../../Icons/CrossIcon';
import DiamondIcon from '../../Icons/DiamondIcon';
import Label from '../../Label/Label';

export function OngoingVestingDialog() {
  const { enqueueSnackbar } = useSnackbar();

  const [isOpen, setIsOpen] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);

  const {
    address,
    currentNetwork,
    contracts: { stakingVestingOperationsContract },
  } = useEthers();
  const { setSteps } = useTransactionDialog();
  const { Sentry } = useErrorMonitoring();

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

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && stakingVestingData) {
      // setRemainingTime(parseInt(stakingVestingData.getStakingVestingOperations.remainingTime.toString()));
      setRemainingTime(1000);
      timer = setInterval(() => {
        setRemainingTime((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!stakingVestingData || !borrowerCollTokenData) {
    return (
      <Button variant="outlined" sx={{ marginY: '10px' }} disabled>
        Claim Vesting
      </Button>
    );
  }

  const govToken = borrowerCollTokenData.collateralTokenMetas.find(({ token }) => isGOVTokenAddress(token.address))!;

  const handleClaimStakingRewards = (isEarlyClaim: boolean) => {
    setSteps([
      {
        title: isEarlyClaim ? 'Claim staking rewards with partial booster' : 'Claim staking rewards with full booster',
        transaction: {
          methodCall: async () => {
            return stakingVestingOperationsContract
              .claimForUser(govToken.token.address, address, isEarlyClaim)
              .catch((err) => {
                throw new Error(err, { cause: stakingVestingOperationsContract });
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
      <Button variant="outlined" sx={{ marginY: '10px' }} disabled={!address} onClick={() => setIsOpen(true)}>
        Claim Vesting
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
              CLAIM VESTED REWARDS
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
            You can claim the rewards now, but you can get up to{' '}
            {roundNumber(
              dangerouslyConvertBigIntToNumber(stakingVestingData.getStakingVestingOperations.totalAmount, 9, 9),
              5,
            )}{' '}
            {govToken.token.symbol} if you wait until the booster is maximized. If you claim now you will{' '}
            <span style={{ textDecoration: 'underline' }}>
              burn{' '}
              <Typography color="error.main" component="span">
                {roundNumber(
                  dangerouslyConvertBigIntToNumber(stakingVestingData.getStakingVestingOperations.burnedAmount, 9, 9),
                  5,
                )}{' '}
                {govToken.token.symbol}
              </Typography>
            </span>
            .
            <LinearProgress
              variant="determinate"
              value={
                (parseInt(stakingVestingData.getStakingVestingOperations.remainingTime.toString()) /
                  (30 * 24 * 60 * 60)) *
                100
              }
              sx={{ my: 4, height: 12 }}
              color="info"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {displayPercentage(
                  parseInt(stakingVestingData.getStakingVestingOperations.remainingTime.toString()) /
                    (30 * 24 * 60 * 60),
                  'default',
                  2,
                )}{' '}
                already boosted
              </div>

              <div>{formatTimeInSeconds(remainingTime)} until max. boost</div>
            </div>
            <Divider sx={{ my: 2 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Label variant="success">{govToken.token.symbol}</Label>

                {roundNumber(
                  dangerouslyConvertBigIntToNumber(
                    stakingVestingData.getStakingVestingOperations.claimableAmount,
                    9,
                    9,
                  ),
                  5,
                )}
              </div>
              <span style={{ textDecoration: 'underline' }}>
                $
                {roundCurrency(
                  dangerouslyConvertBigIntToNumber(
                    (stakingVestingData.getStakingVestingOperations.claimableAmount * govToken.token.priceUSDOracle) /
                      parseEther('1'),
                    9,
                    9,
                  ),
                )}
              </span>
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
          <div style={{ width: '100%' }}>
            <Button
              onClick={() =>
                handleClaimStakingRewards(stakingVestingData.getStakingVestingOperations.remainingTime > 0)
              }
              variant="outlined"
              sx={{ borderColor: 'primary.contrastText' }}
            >
              Claim now
            </Button>
          </div>
        </DialogActions>
      </Dialog>
    </>
  );
}
