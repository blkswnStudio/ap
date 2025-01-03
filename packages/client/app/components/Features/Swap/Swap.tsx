'use client';

import { useQuery } from '@apollo/client';
import { IconButton, Skeleton, debounce } from '@mui/material';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import { ethers, parseEther } from 'ethers';
import { useSnackbar } from 'notistack';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { FormProvider, useController, useForm } from 'react-hook-form';
import { isCollateralTokenAddress, isDebtTokenAddress, isStableCoinAddress } from '../../../../config';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { usePriceFeedData } from '../../../context/PriceFeedDataProvider';
import { useSelectedToken } from '../../../context/SelectedTokenProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { useUtilities } from '../../../context/UtilityProvider';
import { evictCacheTimeoutForObject } from '../../../context/utils';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
  GetBorrowerDebtTokensQuery,
  GetBorrowerDebtTokensQueryVariables,
} from '../../../generated/gql-types';
import {
  GET_ALL_POOLS,
  GET_BORROWER_COLLATERAL_TOKENS,
  GET_BORROWER_DEBT_TOKENS,
  GET_BORROWER_SWAPS,
} from '../../../queries';
import { WIDGET_HEIGHTS } from '../../../utils/constants';
import { getCheckSum } from '../../../utils/crypto';
import {
  convertToEtherPrecission,
  dangerouslyConvertBigIntToNumber,
  displayPercentage,
  floatToBigInt,
  roundCurrency,
  roundNumber,
} from '../../../utils/math';
import InfoButton from '../../Buttons/InfoButton';
import FeatureBox from '../../FeatureBox/FeatureBox';
import NumberInput from '../../FormControls/NumberInput';
import ExchangeIcon from '../../Icons/ExchangeIcon';
import Label from '../../Label/Label';

export const RESULTING_POOL_SLIPPAGE = 0.02;

type FieldValues = {
  jUSDAmount: string;
  tokenAmount: string;
  maxSlippage: string;
};

