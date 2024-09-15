'use client';

import { Box, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Skeleton } from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { ethers } from 'ethers';
import { useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { usePriceFeedData } from '../../../context/PriceFeedDataProvider';
import { useSelectedToken } from '../../../context/SelectedTokenProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { GET_BORROWER_COLLATERAL_TOKENS, GET_BORROWER_DEBT_TOKENS } from '../../../queries';
import { getHints } from '../../../utils/crypto';
import { dangerouslyConvertBigIntToNumber, displayPercentage, roundCurrency } from '../../../utils/math';
import NumberInput from '../../FormControls/NumberInput';
import CrossIcon from '../../Icons/CrossIcon';
import DiamondIcon from '../../Icons/DiamondIcon';
import ForwardIcon from '../../Icons/ForwardIcon';
import Label from '../../Label/Label';
import CollateralRatioVisualization from '../../Visualizations/CollateralRatioVisualization';

type FieldValues = {
  stableAmount: string;
  borrowingRate: string;
};

type Props = {
  buttonVariant?: ButtonProps['variant'];
  buttonSx?: ButtonProps['sx'];
};

function MintStableDialog({ buttonSx = {}, buttonVariant = 'outlined' }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [oldRatio, setOldRatio] = useState<null | number>(null);
  const [newRatio, setNewRatio] = useState<null | number>(null);
  const [oldCriticalRatio, setOldCriticalRatio] = useState<null | number>(null);

  const {
    address,
    contracts: { borrowerOperationsContract, sortedTrovesContract, hintHelpersContract },
  } = useEthers();
  const { Sentry } = useErrorMonitoring();
  const { getPythUpdateData } = usePriceFeedData();
  const { setSteps } = useTransactionDialog();
  const { JUSDToken } = useSelectedToken();

  const methods = useForm<FieldValues>({
    reValidateMode: 'onChange',
    defaultValues: {
      stableAmount: '',
      borrowingRate: '0',
    },
  });
  const { handleSubmit, setValue, reset, watch } = methods;

  const ratioChangeCallback = useCallback(
    (newRatio: number, oldRatio: number, _: number, __: number, oldCriticalRatio: number, newCriticalRatio: number) => {
      setNewRatio(newRatio);
      setOldRatio(oldRatio);
      setOldCriticalRatio(oldCriticalRatio);
    },
    [setNewRatio, setOldRatio, setOldCriticalRatio],
  );

  useEffect(() => {
    if (JUSDToken?.borrowingRate) {
      setValue('borrowingRate', (2 + dangerouslyConvertBigIntToNumber(JUSDToken.borrowingRate, 12, 6 - 2)).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JUSDToken?.borrowingRate]);

  const onSubmit = async (formData: FieldValues) => {
    Sentry.addBreadcrumb({
      category: 'mintStable',
      message: `Attempting to mint stable`,
      level: 'info',
      data: {
        ...formData,
      },
    });

    const tokenAmount = {
      tokenAddress: JUSDToken!.address,
      amount: ethers.parseEther(formData.stableAmount),
    };
    const maxFeePercentage = formData.borrowingRate;

    setSteps([
      {
        title: 'Mint Stable Token.',
        transaction: {
          methodCall: async () => {
            const [upperHint, lowerHint] = await getHints(sortedTrovesContract, hintHelpersContract, {
              borrower: address,
              addedColl: [],
              addedDebt: [tokenAmount],
              removedColl: [],
              removedDebt: [],
            });
            const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

            return borrowerOperationsContract
              .increaseStableDebt(
                tokenAmount.amount,
                {
                  upperHint,
                  lowerHint,
                  maxFeePercentage: maxFeePercentage,
                },
                updateDataInBytes,
                { value: priceUpdateFee },
              )
              .catch((err) => {
                throw new Error(err, { cause: borrowerOperationsContract });
              });
          },
          waitForResponseOf: [],
          reloadQueriesAfterMined: [GET_BORROWER_DEBT_TOKENS, GET_BORROWER_COLLATERAL_TOKENS],
        },
      },
    ]);

    setTimeout(() => {
      reset();
    }, 100);
    setIsOpen(false);
  };

  if (!JUSDToken) {
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
        Mint Stable
      </Button>
    );
  }

  // TODO: Clarify if maxDebt needs to be added or if it is deducted.
  const stableAmount = !isNaN(parseFloat(watch('stableAmount'))) ? parseFloat(watch('stableAmount')) : 0;
  const currentMaxFee = !isNaN(parseFloat(watch('borrowingRate')))
    ? parseFloat(watch('borrowingRate')) / 100
    : dangerouslyConvertBigIntToNumber(JUSDToken.borrowingRate);
  const addedDebtUSD = stableAmount * (1 + currentMaxFee);

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant={buttonVariant}
        sx={{
          width: 'auto',
          padding: '0 50px',
          ...buttonSx,
        }}
        disabled={!address || !JUSDToken}
      >
        Mint Stable
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => {
          reset();
          setIsOpen(false);
        }}
        fullWidth
        // @ts-ignore
        componentsProps={{ backdrop: { 'data-testid': 'apollon-mint-stable-dialog-backdrop' } }}
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
              Mint Stable
            </Typography>
          </div>
          <IconButton onClick={() => setIsOpen(false)} aria-label="close repay debt dialog">
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
              <div style={{ overflowY: 'scroll', maxHeight: 'calc(100vh - 64px - 73px - 102px - 10px)' }}>
                <Box
                  data-testid="apollon-mint-stable-dialog"
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '20px',
                    height: '114px',
                  }}
                >
                  <div style={{ marginTop: 6 }}>
                    <Label variant="success">{JUSDToken?.symbol}</Label>
                  </div>

                  <div>
                    <NumberInput
                      name="stableAmount"
                      data-testid="apollon-mint-stable-dialog-input"
                      placeholder="Value"
                      fullWidth
                      rules={{
                        required: 'This field is required.',
                        min: { value: 0, message: 'Amount needs to be positive.' },
                        max: {
                          value: dangerouslyConvertBigIntToNumber(JUSDToken!.walletAmount, 12, 6),
                          message: 'Your wallet does not contain the specified amount.',
                        },
                      }}
                    />

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <Typography
                          variant="caption"
                          data-testid="apollon-mint-stable-dialog-deposit-funds-label"
                          color="info.main"
                        >
                          {roundCurrency(dangerouslyConvertBigIntToNumber(JUSDToken!.walletAmount, 12, 6), 5, 5)}
                        </Typography>
                        <Typography variant="label" paragraph>
                          Wallet
                        </Typography>
                      </div>
                    </div>
                  </div>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '20px',
                    height: '114px',
                    borderColor: 'background.paper',
                  }}
                >
                  <Typography sx={{ fontWeight: '400', marginTop: '10px' }}>max. Borrowing Rate</Typography>

                  <div>
                    <NumberInput
                      name="borrowingRate"
                      data-testid="apollon-redeem-debt-dialog-borrowingRate-input"
                      placeholder="max. Borrowing Rate"
                      fullWidth
                      rules={{
                        min: {
                          value: dangerouslyConvertBigIntToNumber(JUSDToken!.borrowingRate, 9, 9 + 2),
                          message: 'The specified amount is below the minimal borrowing rate.',
                        },
                        required: 'This field is required.',
                        max: {
                          value: 100,
                          message: 'No bigger value possible.',
                        },
                      }}
                    />

                    <div>
                      <Typography
                        variant="caption"
                        data-testid="apollon-redeem-debt-dialog-deposit-funds-label"
                        color="info.main"
                      >
                        {displayPercentage(
                          dangerouslyConvertBigIntToNumber(JUSDToken!.borrowingRate, 12, 6),
                          'default',
                          5,
                        )}
                      </Typography>
                      <Typography variant="label" paragraph>
                        probable min. Borrowing Rate
                      </Typography>
                    </div>
                  </div>
                </Box>
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
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="shady">
                      {oldCriticalRatio !== null ? (
                        displayPercentage(oldCriticalRatio, 'default', 0)
                      ) : (
                        <Skeleton variant="text" width={50} />
                      )}
                    </Typography>
                  </div>
                </Box>

                <CollateralRatioVisualization addedDebtUSD={addedDebtUSD} callback={ratioChangeCallback} />
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
                <Button
                  type="submit"
                  variant="outlined"
                  sx={{ borderColor: 'primary.contrastText' }}
                  disabled={!address || !JUSDToken || !oldCriticalRatio || !newRatio || newRatio <= oldCriticalRatio}
                >
                  Mint Stable
                </Button>
              </div>
            </DialogActions>
          </form>
        </FormProvider>
      </Dialog>
    </>
  );
}

export default MintStableDialog;
