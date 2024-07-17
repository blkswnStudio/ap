import { useQuery } from '@apollo/client';
import {
  Box,
  Button,
  ButtonProps,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from '@mui/material';
import { ethers } from 'ethers';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Contracts_ATC, Contracts_Localhost } from '../../../../config';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { usePriceFeedData } from '../../../context/PriceFeedDataProvider';
import { useSelectedToken } from '../../../context/SelectedTokenProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { GetRedemptionsOperationsQuery, GetRedemptionsOperationsQueryVariables } from '../../../generated/gql-types';
import { GET_BORROWER_DEBT_TOKENS, GET_REDEMPTIONS_OPERATIONS } from '../../../queries';
import { dangerouslyConvertBigIntToNumber, displayPercentage, roundCurrency } from '../../../utils/math';
import NumberInput from '../../FormControls/NumberInput';
import CrossIcon from '../../Icons/CrossIcon';
import DiamondIcon from '../../Icons/DiamondIcon';
import Label from '../../Label/Label';

type FieldValues = {
  [Contracts_Localhost.DebtToken.STABLE]: string;
  [Contracts_ATC.DebtToken.STABLE]: string;
  redemptionFee: string;
};

type Props = {
  buttonVariant?: ButtonProps['variant'];
  buttonSx?: ButtonProps['sx'];
};