const Swap = () => {
  const { enqueueSnackbar } = useSnackbar();

  const [showSlippage, setShowSlippage] = useState(false);
  const [tradingDirection, setTradingDirection] = useState<'jUSDSpent' | 'jUSDAquired'>('jUSDSpent');
  const [inputToken, setInputToken] = useState<'JUSD' | 'Token'>('JUSD');
  const [dynamicSwapFee, setDynamicSwapFee] = useState<bigint | null>(null);
  const [pricePerUnit, setPricePerUnit] = useState<bigint | null>(null);
  const [isSwapFeeCalculationInProgress, setIsSwapFeeCalculationInProgress] = useState(false);

  const { Sentry } = useErrorMonitoring();
  const {
    address,
    currentNetwork,
    contracts: { swapOperationsContract, collateralTokenContracts, debtTokenContracts },
  } = useEthers();
  const { getAllowance } = useUtilities();
  const { getPythUpdateData } = usePriceFeedData();
  const { setSteps } = useTransactionDialog();
  const { selectedToken, tokenRatio, JUSDToken } = useSelectedToken();

  const { data: debtTokenData } = useQuery<GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables>(
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
  const { data: collTokenData } = useQuery<GetBorrowerCollateralTokensQuery, GetBorrowerCollateralTokensQueryVariables>(
    GET_BORROWER_COLLATERAL_TOKENS,
    {
      variables: {
        borrower: address,
      },
      skip: !address || !selectedToken?.address || !isCollateralTokenAddress(selectedToken.address),
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  const relevantToken: { walletAmount: bigint; token: { decimals: number } } = debtTokenData?.debtTokenMetas.find(
    ({ token: { address } }) => selectedToken && getCheckSum(address) === getCheckSum(selectedToken.address),
  ) ??
    collTokenData?.collateralTokenMetas.find(
      ({ token: { address } }) => selectedToken && getCheckSum(address) === getCheckSum(selectedToken.address),
    ) ?? {
      walletAmount: BigInt(0),
      token: {
        decimals: 18,
      },
    };
  const stableWalletAmount =
    debtTokenData?.debtTokenMetas.find(({ token: { address } }) => isStableCoinAddress(address))?.walletAmount ??
    BigInt(0);

  const methods = useForm<FieldValues>({
    defaultValues: {
      jUSDAmount: '',
      tokenAmount: '',
      maxSlippage: '2',
    },
    reValidateMode: 'onSubmit',
  });
  const { handleSubmit, setValue, watch, control, trigger, reset, setError } = methods;
  const { field: jUSDField } = useController({ name: 'jUSDAmount', control });
  const { field: tokenAmountField } = useController({ name: 'tokenAmount', control });

  const swapFeeFactor = selectedToken
    ? tradingDirection === 'jUSDSpent'
      ? parseEther('1') + (dynamicSwapFee ?? selectedToken.swapFee)
      : parseEther('1') - (dynamicSwapFee ?? selectedToken.swapFee)
    : BigInt(1);

  const handleSwapValueChange = async (
    variant: 'JUSD' | 'Token',
    value: string,
    tradingDirectionUpdated: typeof tradingDirection = tradingDirection,
  ) => {
    const isDefined = !isNaN(parseFloat(value)) && parseFloat(value) > 0;

    if (variant === 'JUSD') {
      if (isDefined) {
        const stableInputAsBigint = ethers.parseEther(value);

        let tokenAmountToFill = 0n;

        if (tradingDirectionUpdated === 'jUSDSpent') {
          const [[[, stableFeeAmount], [tokenAmount]]] = await swapOperationsContract.getAmountsOut(
            stableInputAsBigint,
            [JUSDToken!.address, selectedToken!.address],
          );
          setDynamicSwapFee((stableFeeAmount * floatToBigInt(1)) / stableInputAsBigint);
          tokenAmountToFill = convertToEtherPrecission(tokenAmount, selectedToken!.decimals);
        } else {
          const [[[tokenAmount, tokenFeeAmount]]] = await swapOperationsContract.getAmountsIn(stableInputAsBigint, [
            selectedToken!.address,
            JUSDToken!.address,
          ]);
          setDynamicSwapFee((tokenFeeAmount * floatToBigInt(1)) / tokenAmount);
          tokenAmountToFill = convertToEtherPrecission(tokenAmount, selectedToken!.decimals);
        }

        setPricePerUnit((stableInputAsBigint * floatToBigInt(1)) / tokenAmountToFill);

        setValue('tokenAmount', roundNumber(dangerouslyConvertBigIntToNumber(tokenAmountToFill, 12, 6), 5).toString());
      } else {
        setValue('tokenAmount', '');
        setDynamicSwapFee(null);
        setPricePerUnit(null);
      }

      setValue('jUSDAmount', value);
    } else {
      if (isDefined) {
        const tokenInputAsBigint = ethers.parseUnits(value, selectedToken!.decimals);

        let stableAmountToFill = 0n;

        if (tradingDirectionUpdated === 'jUSDSpent') {
          const [[[stableAmount, stableFeeAmount]]] = await swapOperationsContract.getAmountsIn(tokenInputAsBigint, [
            JUSDToken!.address,
            selectedToken!.address,
          ]);
          setDynamicSwapFee((stableFeeAmount * floatToBigInt(1)) / stableAmount);
          stableAmountToFill = stableAmount;
        } else {
          const [[[, tokenFeeAmount], [stableAmount]]] = await swapOperationsContract.getAmountsOut(
            tokenInputAsBigint,
            [selectedToken!.address, JUSDToken!.address],
          );
          setDynamicSwapFee((tokenFeeAmount * floatToBigInt(1)) / tokenInputAsBigint);
          stableAmountToFill = stableAmount;
        }

        setPricePerUnit(
          (stableAmountToFill * floatToBigInt(1)) /
            convertToEtherPrecission(tokenInputAsBigint, selectedToken!.decimals),
        );

        setValue('jUSDAmount', roundNumber(dangerouslyConvertBigIntToNumber(stableAmountToFill, 12, 6), 5).toString());
      } else {
        setValue('jUSDAmount', '');
        setDynamicSwapFee(null);
        setPricePerUnit(null);
      }

      setValue('tokenAmount', value);
    }

    setInputToken(variant);
    setIsSwapFeeCalculationInProgress(false);
    trigger();
  };

  const onSubmit = async (data: FieldValues) => {
    // Just a safety check
    if (isSwapFeeCalculationInProgress) {
      return;
    }

    Sentry.addBreadcrumb({
      category: 'swap',
      message: `Attempting swap with data`,
      level: 'info',
      data: {
        ...data,
        tradingDirection,
        selectedToken: selectedToken?.address,
        inputToken,
        queryData: {
          debtTokenData,
          collTokenData,
        },
      },
    });

    const jUSDAmount = parseFloat(data.jUSDAmount);
    const tokenAmount = parseFloat(data.tokenAmount);
    const maxSlippage = parseFloat(data.maxSlippage) / 100;
    const deadline = new Date().getTime() + 1000 * 60 * 2; // 2 minutes

    const minSlippage = getPriceImpact();
    // validate slippage in case form control is closed
    if (minSlippage > maxSlippage) {
      setError('maxSlippage', {
        type: 'min',
        message: `You must allow a slippage of at least ${displayPercentage(minSlippage)} for your specific trade.`,
      });
      setShowSlippage(true);
      return;
    }

    if (tradingDirection === 'jUSDSpent') {
      const currentStableAllowance = await getAllowance(
        debtTokenContracts[currentNetwork!.contracts.DebtToken.STABLE],
        address,
        swapOperationsContract.target,
      );
      const amountStableToApprove =
        inputToken === 'JUSD' ? floatToBigInt(jUSDAmount) : floatToBigInt(jUSDAmount * (1 + maxSlippage));
      const stableApprovalNecessary = amountStableToApprove > currentStableAllowance;

      setSteps([
        ...(stableApprovalNecessary
          ? [
              {
                title: `Approve ${JUSDToken!.symbol} spending.`,
                transaction: {
                  methodCall: async () => {
                    return debtTokenContracts[currentNetwork!.contracts.DebtToken.STABLE].approve(
                      swapOperationsContract.target,
                      amountStableToApprove,
                    );
                  },
                  waitForResponseOf: [],
                },
              },
            ]
          : []),
        {
          title: `Swap ${JUSDToken!.symbol} for ${selectedToken?.symbol}.`,
          transaction: {
            methodCall: async () => {
              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

              if (inputToken === 'JUSD') {
                return swapOperationsContract
                  .swapExactTokensForTokens(
                    floatToBigInt(jUSDAmount),
                    floatToBigInt(tokenAmount * (1 - maxSlippage), selectedToken!.decimals),
                    [JUSDToken!.address, selectedToken!.address],
                    address,
                    deadline,
                    updateDataInBytes,
                    { value: priceUpdateFee },
                  )
                  .catch((err) => {
                    throw new Error(err, { cause: swapOperationsContract });
                  });
              } else {
                return swapOperationsContract
                  .swapTokensForExactTokens(
                    floatToBigInt(tokenAmount, selectedToken!.decimals),
                    floatToBigInt(jUSDAmount * (1 + maxSlippage)),
                    [JUSDToken!.address, selectedToken!.address],
                    address,
                    deadline,
                    updateDataInBytes,
                    { value: priceUpdateFee },
                  )
                  .catch((err) => {
                    throw new Error(err, { cause: swapOperationsContract });
                  });
              }
            },
            waitForResponseOf: stableApprovalNecessary ? [0] : [],
            reloadQueriesAfterMined: [
              GET_BORROWER_COLLATERAL_TOKENS,
              GET_BORROWER_DEBT_TOKENS,
              GET_BORROWER_SWAPS,
              GET_ALL_POOLS,
            ],
            actionAfterMined: () => {
              evictCacheTimeoutForObject(currentNetwork!, ['DebtToken', JUSDToken!.address]);

              if (isDebtTokenAddress(selectedToken!.address)) {
                evictCacheTimeoutForObject(currentNetwork!, ['DebtToken', selectedToken!.address], ['walletAmount']);
              } else {
                evictCacheTimeoutForObject(currentNetwork!, ['ERC20', selectedToken!.address], ['walletAmount']);
              }
            },
          },
        },
      ]);
    } else {
      const currentTokenAllowance = isCollateralTokenAddress(selectedToken!.address)
        ? await getAllowance(collateralTokenContracts[selectedToken!.address], address, swapOperationsContract.target)
        : isDebtTokenAddress(selectedToken!.address)
          ? await getAllowance(debtTokenContracts[selectedToken!.address], address, swapOperationsContract.target)
          : 0n;
      const amountTokenToApprove =
        inputToken === 'Token'
          ? floatToBigInt(tokenAmount, selectedToken!.decimals)
          : floatToBigInt(tokenAmount * (1 + maxSlippage), selectedToken!.decimals);
      const tokenApprovalNecessary = amountTokenToApprove > currentTokenAllowance;

      setSteps([
        ...(tokenApprovalNecessary
          ? [
              {
                title: `Approve spending of ${selectedToken!.symbol}`,
                transaction: {
                  methodCall: async () => {
                    if (isCollateralTokenAddress(selectedToken!.address)) {
                      return collateralTokenContracts[selectedToken!.address].approve(
                        swapOperationsContract.target,
                        amountTokenToApprove,
                      );
                    }

                    if (isDebtTokenAddress(selectedToken!.address)) {
                      return debtTokenContracts[selectedToken!.address].approve(
                        swapOperationsContract.target,
                        amountTokenToApprove,
                      );
                    }

                    return null as any;
                  },
                  waitForResponseOf: [],
                },
              },
            ]
          : []),
        {
          title: `Swap ${selectedToken!.symbol} for ${JUSDToken!.symbol}`,
          transaction: {
            methodCall: async () => {
              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

              if (inputToken === 'Token') {
                return swapOperationsContract
                  .swapExactTokensForTokens(
                    floatToBigInt(tokenAmount, selectedToken!.decimals),
                    floatToBigInt(jUSDAmount * (1 - maxSlippage)),
                    [selectedToken!.address, JUSDToken!.address],
                    address,
                    deadline,
                    updateDataInBytes,
                    { value: priceUpdateFee },
                  )
                  .catch((err) => {
                    throw new Error(err, { cause: swapOperationsContract });
                  });
              } else {
                return swapOperationsContract
                  .swapTokensForExactTokens(
                    floatToBigInt(jUSDAmount),
                    floatToBigInt(tokenAmount * (1 + maxSlippage), selectedToken!.decimals),
                    [selectedToken!.address, JUSDToken!.address],
                    address,
                    deadline,
                    updateDataInBytes,
                    { value: priceUpdateFee },
                  )
                  .catch((err) => {
                    throw new Error(err, { cause: swapOperationsContract });
                  });
              }
            },
            waitForResponseOf: tokenApprovalNecessary ? [0] : [],
            reloadQueriesAfterMined: [
              GET_BORROWER_COLLATERAL_TOKENS,
              GET_BORROWER_DEBT_TOKENS,
              GET_BORROWER_SWAPS,
              GET_ALL_POOLS,
            ],
            actionAfterMined: () => {
              evictCacheTimeoutForObject(currentNetwork!, ['DebtToken', JUSDToken!.address]);

              if (isDebtTokenAddress(selectedToken!.address)) {
                evictCacheTimeoutForObject(currentNetwork!, ['DebtToken', selectedToken!.address], ['walletAmount']);
              } else {
                evictCacheTimeoutForObject(currentNetwork!, ['ERC20', selectedToken!.address], ['walletAmount']);
              }
            },
          },
        },
      ]);
    }
  };

  const jUSDAmount = parseFloat(watch('jUSDAmount'));
  const tokenAmount = parseFloat(watch('tokenAmount'));

  /**
   *
   * @returns price impact of input amounts in percent
   */
  const getPriceImpact = () => {
    const {
      pool: { liquidityPair },
      decimals,
    } = selectedToken!;

    const liq0 = dangerouslyConvertBigIntToNumber(liquidityPair[0], 9, 9);
    const liq1 = dangerouslyConvertBigIntToNumber(convertToEtherPrecission(liquidityPair[1], decimals), 9, 9);
    const currentPrice = liq0 / liq1;

    // TODO: Take a look if this is correct. Diff with FARM
    let newPriceAfterSwap: number;
    if (tradingDirection === 'jUSDSpent') {
      const jUSDAmountWithFee = jUSDAmount * dangerouslyConvertBigIntToNumber(swapFeeFactor, 12, 6);
      // Calculate new amount of the other token after swap
      const newTokenAmount = (liq1 * liq0) / (liq0 + jUSDAmountWithFee);
      newPriceAfterSwap = jUSDAmountWithFee / (liq1 - newTokenAmount);
    } else {
      const tokenAmountWithFee = tokenAmount * dangerouslyConvertBigIntToNumber(swapFeeFactor, 12, 6);
      // Calculate new amount of STABLE after swap
      const newX = (liq0 * liq1) / (liq1 + tokenAmountWithFee);
      newPriceAfterSwap = (liq0 - newX) / tokenAmountWithFee;
    }

    // Calculate price impact
    const priceImpact = (newPriceAfterSwap - currentPrice) / currentPrice;
    return Math.abs(priceImpact) > 1 ? 1 : Math.abs(priceImpact);
  };

  useEffect(() => {
    reset();
  }, [selectedToken?.id, reset]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleSwapValueChangeDebounce = useCallback(debounce(handleSwapValueChange, 500), [
    selectedToken,
    JUSDToken,
    tradingDirection,
  ]);

  // Make it either 1 or 0.1 or 0.001 depending on the wallet amount of the user
  // Calculate the step size based on the wallet amount or the pool size, depending on which is smaller.
  const stepSizeToken = selectedToken
    ? selectedToken.pool.liquidityPair[1] > relevantToken.walletAmount
      ? dangerouslyConvertBigIntToNumber(relevantToken.walletAmount, selectedToken.decimals - 6, 6) > 1
        ? 1
        : dangerouslyConvertBigIntToNumber(relevantToken.walletAmount, selectedToken.decimals - 6, 6) > 0.1
          ? 0.1
          : 0.001
      : dangerouslyConvertBigIntToNumber(selectedToken.pool.liquidityPair[1], selectedToken.decimals - 6, 6) > 1
        ? 1
        : dangerouslyConvertBigIntToNumber(selectedToken.pool.liquidityPair[1], selectedToken.decimals - 6, 6) > 0.1
          ? 0.1
          : 0.001
    : 1;

  const tokenInput = (
    <NumberInput
      key="tokenAmount"
      name="tokenAmount"
      data-testid="apollon-swap-token-amount"
      rules={{
        required: { value: true, message: 'You need to specify an amount.' },
        min: { value: 0, message: 'Amount needs to be positive.' },
        max:
          selectedToken && tradingDirection === 'jUSDAquired'
            ? {
                value: Math.min(
                  dangerouslyConvertBigIntToNumber(relevantToken.walletAmount, selectedToken.decimals - 6, 6),
                  dangerouslyConvertBigIntToNumber(selectedToken.pool.liquidityPair[1], selectedToken.decimals - 6, 6),
                ),
                message: 'Amount exceeds wallet balance.',
              }
            : undefined,
      }}
      focused={inputToken === 'Token'}
      disabled={!selectedToken}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        if (
          parseFloat(e.target.value) >=
          dangerouslyConvertBigIntToNumber(selectedToken!.pool.liquidityPair[1], selectedToken!.decimals - 6, 6)
        ) {
          // Round to the maxValue of the pool - 1 step (because max is also not possible)
          e.target.value = (
            parseFloat(
              (
                Math.round(
                  dangerouslyConvertBigIntToNumber(
                    selectedToken!.pool.liquidityPair[1],
                    selectedToken!.decimals - 6,
                    6,
                  ) / stepSizeToken,
                ) * stepSizeToken
              ).toFixed(2),
            ) - stepSizeToken
          ).toFixed(2);
        }

        tokenAmountField.onChange(e);
        setIsSwapFeeCalculationInProgress(true);
        handleSwapValueChangeDebounce('Token', e.target.value);
      }}
      inputProps={{
        max: selectedToken
          ? dangerouslyConvertBigIntToNumber(selectedToken.pool.liquidityPair[1], selectedToken.decimals - 6, 6) -
            stepSizeToken
          : 0,
        step: stepSizeToken,
      }}
      InputProps={{
        endAdornment: selectedToken && (
          <InputAdornment position="end">
            <Label variant="none">{selectedToken.symbol}</Label>
          </InputAdornment>
        ),
      }}
    />
  );

  const jUSDInput = (
    <NumberInput
      key="jUSDAmount"
      name="jUSDAmount"
      data-testid="apollon-swap-jusd-amount"
      rules={{
        required: { value: true, message: 'You need to specify an amount.' },
        min: { value: 0, message: 'Amount needs to be positive.' },
        max:
          selectedToken && tradingDirection === 'jUSDSpent'
            ? {
                value: Math.min(
                  dangerouslyConvertBigIntToNumber(stableWalletAmount, 9, 9),
                  dangerouslyConvertBigIntToNumber(selectedToken!.pool.liquidityPair[0]),
                ),
                message: 'Amount exceeds wallet balance.',
              }
            : undefined,
      }}
      focused={inputToken === 'JUSD'}
      disabled={!selectedToken}
      onChange={(e: ChangeEvent<HTMLInputElement>) => {
        if (parseFloat(e.target.value) >= dangerouslyConvertBigIntToNumber(selectedToken!.pool.liquidityPair[0])) {
          e.target.value = (dangerouslyConvertBigIntToNumber(selectedToken!.pool.liquidityPair[0]) - 1).toString();
        }
        jUSDField.onChange(e);
        setIsSwapFeeCalculationInProgress(true);
        handleSwapValueChangeDebounce('JUSD', e.target.value);
      }}
      // Only applies then arrow keys are used
      inputProps={{
        max: selectedToken ? dangerouslyConvertBigIntToNumber(selectedToken.pool.liquidityPair[0]) - 1 : 0,
        step: 1,
      }}
      InputProps={{
        endAdornment: JUSDToken && (
          <InputAdornment position="end">
            <Label variant="none">{JUSDToken.symbol}</Label>
          </InputAdornment>
        ),
      }}
    />
  );

  const fillMaxSellInputValue = () => {
    setIsSwapFeeCalculationInProgress(true);
    if (tradingDirection === 'jUSDSpent') {
      handleSwapValueChange('JUSD', dangerouslyConvertBigIntToNumber(stableWalletAmount, 9, 9).toString());
    } else {
      handleSwapValueChange(
        'Token',
        dangerouslyConvertBigIntToNumber(relevantToken.walletAmount, relevantToken.token.decimals - 6, 6).toString(),
      );
    }
  };

  return (
    <FeatureBox
      title="Swap"
      border="bottom"
      isDraggable={{
        y: '1',
        gsHeight: WIDGET_HEIGHTS['apollon-swap-widget'].toString(),
        gsWidth: '1',
        id: 'apollon-swap-widget',
      }}
    >
      <div
        style={{
          height: '302px',
          overflowY: 'scroll',
        }}
      >
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {tradingDirection === 'jUSDSpent' ? jUSDInput : tokenInput}

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <Typography variant="caption" color="info.main">
                      {roundCurrency(
                        tradingDirection === 'jUSDSpent'
                          ? dangerouslyConvertBigIntToNumber(stableWalletAmount, 12, 6)
                          : dangerouslyConvertBigIntToNumber(
                              relevantToken.walletAmount,
                              relevantToken.token.decimals - 6,
                              6,
                            ),
                        5,
                        5,
                      )}
                    </Typography>
                    <Typography variant="label" paragraph>
                      Sell
                    </Typography>
                  </div>

                  <Button
                    variant="undercover"
                    sx={{ textDecoration: 'underline', p: 0, mt: 0.25, height: 25 }}
                    onClick={fillMaxSellInputValue}
                  >
                    max
                  </Button>
                </div>
              </div>

              <IconButton
                sx={{ height: 20, width: 20, margin: '8px 10px 0px 10px' }}
                size="small"
                disableRipple
                onClick={() => {
                  const updatedTradingDirection = tradingDirection === 'jUSDSpent' ? 'jUSDAquired' : 'jUSDSpent';
                  setTradingDirection(updatedTradingDirection);
                  setIsSwapFeeCalculationInProgress(true);

                  if (inputToken === 'JUSD' && jUSDAmount) {
                    handleSwapValueChange('JUSD', jUSDAmount.toString(), updatedTradingDirection);
                  } else if (tokenAmount) {
                    handleSwapValueChange('Token', tokenAmount.toString(), updatedTradingDirection);
                  }
                }}
              >
                <ExchangeIcon />
              </IconButton>

              <div>
                {tradingDirection === 'jUSDSpent' ? tokenInput : jUSDInput}

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <Typography variant="caption" color="info.main">
                      {roundCurrency(
                        tradingDirection === 'jUSDSpent'
                          ? dangerouslyConvertBigIntToNumber(
                              relevantToken.walletAmount,
                              relevantToken.token.decimals - 6,
                              6,
                            )
                          : dangerouslyConvertBigIntToNumber(stableWalletAmount, 12, 6),
                        5,
                        5,
                      )}
                    </Typography>
                    <Typography variant="label" paragraph>
                      Buy
                    </Typography>
                  </div>
                </div>
              </div>
            </div>

            {showSlippage && (
              <NumberInput
                name="maxSlippage"
                data-testid="apollon-swap-slippage-amount"
                rules={{
                  min: { value: getPriceImpact() * 100, message: 'The amount must be above the price impact.' },
                  max: { value: 100, message: 'Can not specify a greater amount.' },
                }}
                label="Max. Slippage"
                fullWidth
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
                sx={{ marginTop: '15px' }}
              />
            )}

            <Button
              disabled={!selectedToken}
              variant="contained"
              onClick={() => setShowSlippage(!showSlippage)}
              sx={{ marginTop: '10px' }}
            >
              {showSlippage ? 'Less' : 'More'}
            </Button>

            <div style={{ padding: '10px 0' }}>
              <Typography
                variant="titleAlternate"
                color="primary.contrastText"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  marginBottom: '12px',
                }}
              >
                Price per unit:
                {selectedToken ? (
                  <span>
                    {roundCurrency(
                      pricePerUnit
                        ? dangerouslyConvertBigIntToNumber(pricePerUnit, 12, 6, Infinity)
                        : dangerouslyConvertBigIntToNumber(tokenRatio * swapFeeFactor, 18 + 18 - 6, 6),
                      5,
                      5,
                    )}{' '}
                    {JUSDToken?.symbol ?? ''}
                  </span>
                ) : (
                  <Skeleton width="120px" />
                )}
              </Typography>
              <Typography
                variant="caption"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  marginBottom: '12px',
                }}
              >
                Swap fee:
                {selectedToken ? (
                  <span data-testid="apollon-swap-protocol-fee">
                    {displayPercentage(
                      dangerouslyConvertBigIntToNumber(dynamicSwapFee ?? selectedToken.swapFee, 12, 6),
                    )}
                  </span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, width: 120 }}>
                    <Skeleton width="55px" />
                    |
                    <Skeleton width="55px" />
                  </div>
                )}
              </Typography>
              <Typography
                variant="caption"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  marginBottom: '12px',
                }}
              >
                Resulting pool slippage:
                {JUSDToken ? (
                  (jUSDAmount || tokenAmount) && dynamicSwapFee ? (
                    <span>{displayPercentage(getPriceImpact())}</span>
                  ) : (
                    <span>{displayPercentage(0)}</span>
                  )
                ) : (
                  <Skeleton width="120px" />
                )}
              </Typography>
            </div>

            <InfoButton
              title="SWAP"
              description="The final values will be calculated after the swap."
              disabled={isSwapFeeCalculationInProgress || !address || !JUSDToken}
            />
          </form>
        </FormProvider>
      </div>
    </FeatureBox>
  );
};

export default Swap;
