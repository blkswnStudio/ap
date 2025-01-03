'use client';

import { useQuery } from '@apollo/client';
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import Button, { ButtonProps } from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { usePriceFeedData } from '../../../context/PriceFeedDataProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
  GetBorrowerDebtTokensQuery,
  GetBorrowerDebtTokensQueryVariables,
} from '../../../generated/gql-types';
import { GET_BORROWER_COLLATERAL_TOKENS, GET_BORROWER_DEBT_TOKENS } from '../../../queries';
import { dangerouslyConvertBigIntToNumber, roundCurrency } from '../../../utils/math';
import RecoveryModeMarketCloseWrapper from '../../Buttons/RecoveryModeWrapper';
import CrossIcon from '../../Icons/CrossIcon';
import DiamondIcon from '../../Icons/DiamondIcon';
import Label from '../../Label/Label';

type Props = {
  buttonVariant: ButtonProps['variant'];
  buttonSx?: ButtonProps['sx'];
};

const CloseTroveDialog = ({ buttonVariant, buttonSx = {} }: Props) => {
  const { enqueueSnackbar } = useSnackbar();

  const [isOpen, setIsOpen] = useState(false);

  const { getPythUpdateData } = usePriceFeedData();
  const {
    address,
    contracts: { borrowerOperationsContract },
  } = useEthers();
  const { setSteps } = useTransactionDialog();
  const { Sentry } = useErrorMonitoring();

  const { data: collData } = useQuery<GetBorrowerCollateralTokensQuery, GetBorrowerCollateralTokensQueryVariables>(
    GET_BORROWER_COLLATERAL_TOKENS,
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

  const { data: debtData } = useQuery<GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables>(
    GET_BORROWER_DEBT_TOKENS,
    {
      variables: { borrower: address },
      skip: !address,
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  const collateralToDeposit: GetBorrowerCollateralTokensQuery['collateralTokenMetas'] =
    collData?.collateralTokenMetas ?? [];

  const hasNoOpenTrove = !collateralToDeposit.some(({ troveLockedAmount }) => troveLockedAmount > 0);

  if (hasNoOpenTrove || !collateralToDeposit || !debtData) {
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
        Close Trove
      </Button>
    );
  }

  const handleCloseTrove = async () => {
    setSteps([
      {
        title: 'Repay all debt and close trove.',
        transaction: {
          methodCall: async () => {
            const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

            return borrowerOperationsContract.closeTrove(updateDataInBytes, { value: priceUpdateFee }).catch((err) => {
              throw new Error(err, { cause: borrowerOperationsContract });
            });
          },
          waitForResponseOf: [],
          reloadQueriesAfterMined: [GET_BORROWER_COLLATERAL_TOKENS, GET_BORROWER_DEBT_TOKENS],
        },
      },
    ]);

    setIsOpen(false);
  };

  const unrepayableUserDebts = debtData?.debtTokenMetas
    .map(({ troveRepableDebtAmount, token }) => {
      const userCollateralTokenWalletAmount =
        collData?.collateralTokenMetas.find(({ token: { address } }) => address === token.address)?.walletAmount ?? 0n;

      return {
        token,
        debtAmount:
          dangerouslyConvertBigIntToNumber(troveRepableDebtAmount) -
          dangerouslyConvertBigIntToNumber(userCollateralTokenWalletAmount),
      };
    })
    .filter(({ debtAmount }) => debtAmount > 0);
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
        disabled={!address}
      >
        Close Trove
      </Button>
      <Dialog
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
        fullWidth
        // @ts-ignore
        componentsProps={{ backdrop: { 'data-testid': 'apollon-close-trove-dialog-backdrop' } }}
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
              CLOSE TROVE
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
          {unrepayableUserDebts.length === 0 ? (
            <Alert severity="warning">
              All your outstanding debts will be repaid, followed by a closure of your Trove. The entire collateral
              deposited will then be credited to your wallet.
            </Alert>
          ) : (
            <Alert severity="error">
              You can not repay all your debts with the collateral you have. Please deposit more collateral or repay
              some of your debts to close your Trove.
              <List>
                {unrepayableUserDebts.map(({ token, debtAmount }) => (
                  <ListItem key={token.id}>
                    <ListItemText>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <Label variant="error">{token.symbol}</Label>
                        <Typography>{roundCurrency(debtAmount, 5, 5)}</Typography>
                      </div>
                    </ListItemText>
                  </ListItem>
                ))}
              </List>
            </Alert>
          )}
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
            <RecoveryModeMarketCloseWrapper respectRecoveryMode>
              <Button
                onClick={handleCloseTrove}
                variant="outlined"
                sx={{ borderColor: 'primary.contrastText' }}
                disabled={unrepayableUserDebts.length > 0}
              >
                Close Trove
              </Button>
            </RecoveryModeMarketCloseWrapper>
          </div>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CloseTroveDialog;