function RedemptionDialog({ buttonVariant = 'outlined', buttonSx = {} }: Props) {
  const { Sentry } = useErrorMonitoring();
  const { getPythUpdateData } = usePriceFeedData();

  const [isOpen, setIsOpen] = useState(false);

  const {
    address,
    currentNetwork,
    contracts: { sortedTrovesContract, hintHelpersContract, redemptionOperationsContract },
  } = useEthers();

  const { data: redemptionData } = useQuery<GetRedemptionsOperationsQuery, GetRedemptionsOperationsQueryVariables>(
    GET_REDEMPTIONS_OPERATIONS,
  );

  const { JUSDToken } = useSelectedToken();
  const { setSteps } = useTransactionDialog();

  const methods = useForm<FieldValues>({
    reValidateMode: 'onChange',
    defaultValues: {
      [currentNetwork!.contracts.DebtToken.STABLE]: '',
      redemptionFee: '',
    },
  });
  const { handleSubmit, setValue, reset } = methods;

  useEffect(() => {
    if (redemptionData) {
      setValue(
        'redemptionFee',
        (
          2 + dangerouslyConvertBigIntToNumber(redemptionData.getRedemtionOperations.redemptionRateWithDecay, 12, 6 - 2)
        ).toString(),
      );
    }
  }, [redemptionData, setValue]);

  const onSubmit = async (formData: FieldValues) => {
    Sentry.addBreadcrumb({
      category: 'redemption',
      message: `Attempting redemption with data`,
      level: 'info',
      data: {
        ...formData,
        queryData: redemptionData,
      },
    });

    const maxFeePercentage = formData.redemptionFee;
    const redemptionAmount = formData[currentNetwork!.contracts.DebtToken.STABLE];

    setSteps([
      {
        title: 'Redeem collateral.',
        transaction: {
          methodCall: async () => {
            const amountStableTroves = await sortedTrovesContract.getSize();
            const iterations = await hintHelpersContract.getRedemptionIterationHints(
              ethers.parseEther(redemptionAmount),
              Math.round(Math.min(4000, 15 * Math.sqrt(Number(amountStableTroves)))),
              Math.round(Math.random() * 100000000000),
            );

            const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

            return redemptionOperationsContract
              .redeemCollateral(
                ethers.parseEther(redemptionAmount),
                iterations.map((iteration) => ({
                  trove: iteration[0],
                  upperHint: iteration[1],
                  lowerHint: iteration[2],
                  expectedCR: iteration[3],
                })),
                // parse back to percentage
                ethers.parseUnits(maxFeePercentage, 18 - 2),
                updateDataInBytes,
                { value: priceUpdateFee },
              )
              .catch((err) => {
                throw new Error(err, { cause: redemptionOperationsContract });
              });
          },
          // wait for all approvals
          waitForResponseOf: [],
          reloadQueriesAferMined: [GET_BORROWER_DEBT_TOKENS],
        },
      },
    ]);

    setTimeout(() => {
      reset();
    }, 100);
    setIsOpen(false);
  };

  const fillMaxInputValue = () => {
    setValue(
      currentNetwork!.contracts.DebtToken.STABLE,
      dangerouslyConvertBigIntToNumber(JUSDToken!.walletAmount, 9, 9).toString(),
      {
        shouldValidate: true,
        shouldDirty: true,
      },
    );
  };

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
        disabled={!address}
      >
        Redeem
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => {
          reset();
          setIsOpen(false);
        }}
        fullWidth
        // @ts-ignore
        componentsProps={{ backdrop: { 'data-testid': 'apollon-redeem-dialog-backdrop' } }}
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DiamondIcon isDialog />
            <Typography variant="h6" display="inline-block">
              Redeem Stable Coin
            </Typography>
          </div>
          <IconButton onClick={() => setIsOpen(false)} aria-label="close redeem debt dialog">
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
              <div style={{ overflowY: 'scroll', maxHeight: '60vh' }}>
                {JUSDToken && redemptionData && (
                  <>
                    <Box
                      data-testid="apollon-repay-debt-dialog"
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '20px',
                        height: '114px',
                        borderColor: 'background.paper',
                      }}
                    >
                      <div style={{ marginTop: 6 }}>
                        <Label variant="success">{JUSDToken.symbol}</Label>
                      </div>

                      <div>
                        <NumberInput
                          name={JUSDToken.address}
                          data-testid="apollon-redeem-debt-dialog-input"
                          placeholder="Value"
                          required
                          fullWidth
                          rules={{
                            required: 'This field is required.',
                            min: { value: 0, message: 'Amount needs to be positive.' },
                            max: {
                              value: dangerouslyConvertBigIntToNumber(JUSDToken.walletAmount, 9, 9),
                              message: 'Your wallet does not contain the specified amount.',
                            },
                          }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <Typography
                              variant="caption"
                              data-testid="apollon-redeem-debt-dialog-deposit-funds-label"
                              color="info.main"
                            >
                              {roundCurrency(dangerouslyConvertBigIntToNumber(JUSDToken.walletAmount, 12, 6), 5, 5)}
                            </Typography>
                            <Typography variant="label" paragraph>
                              Wallet
                            </Typography>
                          </div>

                          <Button
                            variant="undercover"
                            sx={{ textDecoration: 'underline', p: 0, mt: 0.25, height: 25 }}
                            onClick={() => fillMaxInputValue()}
                          >
                            max
                          </Button>
                        </div>
                      </div>
                    </Box>

                    <Box
                      data-testid="apollon-repay-debt-dialog"
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '20px',
                        height: '114px',
                        borderColor: 'background.paper',
                      }}
                    >
                      <Typography sx={{ fontWeight: '400', marginTop: '10px' }}>max. Redemption Fee</Typography>

                      <div>
                        <NumberInput
                          name="redemptionFee"
                          data-testid="apollon-redeem-debt-dialog-redemptionFee-input"
                          placeholder="max. Redemption Fee"
                          fullWidth
                          rules={{
                            min: {
                              value: dangerouslyConvertBigIntToNumber(
                                redemptionData.getRedemtionOperations.redemptionRateWithDecay,
                                9,
                                9,
                              ),
                              message: 'The specified amount is below the minimal redemption fee.',
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
                              dangerouslyConvertBigIntToNumber(
                                redemptionData.getRedemtionOperations.redemptionRateWithDecay,
                                12,
                                6,
                              ),
                              'default',
                              5,
                            )}
                          </Typography>
                          <Typography variant="label" paragraph>
                            probable min. Redemption Fee
                          </Typography>
                        </div>
                      </div>
                    </Box>
                  </>
                )}
              </div>
            </DialogContent>
            <DialogActions
              sx={{
                border: '1px solid',
                borderColor: 'background.paper',
                backgroundColor: 'background.default',
                p: '30px 20px',
              }}
            >
              <div style={{ width: '100%' }}>
                <Button type="submit" variant="outlined" sx={{ borderColor: 'primary.contrastText' }}>
                  Redeem Stable Coin
                </Button>
              </div>
            </DialogActions>
          </form>
        </FormProvider>
      </Dialog>
    </>
  );
}

export default RedemptionDialog;
