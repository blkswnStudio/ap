'use client';

import { Box, Skeleton, debounce } from '@mui/material';
import Button from '@mui/material/Button';
import InputAdornment from '@mui/material/InputAdornment';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { ethers } from 'ethers';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { FormProvider, useController, useForm } from 'react-hook-form';
import { isDebtTokenAddress } from '../../../../config';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { usePriceFeedData } from '../../../context/PriceFeedDataProvider';
import { useSelectedToken } from '../../../context/SelectedTokenProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { evictCacheTimeoutForObject } from '../../../context/utils';
import {
  GET_ALL_POOLS,
  GET_BORROWER_COLLATERAL_TOKENS,
  GET_BORROWER_DEBT_TOKENS,
  GET_SYSTEMINFO,
} from '../../../queries';
import { WIDGET_HEIGHTS } from '../../../utils/constants';
import { getHints } from '../../../utils/crypto';
import {
  convertToEtherPrecission,
  dangerouslyConvertBigIntToNumber,
  displayPercentage,
  floatToBigInt,
  roundCurrency,
} from '../../../utils/math';
import InfoButton from '../../Buttons/InfoButton';
import RecoveryModeMarketCloseWrapper from '../../Buttons/RecoveryModeWrapper';
import FeatureBox from '../../FeatureBox/FeatureBox';
import NumberInput from '../../FormControls/NumberInput';
import ForwardIcon from '../../Icons/ForwardIcon';
import Label from '../../Label/Label';
import CollateralRatioVisualization from '../../Visualizations/CollateralRatioVisualization';

type FieldValues = {
  farmShortValue: string;
  maxSlippage: string;
};

