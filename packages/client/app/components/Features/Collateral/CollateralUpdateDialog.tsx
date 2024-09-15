'use client';

import { useQuery } from '@apollo/client';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormHelperText,
  IconButton,
  Skeleton,
} from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { SyntheticEvent, useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Contracts_ATC, Contracts_Localhost, isCollateralTokenAddress, isDebtTokenAddress } from '../../../../config';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { usePriceFeedData } from '../../../context/PriceFeedDataProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { useUtilities } from '../../../context/UtilityProvider';
import { evictCacheTimeoutForObject } from '../../../context/utils';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
  GetBorrowerDebtTokensQuery,
  GetBorrowerDebtTokensQueryVariables,
} from '../../../generated/gql-types';
import { GET_BORROWER_COLLATERAL_TOKENS, GET_BORROWER_DEBT_TOKENS, GET_SYSTEMINFO } from '../../../queries';
import { getHints } from '../../../utils/crypto';
import { dangerouslyConvertBigIntToNumber, displayPercentage, floatToBigInt, roundCurrency } from '../../../utils/math';
import RecoveryModeMarketCloseWrapper from '../../Buttons/RecoveryModeWrapper';
import NumberInput from '../../FormControls/NumberInput';
import CrossIcon from '../../Icons/CrossIcon';
import DiamondIcon from '../../Icons/DiamondIcon';
import ForwardIcon from '../../Icons/ForwardIcon';
import Label from '../../Label/Label';
import CollateralRatioVisualization from '../../Visualizations/CollateralRatioVisualization';

type Props = {
  buttonVariant: ButtonProps['variant'];
  buttonSx?: ButtonProps['sx'];
};

type FieldValues = {
  [Contracts_Localhost.ERC20.GOV]: string;
  [Contracts_ATC.ERC20.GOV]: string;
  [Contracts_Localhost.ERC20.BTC]: string;
  [Contracts_ATC.ERC20.BTC]: string;
  [Contracts_Localhost.ERC20.USDT]: string;
  [Contracts_ATC.ERC20.USDT]: string;
};

