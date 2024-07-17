/* eslint-disable react/display-name */
'use client';
import { ApolloClient, useApolloClient } from '@apollo/client';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import {
  Alert,
  Box,
  CircularProgress,
  CircularProgressProps,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { BaseContract, ContractTransactionReceipt, ContractTransactionResponse } from 'ethers/contract';
import { useSnackbar } from 'notistack';
import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import Draggable from 'react-draggable';
import CrossIcon from '../components/Icons/CrossIcon';
import DiamondIcon from '../components/Icons/DiamondIcon';
import { useErrorMonitoring } from './ErrorMonitoringContext';

export type TransactionStep = {
  title: string;
  description?: ReactNode;
  transaction: {
    methodCall: () => Promise<ContractTransactionResponse>;
    waitForResponseOf: number[];
    reloadQueriesAferMined?: Parameters<ApolloClient<object>['refetchQueries']>[0]['include'];
    actionAfterMined?: (client: ApolloClient<object>) => void;
  };
};

type StepState = {
  resultPromise?: ContractTransactionResponse;
  transactionReceipt?: ContractTransactionReceipt | null;
  status: 'pending' | 'success' | 'error' | 'waiting';
  error?: string;
};

/**
 * Contracts are not yet deployed and therefore we instead show some demo steps in the client.
 * In testing the real implementation is kept because it can be mocked.
 */
const createDemoSteps = (steps: TransactionStep[]): TransactionStep[] => {
  if (process.env.NODE_ENV !== 'test' && process.env.NEXT_PUBLIC_CONTRACT_MOCKING !== 'disabled') {
    return steps.map(({ transaction, ...props }, index) => {
      const signTimeout = Math.random() * 1000;
      const mineTimeout = Math.random() * 1000;

      return {
        ...props,
        transaction: {
          methodCall: () =>
            new Promise((res) =>
              setTimeout(
                () =>
                  res({
                    wait: () => new Promise((res) => setTimeout(() => res(true), mineTimeout)),
                  } as any),
                signTimeout,
              ),
            ),
          waitForResponseOf: transaction.waitForResponseOf.length > 0 ? Array(index).map((_, index) => index) : [],
        },
      };
    });
  } else {
    return steps;
  }
};

export const TransactionDialogContext = createContext<{
  steps: TransactionStep[];
  setSteps: (steps: TransactionStep[], actionAfterCompleted?: () => void) => void;
  transactionPending: boolean;
}>({
  steps: [],
  setSteps: () => {},
  transactionPending: false,
});

export default function TransactionDialogProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const { Sentry } = useErrorMonitoring();
  const { enqueueSnackbar } = useSnackbar();
  const client = useApolloClient();

  const [steps, setSteps] = useState<TransactionStep[]>([]);
  const [stepsState, setStepsState] = useState<StepState[]>([]);
  const [actionAfterCompleted, setActionAfterCompleted] = useState<() => void>();
  const [transactionPending, setTransactionPending] = useState(false);

  const [activeStep, setActiveStep] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (steps.length > 0) {
      setActiveStep(0);
    } else {
      setActiveStep(undefined);
      setStepsState(Array(steps.length).fill({ status: 'waiting' }));
    }
  }, [steps]);

  useEffect(() => {
    if (activeStep !== undefined) {
      const {
        transaction: { methodCall, waitForResponseOf, reloadQueriesAferMined = [], actionAfterMined },
      } = steps[activeStep];
      // First wait if previous necessary steps have been mined
      Promise.all(waitForResponseOf.map((stepIndex) => stepsState[stepIndex].resultPromise?.wait())).then(async () => {
        // wait for signing
        methodCall()
          .then((resultPromise) => {
            // set initial mining state and update it once Promise resolves.
            setStepsState((stepsState) => {
              const currentStep = activeStep;
              const newStepsState = [...stepsState];
              newStepsState[currentStep] = {
                status: 'pending',
                resultPromise: resultPromise,
              };

              return newStepsState;
            });

            const activeStepSaved = activeStep;
            resultPromise.wait().then((transactionReceipt) => {
              setStepsState((stepsState) => {
                const newStepsState = [...stepsState];
                newStepsState[activeStepSaved] = { status: 'success', transactionReceipt };
                return newStepsState;
              });

              if (actionAfterMined) {
                actionAfterMined(client);
              }
              if (reloadQueriesAferMined.length > 0) {
                client.refetchQueries({ include: reloadQueriesAferMined });
              }

              if (activeStep === steps.length - 1) {
                actionAfterCompleted?.();
                enqueueSnackbar('All transactions have been confirmed.', { variant: 'success' });
                setTransactionPending(false);
                setActiveStep(undefined);
                setSteps([]);
              }
            });

            if (activeStep < steps.length - 1) {
              if (!stepsState.some((step) => step.status === 'error')) {
                setActiveStep((activeStep) => (activeStep as number) + 1);
              }
            }
          })
          .catch((error: { message: string; cause?: BaseContract }) => {
            console.error('error: ', error);
            // Allow interaction from the start
            setTransactionPending(false);

            const showError = (errorMessage: string) => {
              setStepsState((stepsState) => {
                const newStepsState = [...stepsState];
                newStepsState[activeStep] = {
                  ...newStepsState[activeStep],
                  status: 'error',
                  error: errorMessage,
                };
                return newStepsState;
              });
              setTimeout(() => {
                setActiveStep(undefined);
                setSteps([]);
              }, 10000);
            };

            if (error.cause) {
              // Get the "data" bytes to parse the error message
              const dataRegex = /data="([^"]*)"/;
              const match = error.message.match(dataRegex);
              if (match && match[1]) {
                // Sometimes rejects because of: RangeError: cannot slice beyond data bounds (buffer=0x, length=0, offset=4, code=BUFFER_OVERRUN, version=6.7.0)
                try {
                  const errorMessage = error.cause.interface.parseError(match[1]);
                  if (errorMessage) {
                    Sentry.captureException(`${error}: ${errorMessage}`);
                    enqueueSnackbar(`Error: ${errorMessage.name}`, { variant: 'error' });
                    showError(errorMessage.name);
                    return;
                  }
                } catch {
                  Sentry.captureException(error);
                  enqueueSnackbar('Transaction was rejected.', { variant: 'error' });
                  showError('Transaction was rejected.');
                  return;
                }
              }
            }

            Sentry.captureException(error);
            enqueueSnackbar('Transaction was rejected.', { variant: 'error' });
            showError('Transaction was rejected.');
          });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep]);

  const getIcon = (status: StepState['status']) => {
    switch (status) {
      case 'waiting':
        return undefined;
      case 'pending':
        // @ts-ignore
        return ({ error, completed, active, ...props }) => <CircularProgressSmall {...props} />;
      case 'success':
        // @ts-ignore
        return ({ error, completed, active, ...props }) => <CheckCircleIcon {...props} />;
      case 'error':
        // @ts-ignore
        return ({ error, completed, active, ...props }) => <ErrorIcon {...props} />;
      default:
        const _exhaustiveCheck: never = status;
        return undefined;
    }
  };

  return (
    <TransactionDialogContext.Provider
      value={{
        steps,
        setSteps: (steps: TransactionStep[], actionAfterCompleted?: () => void) => {
          setActionAfterCompleted(() => actionAfterCompleted);
          setSteps(createDemoSteps(steps));
        },
        transactionPending,
      }}
    >
      <>
        <Draggable
          handle={'[class*="MuiDialog-root"]'}
          cancel={'[class*="MuiDialogContent-root"]'}
          defaultPosition={{ x: 5, y: 50 }}
        >
          <Dialog
            open={activeStep !== undefined}
            onClose={() => {
              setSteps([]);
              setActiveStep(undefined);
              setTransactionPending(false);
            }}
            maxWidth="sm"
            fullWidth
            disableEnforceFocus // Allows other things to take focus
            hideBackdrop // Hides the shaded backdrop
            disableScrollLock
            disableAutoFocus // Prevents backdrop clicks
            sx={{
              height: 'fit-content', // Ensures that the dialog is
              width: 'fit-content', // exactly the same size as its contents
            }}
            PaperProps={{
              sx: {
                boxShadow: 'none',
                border: '1px solid',
                borderColor: 'background.paper',
              },
            }}
            // @ts-ignore
            componentsProps={{ backdrop: { 'data-testid': 'apollon-transaction-signer-dialog-backdrop' } }}
          >
            <DialogTitle
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'background.default',
                cursor: 'grab',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <DiamondIcon isDialog />
                <Typography variant="h6" display="inline-block">
                  {`${steps.length} transactions in progress.`}
                </Typography>
              </div>
              <IconButton
                onClick={() => {
                  setSteps([]);
                  setActiveStep(undefined);
                }}
                aria-label="close transaction dialog"
              >
                <CrossIcon />
              </IconButton>
            </DialogTitle>

            <DialogContent
              sx={{
                p: 0,
                backgroundColor: 'background.default',
              }}
            >
              <Alert severity="info">
                Please sign each transaction and do not close this window until all transactions are confirmed. Some
                actions require previous approvals to be mined first and might take some time.
              </Alert>

              <Box sx={{ padding: '20px' }}>
                <Stepper activeStep={activeStep} orientation="vertical">
                  {steps.map(({ title, description, transaction }, index) => (
                    <Step key={index}>
                      <StepLabel
                        error={Boolean(stepsState[index]?.error)}
                        StepIconComponent={getIcon(stepsState[index]?.status)}
                        StepIconProps={{ color: stepsState[index]?.status === 'error' ? 'error' : 'primary' }}
                        optional={
                          stepsState[index]?.status === 'error' ? (
                            <Typography variant="caption" fontSize={10} color="error">
                              Error: {stepsState[index]?.error}
                            </Typography>
                          ) : (
                            description
                          )
                        }
                      >
                        {title}{' '}
                        {transaction.waitForResponseOf.length > 0 &&
                          `(wait until step ${transaction.waitForResponseOf
                            .map((number) => `"${number}"`)
                            .join(', ')} resolve first)`}
                      </StepLabel>
                    </Step>
                  ))}
                </Stepper>
              </Box>
            </DialogContent>
          </Dialog>
        </Draggable>

        {children}
      </>
    </TransactionDialogContext.Provider>
  );
}
const CircularProgressSmall = (props: CircularProgressProps) => {
  const size = 24;

  return <CircularProgress size={size} {...props} />;
};

export function useTransactionDialog(): {
  steps: TransactionStep[];
  setSteps: (steps: TransactionStep[], actionAfterCompleted?: () => void) => void;
  transactionPending: boolean;
} {
  const context = useContext(TransactionDialogContext);
  if (context === undefined) {
    throw new Error('useTransactionDialog must be used within an TransactionDialogContextProvider');
  }
  return context;
}
