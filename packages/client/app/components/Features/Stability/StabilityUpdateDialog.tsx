'use client';

import { useQuery } from '@apollo/client';
import { Box, Dialog, DialogActions, DialogContent, DialogTitle, FormHelperText, IconButton } from '@mui/material';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { parseEther } from 'ethers';
import { useSnackbar } from 'notistack';
import { SyntheticEvent, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { isDebtTokenAddress } from '../../../../config';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { useUtilities } from '../../../context/UtilityProvider';
import { GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables } from '../../../generated/gql-types';
import { GET_BORROWER_DEBT_TOKENS, GET_BORROWER_STABILITY_HISTORY } from '../../../queries';
import { getCheckSum } from '../../../utils/crypto';
import { dangerouslyConvertBigIntToNumber, roundCurrency } from '../../../utils/math';
import NumberInput from '../../FormControls/NumberInput';
import CrossIcon from '../../Icons/CrossIcon';
import DiamondIcon from '../../Icons/DiamondIcon';
import Label from '../../Label/Label';

type FieldValues = Record<string, string>;

const StabilityUpdateDialog = () => {
  const { enqueueSnackbar } = useSnackbar();

  const { Sentry } = useErrorMonitoring();
  const { setSteps } = useTransactionDialog();
  const { getAllowance } = useUtilities();

  const [isOpen, setIsOpen] = useState(false);
  const [tabValue, setTabValue] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');

  const {
    address,
    currentNetwork,
    contracts: { stabilityPoolManagerContract, debtTokenContracts },
  } = useEthers();

  const { data: borrowerDebtData } = useQuery<GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables>(
    GET_BORROWER_DEBT_TOKENS,
    {
      variables: {
        borrower: address,
      },
      skip: !address,
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  const methods = useForm<FieldValues>({ reValidateMode: 'onChange' });
  const {
    handleSubmit,
    setValue,
    reset,
    formState: { isDirty, isSubmitted },
  } = methods;

  useEffect(() => {
    if (borrowerDebtData && !isDirty) {
      const emptyValues = borrowerDebtData!.debtTokenMetas.reduce(
        (acc, { token }) => ({ ...acc, [token.address]: '' }),
        {},
      );
      reset(emptyValues);
    }
  }, [borrowerDebtData, isDirty, reset]);

  const handleChange = (_: SyntheticEvent, newValue: 'DEPOSIT' | 'WITHDRAW') => {
    setTabValue(newValue);
    const emptyValues = borrowerDebtData!.debtTokenMetas.reduce(
      (acc, { token }) => ({ ...acc, [token.address]: '' }),
      {},
    );
    reset(emptyValues);
  };

  const fillMaxInputValue = (tokenAddress: string, walletAmount: bigint, compoundedDeposit: bigint) => {
    if (tabValue === 'DEPOSIT') {
      setValue(tokenAddress, dangerouslyConvertBigIntToNumber(walletAmount, 9, 9).toString(), {
        shouldValidate: true,
        shouldDirty: true,
      });
    } else {
      setValue(tokenAddress, dangerouslyConvertBigIntToNumber(compoundedDeposit, 9, 9).toString(), {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  const onSubmit = async (data: FieldValues) => {
    Sentry.addBreadcrumb({
      category: 'updateStability',
      message: `Attempting update stability with data`,
      level: 'info',
      data: {
        ...data,
        tabValue,
        queryData: {
          borrowerDebtData,
        },
      },
    });

    const tokenAmounts = Object.entries(data)
      .filter(([_, amount]) => amount !== '' && parseFloat(amount) > 0)
      .map<{ tokenAddress: string; amount: bigint }>(([address, amount]) => {
        // If the input is very close to the max amount we use the max to not leave rest.
        const tokenMaxAmount =
          tabValue === 'DEPOSIT'
            ? borrowerDebtData!.debtTokenMetas.find(({ token }) => token.address === address)!.walletAmount
            : borrowerDebtData!.debtTokenMetas.find(({ token }) => token.address === address)!.providedStability;

        return {
          tokenAddress: address,
          amount: tokenMaxAmount - parseEther(amount) < parseEther('0.000001') ? tokenMaxAmount : parseEther(amount),
        };
      });

    if (tokenAmounts.length === 0) {
      return;
    }

    if (tabValue === 'DEPOSIT') {
      const tokenAllowances = await Promise.all(
        tokenAmounts.map<bigint>(({ tokenAddress }) => {
          if (isDebtTokenAddress(tokenAddress)) {
            const debtTokenContract = debtTokenContracts[tokenAddress];
            return getAllowance(debtTokenContract, address, currentNetwork!.contracts.StoragePool);
          }

          return 0n as any;
        }),
      );
      const needsAllowance = tokenAmounts.filter((token, index) => {
        const currentAllowance = tokenAllowances[index];

        return currentAllowance < token.amount;
      });

      setSteps([
        ...needsAllowance.map(({ tokenAddress, amount }) => ({
          title: `Approve ${
            borrowerDebtData!.debtTokenMetas.find(
              ({ token }) => getCheckSum(token.address) === getCheckSum(tokenAddress),
            )!.token.symbol
          } spending.`,
          transaction: {
            methodCall: async () => {
              if (isDebtTokenAddress(tokenAddress)) {
                const debtTokenContract = debtTokenContracts[tokenAddress];
                return debtTokenContract.approve(currentNetwork!.contracts.StoragePool, amount);
              }

              return null as any;
            },
            waitForResponseOf: [],
          },
        })),
        {
          title: 'Provide Stability to the Stability Pool.',
          transaction: {
            methodCall: () => {
              return stabilityPoolManagerContract.provideStability(tokenAmounts).catch((err) => {
                throw new Error(err, { cause: stabilityPoolManagerContract });
              });
            },
            // wait for all approvals
            waitForResponseOf: Array(needsAllowance.length)
              .fill('')
              .map((_, index) => index),
            reloadQueriesAfterMined: [GET_BORROWER_DEBT_TOKENS, GET_BORROWER_STABILITY_HISTORY],
          },
        },
      ]);
    } else {
      setSteps([
        {
          title: 'Withdraw Stability from the Stability Pool.',
          transaction: {
            methodCall: () => {
              return stabilityPoolManagerContract.withdrawStability(tokenAmounts).catch((err) => {
                throw new Error(err, { cause: stabilityPoolManagerContract });
              });
            },
            waitForResponseOf: [],
            reloadQueriesAfterMined: [GET_BORROWER_DEBT_TOKENS, GET_BORROWER_STABILITY_HISTORY],
          },
        },
      ]);
    }

    setTimeout(() => {
      setTabValue('DEPOSIT');
      reset();
    }, 100);
    setIsOpen(false);
  };

  const hasStabilityToWithdraw = borrowerDebtData?.debtTokenMetas.some(
    ({ providedStability }) => providedStability > 0,
  );
  const hasDebtTokenToProvideStability = borrowerDebtData?.debtTokenMetas.some(({ walletAmount }) => walletAmount > 0);

  // TODO: Write an informative message if user can withdraw but not provide so that dialog is not empty

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="outlined"
        disabled={!address || !borrowerDebtData || (!hasDebtTokenToProvideStability && !hasStabilityToWithdraw)}
      >
        Update
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => {
          reset();
          setIsOpen(false);
        }}
        fullWidth
        // @ts-ignore
        componentsProps={{ backdrop: { 'data-testid': 'apollon-stability-update-dialog-backdrop' } }}
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
              STABILITY UPDATE
            </Typography>
          </div>
          <IconButton onClick={() => setIsOpen(false)} aria-label="close stability update dialog">
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
                <Tab label="WITHDRAW" value="WITHDRAW" disabled={!hasStabilityToWithdraw} />
              </Tabs>

              <div style={{ overflowY: 'scroll', maxHeight: 'calc(100vh - 64px - 73px - 65px - 102px - 10px)' }}>
                {borrowerDebtData?.debtTokenMetas
                  .filter(
                    ({ walletAmount, compoundedDeposit }) =>
                      (tabValue === 'DEPOSIT' && walletAmount > 0) ||
                      (tabValue === 'WITHDRAW' && compoundedDeposit > 0),
                  )
                  .map(({ token, walletAmount, compoundedDeposit }, index) => (
                    <Box
                      key={token.address}
                      data-testid="apollon-stability-update-dialog"
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '20px',
                        height: '114px',
                        borderBottom: index === borrowerDebtData?.debtTokenMetas.length - 1 ? 'none' : '1px solid',
                        borderColor: 'background.paper',
                      }}
                    >
                      {tabValue === 'DEPOSIT' && (
                        <div style={{ marginTop: 6 }}>
                          <Label variant="success">{token.symbol}</Label>
                          <Typography sx={{ fontWeight: '400', marginTop: '10px' }}>
                            {roundCurrency(dangerouslyConvertBigIntToNumber(compoundedDeposit, 12, 6), 5, 5)}
                          </Typography>
                          <Typography variant="label" paragraph>
                            remaining deposit
                          </Typography>
                        </div>
                      )}
                      {tabValue === 'WITHDRAW' && (
                        <div style={{ marginTop: 6 }}>
                          <Label variant="success">{token.symbol}</Label>
                        </div>
                      )}

                      <div>
                        <NumberInput
                          name={token.address}
                          data-testid="apollon-stability-update-dialog-input"
                          placeholder="Value"
                          fullWidth
                          rules={{
                            min: { value: 0, message: 'Amount needs to be positive.' },
                            max:
                              tabValue === 'DEPOSIT'
                                ? {
                                    value: dangerouslyConvertBigIntToNumber(walletAmount, 9, 9),
                                    message: 'Your wallet does not contain the specified amount.',
                                  }
                                : {
                                    value: dangerouslyConvertBigIntToNumber(compoundedDeposit, 9, 9),
                                    message: 'Your deposited stability does not contain the specified amount.',
                                  },
                          }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            {tabValue === 'DEPOSIT' && (
                              <>
                                <Typography
                                  variant="caption"
                                  data-testid="apollon-stability-update-dialog-deposit-funds-label"
                                  color="info.main"
                                >
                                  {roundCurrency(dangerouslyConvertBigIntToNumber(walletAmount, 12, 6), 5, 5)}
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
                                  data-testid="apollon-stability-update-dialog-withdraw-funds-label"
                                  color="info.main"
                                >
                                  {roundCurrency(dangerouslyConvertBigIntToNumber(compoundedDeposit, 12, 6), 5, 5)}
                                </Typography>
                                <Typography variant="label" paragraph>
                                  remaining deposit
                                </Typography>
                              </>
                            )}
                          </div>

                          <Button
                            variant="undercover"
                            sx={{ textDecoration: 'underline', p: 0, mt: 0.25, height: 25 }}
                            onClick={() => fillMaxInputValue(token.address, walletAmount, compoundedDeposit)}
                          >
                            max
                          </Button>
                        </div>
                      </div>
                    </Box>
                  ))}
              </div>
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
                <Button type="submit" variant="outlined" sx={{ borderColor: 'primary.contrastText' }}>
                  Update
                </Button>
                {isSubmitted && !isDirty && (
                  <FormHelperText error sx={{ mt: '10px' }} data-testid="apollon-stability-update-dialog-error">
                    You must specify at least one token to update.
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

export default StabilityUpdateDialog;