const CollateralUpdateDialog = ({ buttonVariant, buttonSx = {} }: Props) => {
  const { Sentry } = useErrorMonitoring();
  const { getPythUpdateData } = usePriceFeedData();
  const { getAllowance } = useUtilities();

  const [isOpen, setIsOpen] = useState(false);
  const [tabValue, setTabValue] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [oldRatio, setOldRatio] = useState<null | number>(null);
  const [newRatio, setNewRatio] = useState<null | number>(null);
  const [oldCriticalRatio, setOldCriticalRatio] = useState<null | number>(null);
  const [newCriticalRatio, setNewCriticalRatio] = useState<null | number>(null);

  const {
    address,
    currentNetwork,
    contracts: { borrowerOperationsContract, collateralTokenContracts, sortedTrovesContract, hintHelpersContract },
  } = useEthers();

  const { setSteps } = useTransactionDialog();

  const { data: collTokenMetaData } = useQuery<
    GetBorrowerCollateralTokensQuery,
    GetBorrowerCollateralTokensQueryVariables
  >(GET_BORROWER_COLLATERAL_TOKENS, {
    variables: {
      borrower: address,
    },
    skip: !address,
  });

  const { data: debtTokenData } = useQuery<GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables>(
    GET_BORROWER_DEBT_TOKENS,
    {
      variables: { borrower: address },
      skip: !address,
    },
  );

  const methods = useForm<FieldValues>({
    reValidateMode: 'onChange',
  });
  const {
    handleSubmit,
    setValue,
    reset,
    formState: { isSubmitted, isDirty },
    watch,
  } = methods;

  const ratioChangeCallback = useCallback(
    (newRatio: number, oldRatio: number, _: number, __: number, oldCriticalRatio: number, newCriticalRatio: number) => {
      setNewRatio(newRatio);
      setOldRatio(oldRatio);
      setOldCriticalRatio(oldCriticalRatio);
      setNewCriticalRatio(newCriticalRatio);
    },
    [setNewRatio, setOldRatio, setOldCriticalRatio, setNewCriticalRatio],
  );

  const handleChange = (_: SyntheticEvent, newValue: 'DEPOSIT' | 'WITHDRAW') => {
    setTabValue(newValue);
    reset();
  };

  const collateralToDeposit: GetBorrowerCollateralTokensQuery['collateralTokenMetas'] =
    collTokenMetaData?.collateralTokenMetas ?? [];

  useEffect(() => {
    if (collateralToDeposit.length > 0 && !isDirty) {
      const emptyValues = collateralToDeposit.reduce((acc, { token }) => ({ ...acc, [token.address]: '' }), {});
      reset({
        ...emptyValues,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collTokenMetaData, isDirty, reset]);

  if (!debtTokenData || !collTokenMetaData || collateralToDeposit.length === 0) {
    return (
      <Button
        variant={buttonVariant}
        sx={{
          width: 'auto',
          padding: '0 50px',
          ...buttonSx,
        }}
        disabled
      >
        Change
      </Button>
    );
  }

  const fillMaxInputValue = (fieldName: keyof FieldValues, index: number, decimals: number) => {
    if (tabValue === 'DEPOSIT') {
      setValue(
        fieldName,
        dangerouslyConvertBigIntToNumber(collateralToDeposit[index].walletAmount, decimals - 6, 6).toString(),
        {
          shouldValidate: true,
          shouldDirty: true,
        },
      );
    } else {
      setValue(
        fieldName,
        dangerouslyConvertBigIntToNumber(collateralToDeposit[index].troveLockedAmount, decimals - 6, 6).toString(),
        {
          shouldValidate: true,
          shouldDirty: true,
        },
      );
    }
  };

  const hasNoOpenTrove = !collateralToDeposit.some(({ troveLockedAmount }) => troveLockedAmount > 0);

  const onSubmit = async (data: FieldValues) => {
    Sentry.addBreadcrumb({
      category: 'collateralUpdate',
      message: `Attempting collateral update with data`,
      level: 'info',
      data: {
        ...data,
        tabValue,
        queryData: collTokenMetaData,
      },
    });

    const tokenAmounts = Object.entries(data)
      .filter(([_, amount]) => amount !== '' && parseFloat(amount) > 0)
      .map<{ tokenAddress: string; amount: bigint }>(([address, amount]) => {
        const tokenMeta = collateralToDeposit.find(({ token }) => token.address === address)!;
        return {
          tokenAddress: address,
          amount: floatToBigInt(parseFloat(amount), tokenMeta.token.decimals),
        };
      });

    if (tokenAmounts.length === 0) return;

    if (tabValue === 'DEPOSIT') {
      const collTokenAllowances = await Promise.all(
        tokenAmounts.map(({ tokenAddress }) => {
          if (isCollateralTokenAddress(tokenAddress)) {
            const collContract = collateralTokenContracts[tokenAddress];
            return getAllowance(collContract, address, currentNetwork!.contracts.BorrowerOperations);
          }

          throw new Error('Token address is not a collateral token address.');
        }),
      );
      const needsAllowance = tokenAmounts.filter((token, index) => {
        const currentAllowance = collTokenAllowances[index];

        return currentAllowance < token.amount;
      });

      setSteps([
        ...needsAllowance.map(({ tokenAddress, amount }) => ({
          title: `Approve ${
            Object.entries(currentNetwork!.contracts.ERC20).find(([_, value]) => value === tokenAddress)![0]
          } spending.`,
          transaction: {
            methodCall: async () => {
              if (isCollateralTokenAddress(tokenAddress)) {
                const collContract = collateralTokenContracts[tokenAddress];
                return collContract.approve(currentNetwork!.contracts.BorrowerOperations, amount);
              }

              return null as any;
            },
            waitForResponseOf: [],
          },
        })),
        {
          title: hasNoOpenTrove ? 'Open Trove.' : 'Add Collateral to Trove.',
          transaction: {
            methodCall: async () => {
              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();
              if (hasNoOpenTrove) {
                return borrowerOperationsContract
                  .openTrove(tokenAmounts, updateDataInBytes, { value: priceUpdateFee })
                  .catch((err) => {
                    throw new Error(err, { cause: borrowerOperationsContract });
                  });
              } else {
                const [upperHint, lowerHint] = await getHints(sortedTrovesContract, hintHelpersContract, {
                  borrower: address,
                  addedColl: tokenAmounts,
                  addedDebt: [],
                  removedColl: [],
                  removedDebt: [],
                });

                return borrowerOperationsContract
                  .addColl(tokenAmounts, upperHint, lowerHint, updateDataInBytes, { value: priceUpdateFee })
                  .catch((err) => {
                    throw new Error(err, { cause: borrowerOperationsContract });
                  });
              }
            },
            reloadQueriesAfterMined: [GET_BORROWER_COLLATERAL_TOKENS, GET_BORROWER_DEBT_TOKENS, GET_SYSTEMINFO],
            actionAfterMined: (client) => {
              // Need to evict local queries first...
              client.cache.evict({ fieldName: 'getSystemInfo' });
              client.cache.gc();
              evictCacheTimeoutForObject(currentNetwork!, ['TroveManager']);
            },
            // wait for all approvals
            waitForResponseOf: Array(needsAllowance.length)
              .fill('')
              .map((_, index) => index),
          },
        },
      ]);
    } else {
      setSteps([
        {
          title: 'Withdraw Collateral',
          transaction: {
            methodCall: async () => {
              const [upperHint, lowerHint] = await getHints(sortedTrovesContract, hintHelpersContract, {
                borrower: address,
                addedColl: [],
                addedDebt: [],
                removedColl: tokenAmounts,
                removedDebt: [],
              });
              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

              return borrowerOperationsContract
                .withdrawColl(tokenAmounts, upperHint, lowerHint, updateDataInBytes, { value: priceUpdateFee })
                .catch((err) => {
                  throw new Error(err, { cause: borrowerOperationsContract });
                });
            },
            reloadQueriesAfterMined: [GET_BORROWER_COLLATERAL_TOKENS, GET_BORROWER_DEBT_TOKENS, GET_SYSTEMINFO],
            actionAfterMined: (client) => {
              client.cache.evict({ fieldName: 'getSystemInfo' });
              client.cache.gc();
              evictCacheTimeoutForObject(currentNetwork!, ['TroveManager']);
            },
            waitForResponseOf: [],
          },
        },
      ]);
    }

    setTimeout(() => {
      reset();
    }, 100);
    setIsOpen(false);
  };

  const allTokenAmount = watch();

  const allTokenAmountUSD = Object.entries(allTokenAmount).map(([tokenAddress, value]) => {
    const { token } = collateralToDeposit.find(({ token }) => token.address === tokenAddress)!;

    const amountUSD = isNaN(parseFloat(value))
      ? 0
      : parseFloat(value) * dangerouslyConvertBigIntToNumber(token.priceUSDOracle, 9, 9);
    return {
      tokenAddress,
      amountUSD: amountUSD * (tabValue === 'DEPOSIT' ? 1 : -1),
    };
  });

  return (
    <>
      <Button
        variant={buttonVariant}
        sx={{
          width: 'auto',
          padding: '0 50px',
          ...buttonSx,
        }}
        onClick={() => setIsOpen(true)}
        disabled={
          !address ||
          !collateralToDeposit.some(({ walletAmount, troveLockedAmount }) => walletAmount > 0 || troveLockedAmount > 0)
        }
      >
        Change
      </Button>
      <Dialog
        open={isOpen}
        onClose={() => {
          reset();
          setIsOpen(false);
        }}
        fullWidth
        // @ts-ignore
        componentsProps={{ backdrop: { 'data-testid': 'apollon-collateral-update-dialog-backdrop' } }}
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
              COLLATERAL UPDATE
            </Typography>
          </div>
          <IconButton onClick={() => setIsOpen(false)} aria-label="close collateral update dialog">
            <CrossIcon />
          </IconButton>
        </DialogTitle>
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogContent
              sx={{
                p: 0,
                backgroundColor: 'background.default',
                border: '1px solid',
                borderColor: 'background.paper',
                borderBottom: 'none',
              }}
            >
              <Tabs value={tabValue} onChange={handleChange} variant="fullWidth" sx={{ mt: 2 }}>
                <Tab label="DEPOSIT" value="DEPOSIT" />
                <Tab label="WITHDRAW" value="WITHDRAW" disabled={hasNoOpenTrove} />
              </Tabs>

              <div style={{ maxHeight: 'calc(100vh - 64px - 73px - 65px - 120px - 102px - 10px)', overflow: 'scroll' }}>
                {collateralToDeposit.map(
                  ({ walletAmount, troveLockedAmount, token: { symbol, address, decimals } }, index) => {
                    return (
                      <div
                        key={address}
                        style={{ display: 'flex', justifyContent: 'space-between', padding: 20, height: 114 }}
                      >
                        {tabValue === 'DEPOSIT' && (
                          <div style={{ marginTop: 6 }}>
                            <Label variant="success">{symbol}</Label>
                            <Typography sx={{ fontWeight: '400', marginTop: '10px' }}>
                              {roundCurrency(
                                dangerouslyConvertBigIntToNumber(troveLockedAmount, decimals - 6, 6),
                                5,
                                5,
                              )}
                            </Typography>
                            <Typography variant="label" paragraph>
                              Trove
                            </Typography>
                          </div>
                        )}
                        {tabValue === 'WITHDRAW' && (
                          <div style={{ marginTop: 6 }}>
                            <Label variant="success">{symbol}</Label>
                          </div>
                        )}

                        <div>
                          <RecoveryModeMarketCloseWrapper
                            respectMarketClose={isDebtTokenAddress(address)}
                            respectRecoveryMode={false}
                          >
                            <NumberInput
                              name={address}
                              data-testid={`apollon-collateral-update-dialog-${symbol}-amount`}
                              placeholder="Value"
                              fullWidth
                              rules={{
                                min: { value: 0, message: 'Amount needs to be positive.' },
                                max:
                                  tabValue === 'DEPOSIT'
                                    ? {
                                        value: dangerouslyConvertBigIntToNumber(walletAmount, decimals - 6, 6),
                                        message: 'Your wallet does not contain the specified amount.',
                                      }
                                    : {
                                        value: dangerouslyConvertBigIntToNumber(troveLockedAmount, decimals - 6, 6),
                                        message: 'Your trove does not contain the specified amount.',
                                      },
                              }}
                            />
                          </RecoveryModeMarketCloseWrapper>

                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>
                              {tabValue === 'DEPOSIT' && (
                                <>
                                  <Typography
                                    variant="caption"
                                    data-testid={`apollon-collateral-update-dialog-deposit-${symbol}-funds-label`}
                                    color="info.main"
                                  >
                                    {roundCurrency(
                                      dangerouslyConvertBigIntToNumber(walletAmount, decimals - 6, 6),
                                      5,
                                      5,
                                    )}
                                  </Typography>
                                  <Typography variant="label" paragraph>
                                    Wallet
                                  </Typography>
                                </>
                              )}
                              {tabValue === 'WITHDRAW' && (
                                <>
                                  <Typography
                                    variant="caption"
                                    data-testid={`apollon-collateral-update-dialog-withdraw-${symbol}-funds-label`}
                                    color="info.main"
                                  >
                                    {roundCurrency(
                                      dangerouslyConvertBigIntToNumber(troveLockedAmount, decimals - 6, 6),
                                      5,
                                      5,
                                    )}
                                  </Typography>
                                  <Typography variant="label" paragraph>
                                    Trove
                                  </Typography>
                                </>
                              )}
                            </div>

                            <RecoveryModeMarketCloseWrapper
                              respectMarketClose={isDebtTokenAddress(address)}
                              respectRecoveryMode={false}
                            >
                              <Button
                                variant="undercover"
                                sx={{ textDecoration: 'underline', p: 0, mt: 0.25, height: 25 }}
                                onClick={() => fillMaxInputValue(address as keyof FieldValues, index, decimals)}
                              >
                                max
                              </Button>
                            </RecoveryModeMarketCloseWrapper>
                          </div>
                        </div>
                      </div>
                    );
                  },
                )}
              </div>

              <Box
                sx={{
                  padding: '20px',
                  borderTop: '1px solid',
                  borderColor: 'background.paper',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="titleAlternate">Collateral Ratio</Typography>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Typography
                      sx={{
                        fontFamily: 'Space Grotesk Variable',
                        color: 'info.main',
                        fontWeight: '700',
                        fontSize: '20px',
                      }}
                    >
                      {oldRatio !== null ? (
                        displayPercentage(oldRatio, 'default', 0)
                      ) : (
                        <Skeleton variant="text" width={50} />
                      )}
                    </Typography>
                    <ForwardIcon />
                    <Typography
                      sx={{
                        fontFamily: 'Space Grotesk Variable',
                        color: 'info.main',
                        fontWeight: '700',
                        fontSize: '20px',
                      }}
                    >
                      {newRatio === 0 ? (
                        '∞'
                      ) : newRatio !== null ? (
                        displayPercentage(newRatio, 'default', 0)
                      ) : (
                        <Skeleton variant="text" width={50} />
                      )}
                    </Typography>
                  </div>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Typography variant="shady">Minimal Collateral Ratio</Typography>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Typography variant="shady">
                      {oldCriticalRatio !== null ? (
                        displayPercentage(oldCriticalRatio, 'default', 0)
                      ) : (
                        <Skeleton variant="text" width={50} />
                      )}
                    </Typography>
                    <ForwardIcon fontSize="10px" />
                    <Typography variant="shady">
                      {newCriticalRatio !== null ? (
                        displayPercentage(newCriticalRatio, 'default', 0)
                      ) : (
                        <Skeleton variant="text" width={50} />
                      )}
                    </Typography>
                  </div>
                </Box>

                <CollateralRatioVisualization addedCollateral={allTokenAmountUSD} callback={ratioChangeCallback} />
              </Box>
            </DialogContent>
            <DialogActions
              sx={{
                border: '1px solid',
                borderColor: 'background.paper',
                borderBottomLeftRadius: '4px',
                borderBottomRightRadius: '4px',
                backgroundColor: 'background.default',
                p: '30px 20px',
              }}
            >
              <div style={{ width: '100%' }}>
                <RecoveryModeMarketCloseWrapper respectRecoveryMode={tabValue === 'WITHDRAW'}>
                  <Button
                    type="submit"
                    variant="outlined"
                    sx={{ borderColor: 'primary.contrastText' }}
                    disabled={
                      tabValue === 'WITHDRAW' &&
                      Boolean(newRatio) &&
                      Boolean(oldCriticalRatio) &&
                      newRatio! <= oldCriticalRatio!
                    }
                  >
                    Change
                  </Button>
                </RecoveryModeMarketCloseWrapper>
                {isSubmitted && !isDirty && (
                  <FormHelperText error sx={{ mt: '10px' }} data-testid="apollon-collateral-update-dialog-error">
                    You must specify at least one token to change.
                  </FormHelperText>
                )}
              </div>
            </DialogActions>
          </form>
        </FormProvider>
      </Dialog>
    </>
  );
};

export default CollateralUpdateDialog;