const Farm = () => {
  const [tabValue, setTabValue] = useState<'Long' | 'Short'>('Long');
  const [showSlippage, setShowSlippage] = useState(false);
  const [oldRatio, setOldRatio] = useState<number | null>(null);
  const [newRatio, setNewRatio] = useState<number | null>(null);
  const [oldCriticalRatio, setOldCriticalRatio] = useState<number | null>(null);
  const [dynamicSwapFee, setDynamicSwapFee] = useState<bigint | null>(null);
  const [pricePerUnit, setPricePerUnit] = useState<bigint | null>(null);
  const [expectedPositionSize, setExpectedPositionSize] = useState<bigint | null>(null);
  const [isSwapFeeCalculationInProgress, setIsSwapFeeCalculationInProgress] = useState(false);

  const {
    address,
    currentNetwork,
    contracts: { swapOperationsContract, sortedTrovesContract, hintHelpersContract },
  } = useEthers();
  const { getPythUpdateData } = usePriceFeedData();
  const { Sentry } = useErrorMonitoring();
  const { setSteps } = useTransactionDialog();
  const { selectedToken, tokenRatio, JUSDToken } = useSelectedToken();

  const methods = useForm<FieldValues>({
    defaultValues: {
      farmShortValue: '',
      maxSlippage: '2',
    },
    reValidateMode: 'onSubmit',
  });
  const { handleSubmit, reset, watch, setError, control } = methods;
  const { field: farmShortValueField } = useController({ name: 'farmShortValue', control });

  const ratioChangeCallback = useCallback(
    (newRatio: number, oldRatio: number, _: number, __: number, oldCriticalRatio: number) => {
      setNewRatio(newRatio);
      setOldRatio(oldRatio);
      setOldCriticalRatio(oldCriticalRatio);
    },
    [setNewRatio, setOldRatio],
  );

  const handleTabChange = (_: React.SyntheticEvent, newValue: 'Long' | 'Short') => {
    setTabValue(newValue);
    setDynamicSwapFee(null);
    setPricePerUnit(null);
    reset();
  };

  const onSubmit = async (data: FieldValues) => {
    Sentry.addBreadcrumb({
      category: 'farm',
      message: `Attempting to farm with data`,
      level: 'info',
      data: {
        ...data,
        tabValue,
      },
    });

    const farmShortValue = parseFloat(data.farmShortValue);
    const maxSlippage = parseFloat(data.maxSlippage) / 100;
    const deadline = new Date().getTime() + 1000 * 60 * 2; // 2 minutes
    const _maxMintFeePercentage = floatToBigInt(0.02);

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

    if (tabValue === 'Long') {
      setSteps([
        {
          title: 'Open Long Position',
          transaction: {
            methodCall: async () => {
              const [upperHint, lowerHint] = await getHints(sortedTrovesContract, hintHelpersContract, {
                borrower: address,
                addedColl: [],
                addedDebt: [
                  {
                    tokenAddress: JUSDToken!.address,
                    amount: floatToBigInt(farmShortValue),
                  },
                ],
                removedColl: [],
                removedDebt: [],
              });
              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

              return swapOperationsContract
                .openLongPosition(
                  floatToBigInt(farmShortValue),
                  (expectedPositionSize! * ethers.parseEther((1 - maxSlippage).toString())) /
                    (ethers.parseUnits('1', 18) * ethers.parseUnits('1', 18 - selectedToken!.decimals)),
                  selectedToken!.address,
                  address,
                  {
                    upperHint,
                    lowerHint,
                    maxFeePercentage: _maxMintFeePercentage,
                  },
                  deadline,
                  updateDataInBytes,
                  { value: priceUpdateFee },
                )
                .catch((err) => {
                  throw new Error(err, { cause: swapOperationsContract });
                });
            },
            waitForResponseOf: [],
            // Only refetch coll tokens if they were part of the swap
            reloadQueriesAfterMined: !isDebtTokenAddress(selectedToken!.address)
              ? [GET_BORROWER_COLLATERAL_TOKENS, GET_BORROWER_DEBT_TOKENS, GET_ALL_POOLS, GET_SYSTEMINFO]
              : [GET_BORROWER_DEBT_TOKENS, GET_ALL_POOLS, GET_SYSTEMINFO],
            actionAfterMined: (client) => {
              client.cache.evict({ fieldName: 'getSystemInfo' });
              client.cache.gc();
              evictCacheTimeoutForObject(currentNetwork!, ['TroveManager']);
            },
          },
        },
      ]);
    } else {
      setSteps([
        {
          title: 'Open Short Position',
          transaction: {
            methodCall: async () => {
              const [upperHint, lowerHint] = await getHints(sortedTrovesContract, hintHelpersContract, {
                borrower: address,
                addedColl: [],
                addedDebt: [
                  {
                    tokenAddress: JUSDToken!.address,
                    amount: expectedPositionSize! / ethers.parseUnits('1', 18 - selectedToken!.decimals),
                  },
                ],
                removedColl: [],
                removedDebt: [],
              });

              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

              return swapOperationsContract
                .openShortPosition(
                  floatToBigInt(farmShortValue),
                  (expectedPositionSize! * ethers.parseEther((1 - maxSlippage).toString())) /
                    (ethers.parseUnits('1', 18) * ethers.parseUnits('1', 18 - selectedToken!.decimals)),
                  selectedToken!.address,
                  address,
                  {
                    upperHint,
                    lowerHint,
                    maxFeePercentage: _maxMintFeePercentage,
                  },
                  deadline,
                  updateDataInBytes,
                  { value: priceUpdateFee },
                )
                .catch((err) => {
                  throw new Error(err, { cause: swapOperationsContract });
                });
            },
            waitForResponseOf: [],
            // Only refetch coll tokens if they were part of the swap
            reloadQueriesAfterMined: [GET_BORROWER_DEBT_TOKENS, GET_ALL_POOLS, GET_SYSTEMINFO],
            actionAfterMined: (client) => {
              client.cache.evict({ fieldName: 'getSystemInfo' });
              client.cache.gc();
              evictCacheTimeoutForObject(currentNetwork!, ['TroveManager']);
            },
          },
        },
      ]);
    }
  };

  const watchFarmShortValue = parseFloat(watch('farmShortValue'));

  const addedDebtUSD =
    !isNaN(watchFarmShortValue) && JUSDToken
      ? tabValue === 'Long'
        ? watchFarmShortValue * dangerouslyConvertBigIntToNumber(JUSDToken.priceUSDOracle, 9, 9)
        : watchFarmShortValue * dangerouslyConvertBigIntToNumber(tokenRatio * JUSDToken.priceUSDOracle, 18 + 9, 9)
      : 0;
  const borrowingFee = tabValue === 'Long' ? JUSDToken?.borrowingRate : selectedToken!.borrowingRate;

  const updateExpectedPositionAndSwapFee = async (value: string) => {
    const isDefined = !isNaN(parseFloat(value)) && parseFloat(value) > 0;

    if (isDefined) {
      const valueAsBigint = ethers.parseUnits(
        value,
        tabValue === 'Long' ? JUSDToken?.decimals : selectedToken!.decimals,
      );
      if (tabValue === 'Long') {
        const amountsInStable = (valueAsBigint * (floatToBigInt(1) - borrowingFee!)) / floatToBigInt(1);

        const [[[, stableFeeAmount], [tokenAmount]], isUsablePrice] = await swapOperationsContract.getAmountsOut(
          amountsInStable,
          [JUSDToken!.address, selectedToken!.address],
        );

        setDynamicSwapFee((stableFeeAmount * floatToBigInt(1)) / amountsInStable);
        const tokenAmountNormalized = convertToEtherPrecission(tokenAmount, selectedToken!.decimals);
        setExpectedPositionSize(tokenAmountNormalized);
        setPricePerUnit((valueAsBigint * floatToBigInt(1)) / tokenAmountNormalized);
      } else {
        const amountsInToken = (valueAsBigint * (floatToBigInt(1) - borrowingFee!)) / floatToBigInt(1);

        const [[[, tokenFeeAmount], [stableAmount]]] = await swapOperationsContract.getAmountsOut(amountsInToken, [
          selectedToken!.address,
          JUSDToken!.address,
        ]);

        const tokenFeeNormalized = convertToEtherPrecission(tokenFeeAmount, selectedToken!.decimals);
        setDynamicSwapFee((tokenFeeNormalized * floatToBigInt(1)) / amountsInToken);
        setExpectedPositionSize(stableAmount);
        setPricePerUnit((stableAmount * floatToBigInt(1)) / valueAsBigint);
      }
    } else {
      setDynamicSwapFee(null);
      setExpectedPositionSize(null);
      setPricePerUnit(null);
    }

    setIsSwapFeeCalculationInProgress(false);
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const updatePositionSizeAndSwapFeeDebounce = useCallback(debounce(updateExpectedPositionAndSwapFee, 500), [
    selectedToken,
    tabValue,
  ]);

  /**
   * Respects borrowing fee and swap fee by using expectedPositionSize
   * @returns price impact of input amounts in percent
   */
  const getPriceImpact = () => {
    const {
      pool: { liquidityPair },
      decimals,
    } = selectedToken!;
    if (!expectedPositionSize) return 0;

    // FIXME: Decimals are always the pairToken decimals e.g. 6 for USDT. Is this really so????
    const liq0 = dangerouslyConvertBigIntToNumber(liquidityPair[0], 9, 9);
    const liq1 = dangerouslyConvertBigIntToNumber(convertToEtherPrecission(liquidityPair[1], decimals), 9, 9);

    const currentPrice = liq0 / liq1;

    const positionSizeWithFees = dangerouslyConvertBigIntToNumber(
      expectedPositionSize,
      expectedPositionSize.toString().length - 9,
      18 - (expectedPositionSize.toString().length - 9),
    );
    let newPriceAfterSwap: number;
    if (tabValue === 'Short') {
      // Calculate new amount of the other token after swap
      const newY = (liq1 * liq0) / (liq0 + positionSizeWithFees);
      newPriceAfterSwap = positionSizeWithFees / (liq1 - newY);
    } else {
      // Calculate new amount of STABLE after swap
      const newX = (liq0 * liq1) / (liq1 + positionSizeWithFees);
      newPriceAfterSwap = (liq0 - newX) / positionSizeWithFees;
    }

    // Calculate price impact
    const priceImpact = (newPriceAfterSwap - currentPrice) / currentPrice;
    return Math.abs(priceImpact) > 1 ? 1 : Math.abs(priceImpact);
  };

  useEffect(() => {
    reset();
    setTabValue('Long');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedToken]);

  return (
    <FeatureBox
      title="Farm"
      border="bottom"
      isDraggable={{
        y: '2',
        gsHeight: WIDGET_HEIGHTS['apollon-farm-widget'].toString(),
        gsWidth: '1',
        id: 'apollon-farm-widget',
      }}
    >
      <div style={{ height: '530px', overflowY: 'scroll' }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="fullWidth" sx={{ mx: '-15px' }}>
          <Tab label="BUY" value="Long" />
          <Tab label="SELL" value="Short" disabled={!selectedToken || !isDebtTokenAddress(selectedToken.address)} />
        </Tabs>

        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div style={{ marginTop: '20px' }}>
              <div>
                <NumberInput
                  data-testid="apollon-farm-amount"
                  name="farmShortValue"
                  rules={{
                    required: { value: true, message: 'You need to specify an amount.' },
                    min: { value: 0, message: 'Amount needs to be positive.' },
                  }}
                  disabled={!selectedToken}
                  fullWidth
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    farmShortValueField.onChange(e);
                    setIsSwapFeeCalculationInProgress(true);
                    updatePositionSizeAndSwapFeeDebounce(e.target.value);
                  }}
                  InputProps={{
                    endAdornment: selectedToken && (
                      <InputAdornment position="end">
                        <Label variant="none">{tabValue === 'Long' ? JUSDToken?.symbol : selectedToken.symbol}</Label>
                      </InputAdornment>
                    ),
                  }}
                />

                {showSlippage && (
                  <NumberInput
                    data-testid="apollon-farm-slippage-amount"
                    name="maxSlippage"
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
              </div>

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
                  Expected position size:
                  {selectedToken && !isSwapFeeCalculationInProgress ? (
                    tabValue === 'Long' ? (
                      <span data-testid="apollon-farm-position-size">
                        {!isNaN(watchFarmShortValue) && selectedToken && expectedPositionSize
                          ? `${roundCurrency(
                              dangerouslyConvertBigIntToNumber(
                                expectedPositionSize,
                                expectedPositionSize.toString().length - 9,
                                18 - (expectedPositionSize.toString().length - 9),
                              ),
                              5,
                              5,
                            )} ${selectedToken.symbol}`
                          : '-'}
                      </span>
                    ) : (
                      <span data-testid="apollon-farm-position-size">
                        {!isNaN(watchFarmShortValue) && selectedToken && expectedPositionSize
                          ? `${roundCurrency(dangerouslyConvertBigIntToNumber(expectedPositionSize, expectedPositionSize.toString().length - 9, 18 - (expectedPositionSize.toString().length - 9)), 5, 5)} ${JUSDToken?.symbol ?? ''}`
                          : '-'}
                      </span>
                    )
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
                  Price per unit:
                  {!isSwapFeeCalculationInProgress && JUSDToken && selectedToken && borrowingFee ? (
                    <span>
                      {roundCurrency(
                        dangerouslyConvertBigIntToNumber(
                          pricePerUnit ??
                            (tokenRatio * (floatToBigInt(1) + selectedToken!.swapFee + borrowingFee!)) /
                              floatToBigInt(1),
                          18,
                          undefined,
                          Infinity,
                        ),
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
                  Protocol swap fee:
                  {!isSwapFeeCalculationInProgress && selectedToken ? (
                    <span data-testid="apollon-farm-protocol-fee">
                      {' '}
                      {displayPercentage(
                        dangerouslyConvertBigIntToNumber(dynamicSwapFee ?? selectedToken.swapFee, 12, 6),
                      )}
                    </span>
                  ) : (
                    <Skeleton width="55px" />
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
                  Borrowing fee:
                  {borrowingFee ? (
                    <span data-testid="apollon-farm-borrowing-fee">
                      {displayPercentage(dangerouslyConvertBigIntToNumber(borrowingFee, 9, 9))}
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
                  Slippage:
                  {!isSwapFeeCalculationInProgress && JUSDToken ? (
                    watchFarmShortValue && selectedToken ? (
                      <span>{displayPercentage(getPriceImpact())}</span>
                    ) : (
                      <span>{displayPercentage(0)}</span>
                    )
                  ) : (
                    <Skeleton width="55px" />
                  )}
                </Typography>
              </div>

              <RecoveryModeMarketCloseWrapper respectRecoveryMode respectMarketClose>
                <InfoButton
                  title="EXECUTE"
                  description="The final values will be calculated after the swap."
                  disabled={
                    isSwapFeeCalculationInProgress ||
                    !address ||
                    !JUSDToken ||
                    !oldRatio ||
                    !newRatio ||
                    !oldCriticalRatio ||
                    newRatio <= oldCriticalRatio ||
                    !selectedToken
                  }
                />
              </RecoveryModeMarketCloseWrapper>
            </div>
          </form>
        </FormProvider>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '20px',
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
              {oldRatio !== null ? displayPercentage(oldRatio, 'default', 0) : <Skeleton variant="text" width={50} />}
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
              {newRatio !== null ? displayPercentage(newRatio, 'default', 0) : <Skeleton variant="text" width={50} />}
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
          <Typography variant="shady">Minimum Collateral Ratio</Typography>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
      </div>
    </FeatureBox>
  );
};

export default Farm;
