'use client';

import { useQuery } from '@apollo/client';
import { Box, Skeleton } from '@mui/material';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { SyntheticEvent, useCallback, useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { isCollateralTokenAddress, isDebtTokenAddress, isStableCoinAddress } from '../../../../config';
import { IBase } from '../../../../generated/types/TroveManager';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { usePriceFeedData } from '../../../context/PriceFeedDataProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { useUtilities } from '../../../context/UtilityProvider';
import { evictCacheTimoutForObject } from '../../../context/utils';
import {
  DebtTokenMeta,
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
  GetBorrowerDebtTokensQuery,
  GetBorrowerDebtTokensQueryVariables,
  GetBorrowerLiquidityPoolsQuery,
  GetBorrowerLiquidityPoolsQueryVariables,
} from '../../../generated/gql-types';
import {
  GET_BORROWER_COLLATERAL_TOKENS,
  GET_BORROWER_DEBT_TOKENS,
  GET_BORROWER_LIQUIDITY_POOLS,
} from '../../../queries';
import { manualSubgraphSyncTimeout, standardDataPollInterval } from '../../../utils/contants';
import { getHints } from '../../../utils/crypto';
import {
  bigIntStringToFloat,
  dangerouslyConvertBigIntToNumber,
  displayPercentage,
  floatToBigInt,
  roundCurrency,
  roundNumber,
} from '../../../utils/math';
import RecoveryModeMarketCloseWrapper from '../../Buttons/RecoveryModeWrapper';
import FeatureBox from '../../FeatureBox/FeatureBox';
import NumberInput from '../../FormControls/NumberInput';
import ForwardIcon from '../../Icons/ForwardIcon';
import Label from '../../Label/Label';
import CollateralRatioVisualization, { CRIT_RATIO } from '../../Visualizations/CollateralRatioVisualization';

const SLIPPAGE = 0.02;

type Props = {
  selectedPoolId: string | null;
};

type FieldValues = {
  tokenAAmount: string;
  tokenBAmount: string;
};

function LiquidityDepositWithdraw({ selectedPoolId }: Props) {
  const {
    address,
    contracts: {
      swapOperationsContract,
      debtTokenContracts,
      collateralTokenContracts,
      troveManagerContract,
      sortedTrovesContract,
      hintHelpersContract,
    },
    currentNetwork,
  } = useEthers();
  const { getPythUpdateData } = usePriceFeedData();
  const { Sentry } = useErrorMonitoring();
  const { setSteps } = useTransactionDialog();
  const { getAllowance } = useUtilities();

  const [tabValue, setTabValue] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');

  const [oldRatio, setOldRatio] = useState<number | null>(null);
  const [newRatio, setNewRatio] = useState<number | null>(null);
  const [currentDebtValueUSD, setCurrentDebtValueUSD] = useState<number | null>(null);
  const [currentCollateralValueUSD, setCurrentCollateralValueUSD] = useState<number | null>(null);
  const [oldCriticalRatio, setOldCriticalRatio] = useState<number | null>(null);

  const { data: debtTokenData } = useQuery<GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables>(
    GET_BORROWER_DEBT_TOKENS,
    {
      variables: { borrower: address },
      skip: !address,
    },
  );
  const { data: collTokenData } = useQuery<GetBorrowerCollateralTokensQuery, GetBorrowerCollateralTokensQueryVariables>(
    GET_BORROWER_COLLATERAL_TOKENS,
    {
      variables: { borrower: address },
      skip: !address,
      pollInterval: standardDataPollInterval,
    },
  );

  // For Update after TX
  const { data: borrowerPoolsData } = useQuery<GetBorrowerLiquidityPoolsQuery, GetBorrowerLiquidityPoolsQueryVariables>(
    GET_BORROWER_LIQUIDITY_POOLS,
    { variables: { borrower: address } },
  );
  const selectedPool = borrowerPoolsData?.pools.find(({ id }) => id === selectedPoolId);

  const methods = useForm<FieldValues>({
    defaultValues: {
      tokenAAmount: '',
      tokenBAmount: '',
    },
    reValidateMode: 'onChange',
    shouldUnregister: true,
  });
  const { handleSubmit, setValue, reset, watch } = methods;

  const ratioChangeCallback = useCallback(
    (
      newRatio: number,
      oldRatio: number,
      currentDebtValueUSD: number,
      currentCollateralValueUSD: number,
      oldCriticalRatio: number,
    ) => {
      setNewRatio(newRatio);
      setOldRatio(oldRatio);
      setCurrentDebtValueUSD(currentDebtValueUSD);
      setCurrentCollateralValueUSD(currentCollateralValueUSD);
      setOldCriticalRatio(oldCriticalRatio);
    },
    [setNewRatio, setOldRatio],
  );

  useEffect(() => {
    if (!selectedPool?.borrowerAmount) {
      setTabValue('DEPOSIT');
    }

    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPool?.id]);

  // Wait until pool has been selected
  if (!selectedPool) return null;

  const { liquidity, borrowerAmount, totalSupply } = selectedPool;
  const [tokenA, tokenB] = liquidity.map((liquidity) => ({
    ...liquidity,
    token: { ...liquidity.token, priceUSD: dangerouslyConvertBigIntToNumber(liquidity.token.priceUSDOracle, 9, 9) },
  }));

  const pairHasCollateral =
    isCollateralTokenAddress(tokenA.token.address) || isCollateralTokenAddress(tokenB.token.address);
  const isCollateralPair =
    isCollateralTokenAddress(tokenA.token.address) && isCollateralTokenAddress(tokenB.token.address);

  const foundTokenA = (isDebtTokenAddress(tokenA.token.address)
    ? debtTokenData?.debtTokenMetas.find(({ token }) => token.address === tokenA.token.address) ?? {
        walletAmount: BigInt(0),
        troveRepableDebtAmount: BigInt(0),
      }
    : collTokenData?.collateralTokenMetas.find(({ token }) => token.address === tokenA.token.address)) ?? {
    walletAmount: BigInt(0),
  };

  const foundTokenB = (isDebtTokenAddress(tokenB.token.address)
    ? debtTokenData?.debtTokenMetas.find(({ token }) => token.address === tokenB.token.address) ?? {
        walletAmount: BigInt(0),
        troveRepableDebtAmount: BigInt(0),
      }
    : collTokenData?.collateralTokenMetas.find(({ token }) => token.address === tokenB.token.address)) ?? {
    walletAmount: BigInt(0),
  };

  const handleChange = (_: SyntheticEvent, newValue: 'DEPOSIT' | 'WITHDRAW') => {
    setTabValue(newValue);
    reset();
  };

  const onSubmit = async (data: FieldValues) => {
    Sentry.addBreadcrumb({
      category: 'addRemoveLiquidity',
      message: `Attempting add / remove liquidity with data`,
      level: 'info',
      data: {
        ...data,
        tabValue,
        selectedPool,
        queryData: {
          debtTokenData,
          collTokenData,
          borrowerPoolsData,
        },
      },
    });

    const tokenAAmount = data.tokenAAmount ? parseFloat(data.tokenAAmount) : 0;
    const tokenBAmount = data.tokenBAmount ? parseFloat(data.tokenBAmount) : 0;
    const deadline = new Date().getTime() + 1000 * 60 * 2; // 2 minutes
    const _maxMintFeePercentage = floatToBigInt(0.02);

    const collAmounts: IBase.TokenAmountStruct[] = [
      {
        tokenAddress: tokenA.token.address,
        amount: floatToBigInt(tokenAAmount),
      },
      {
        tokenAddress: tokenB.token.address,
        amount: floatToBigInt(tokenBAmount, tokenB.token.decimals),
      },
    ].filter(({ tokenAddress }) => isCollateralTokenAddress(tokenAddress));

    if (tabValue === 'DEPOSIT') {
      const currentAllowanceTokenA = isDebtTokenAddress(tokenA.token.address)
        ? await getAllowance(debtTokenContracts[tokenA.token.address], address, swapOperationsContract.target)
        : isCollateralTokenAddress(tokenA.token.address)
          ? await getAllowance(collateralTokenContracts[tokenA.token.address], address, swapOperationsContract.target)
          : 0n;
      const amountAToApprove = isDebtTokenAddress(tokenA.token.address)
        ? tokenAAmount > dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 9, 9)
          ? foundTokenA.walletAmount
          : floatToBigInt(tokenAAmount)
        : isCollateralTokenAddress(tokenA.token.address)
          ? floatToBigInt(tokenAAmount, tokenA.token.decimals)
          : 0n;
      const tokenAApprovalNecessary = amountAToApprove > currentAllowanceTokenA;

      const currentAllowanceTokenB = isDebtTokenAddress(tokenA.token.address)
        ? await getAllowance(debtTokenContracts[tokenA.token.address], address, swapOperationsContract.target)
        : isCollateralTokenAddress(tokenA.token.address)
          ? await getAllowance(collateralTokenContracts[tokenA.token.address], address, swapOperationsContract.target)
          : 0n;
      const amountBToApprove = isDebtTokenAddress(tokenB.token.address)
        ? tokenBAmount > dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 9, 9)
          ? foundTokenB.walletAmount
          : floatToBigInt(tokenBAmount)
        : isCollateralTokenAddress(tokenB.token.address)
          ? floatToBigInt(tokenBAmount, tokenB.token.decimals)
          : 0n;
      const tokenBApprovalNecessary = amountBToApprove > currentAllowanceTokenB;

      setSteps([
        ...(tokenAApprovalNecessary
          ? [
              {
                title: `Approve spending of ${tokenA.token.symbol}.`,
                transaction: {
                  methodCall: async () => {
                    if (isDebtTokenAddress(tokenA.token.address)) {
                      return debtTokenContracts[tokenA.token.address].approve(
                        swapOperationsContract.target,
                        amountAToApprove,
                      );
                    } else if (isCollateralTokenAddress(tokenA.token.address)) {
                      return collateralTokenContracts[tokenA.token.address].approve(
                        swapOperationsContract.target,
                        amountAToApprove,
                      );
                    }

                    return null as any;
                  },
                  waitForResponseOf: [],
                },
              },
            ]
          : []),
        ...(tokenBApprovalNecessary
          ? [
              {
                title: `Approve spending of ${tokenB.token.symbol}.`,
                transaction: {
                  methodCall: async () => {
                    if (isDebtTokenAddress(tokenB.token.address)) {
                      return debtTokenContracts[tokenB.token.address].approve(
                        swapOperationsContract.target,
                        amountBToApprove,
                      );
                    } else if (isCollateralTokenAddress(tokenB.token.address)) {
                      return collateralTokenContracts[tokenB.token.address].approve(
                        swapOperationsContract.target,
                        amountBToApprove,
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
          title: `Add Liquidity for ${tokenA.token.symbol} and ${tokenB.token.symbol}.`,
          transaction: {
            methodCall: async () => {
              // Only use what really minted
              const debtAmounts: IBase.TokenAmountStruct[] = [
                {
                  tokenAddress: tokenA.token.address,
                  amount:
                    floatToBigInt(tokenAAmount) > foundTokenA.walletAmount
                      ? floatToBigInt(tokenAAmount) - foundTokenA.walletAmount
                      : BigInt(0),
                },
                {
                  tokenAddress: tokenB.token.address,
                  amount:
                    floatToBigInt(tokenBAmount) > foundTokenB.walletAmount
                      ? floatToBigInt(tokenBAmount) - foundTokenB.walletAmount
                      : BigInt(0),
                },
              ].filter(({ tokenAddress, amount }) => isDebtTokenAddress(tokenAddress) && amount > 0);

              const [upperHint, lowerHint] = await getHints(sortedTrovesContract, hintHelpersContract, {
                borrower: address,
                addedColl: collAmounts,
                addedDebt: debtAmounts,
                removedColl: [],
                removedDebt: [],
              });
              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

              return swapOperationsContract
                .addLiquidity(
                  tokenA.token.address,
                  tokenB.token.address,
                  floatToBigInt(tokenAAmount, tokenA.token.decimals),
                  floatToBigInt(tokenBAmount, tokenB.token.decimals),
                  floatToBigInt(tokenAAmount * (1 - SLIPPAGE), tokenA.token.decimals),
                  floatToBigInt(tokenBAmount * (1 - SLIPPAGE), tokenB.token.decimals),
                  {
                    priceUpdateData: updateDataInBytes,
                    meta: {
                      lowerHint,
                      upperHint,
                      maxFeePercentage: _maxMintFeePercentage,
                    },
                  },
                  deadline,
                  { value: priceUpdateFee },
                )
                .catch((err) => {
                  throw new Error(err, { cause: swapOperationsContract });
                });
            },
            waitForResponseOf:
              tokenAApprovalNecessary && tokenBApprovalNecessary
                ? [0, 1]
                : tokenAApprovalNecessary || tokenBApprovalNecessary
                  ? [0]
                  : [],
            reloadQueriesAferMined: [
              GET_BORROWER_COLLATERAL_TOKENS,
              GET_BORROWER_DEBT_TOKENS,
              GET_BORROWER_LIQUIDITY_POOLS,
            ],
            actionAfterMined: (client) => {
              setTimeout(() => {
                // Manually waits for subgraph sync
                client.refetchQueries({ include: [GET_BORROWER_LIQUIDITY_POOLS] });
              }, manualSubgraphSyncTimeout);
            },
          },
        },
      ]);
    } else {
      const percentageFromPool = tokenAAmount / bigIntStringToFloat(totalSupply);
      const tokenAAmountForWithdraw =
        percentageFromPool * bigIntStringToFloat(tokenA.totalAmount, tokenA.token.decimals);
      const tokenBAmountForWithdraw =
        percentageFromPool * bigIntStringToFloat(tokenB.totalAmount, tokenB.token.decimals);

      // Only consider troveRepableDebtAmount
      const debtAmounts: IBase.TokenAmountStruct[] = [
        {
          tokenAddress: tokenA.token.address,
          amount: (foundTokenA as DebtTokenMeta).troveRepableDebtAmount
            ? floatToBigInt(tokenAAmountForWithdraw) > (foundTokenA as DebtTokenMeta).troveRepableDebtAmount
              ? (foundTokenA as DebtTokenMeta).troveRepableDebtAmount
              : floatToBigInt(tokenAAmountForWithdraw)
            : BigInt(0),
        },
        {
          tokenAddress: tokenB.token.address,
          amount: (foundTokenB as DebtTokenMeta).troveRepableDebtAmount
            ? floatToBigInt(tokenBAmountForWithdraw) > (foundTokenB as DebtTokenMeta).troveRepableDebtAmount
              ? (foundTokenB as DebtTokenMeta).troveRepableDebtAmount
              : floatToBigInt(tokenBAmountForWithdraw)
            : BigInt(0),
        },
      ].filter(({ tokenAddress, amount }) => isDebtTokenAddress(tokenAddress) && amount > 0);

      setSteps([
        {
          title: `Remove Liquidity from the ${tokenA.token.symbol}-${tokenB.token.symbol} pool.`,
          transaction: {
            methodCall: async () => {
              const [upperHint, lowerHint] = await getHints(sortedTrovesContract, hintHelpersContract, {
                borrower: address,
                addedColl: [],
                addedDebt: [],
                removedColl: collAmounts,
                removedDebt: debtAmounts,
              });
              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

              return swapOperationsContract
                .removeLiquidity(
                  tokenA.token.address,
                  tokenB.token.address,
                  floatToBigInt(tokenAAmount),
                  floatToBigInt(tokenAAmountForWithdraw * (1 - SLIPPAGE)),
                  floatToBigInt(tokenBAmountForWithdraw * (1 - SLIPPAGE)),
                  upperHint,
                  lowerHint,
                  deadline,
                  updateDataInBytes,
                  { value: priceUpdateFee },
                )
                .catch((err) => {
                  throw new Error(err, { cause: swapOperationsContract });
                });
            },
            waitForResponseOf: [],
            reloadQueriesAferMined: [
              GET_BORROWER_COLLATERAL_TOKENS,
              GET_BORROWER_DEBT_TOKENS,
              GET_BORROWER_LIQUIDITY_POOLS,
            ],
            actionAfterMined: () => {
              debtAmounts.forEach(({ tokenAddress }) => {
                evictCacheTimoutForObject(
                  currentNetwork!,
                  ['DebtToken', tokenAddress as string],
                  ['troveRepableDebtAmount'],
                );
              });
            },
          },
        },
      ]);
    }

    setTimeout(() => {
      reset();
    }, 100);
  };

  const handleInput = (fieldName: keyof FieldValues, value: string) => {
    const numericValue = isNaN(parseFloat(value)) ? 0 : parseFloat(value);

    if (tabValue === 'DEPOSIT') {
      if (fieldName === 'tokenAAmount') {
        const pairValue = roundNumber(
          (numericValue * bigIntStringToFloat(tokenB.totalAmount, tokenB.token.decimals)) /
            bigIntStringToFloat(tokenA.totalAmount, tokenA.token.decimals),
          5,
        );
        setValue('tokenBAmount', pairValue.toString(), {
          shouldValidate: true,
          shouldDirty: true,
        });
      } else {
        const pairValue = roundNumber(
          (numericValue * bigIntStringToFloat(tokenA.totalAmount, tokenA.token.decimals)) /
            bigIntStringToFloat(tokenB.totalAmount, tokenB.token.decimals),
          5,
        );

        setValue('tokenAAmount', pairValue.toString(), {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    } else {
    }
  };

  const fillMaxInputValue = (fieldName: keyof FieldValues) => {
    if (pairHasCollateral) {
      if (tabValue === 'DEPOSIT') {
        // calculate max value of walletAmount for pool distribution
        const walletAmountAForPoolB =
          (dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, tokenA.token.decimals - 6, 6) *
            bigIntStringToFloat(tokenB.totalAmount, tokenB.token.decimals)) /
          bigIntStringToFloat(tokenA.totalAmount, tokenA.token.decimals);

        if (fieldName === 'tokenAAmount') {
          if (isStableCoinAddress(tokenA.token.address)) {
            // fill token A wallet if not greater that B, otherwise B
            if (
              walletAmountAForPoolB <
              dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, tokenB.token.decimals - 6, 6)
            ) {
              setValue('tokenAAmount', dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 9, 9).toString(), {
                shouldValidate: true,
                shouldDirty: true,
              });
              handleInput('tokenAAmount', dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 9, 9).toString());
            } else {
              setValue(
                'tokenBAmount',
                dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, tokenB.token.decimals - 6, 6).toString(),
                {
                  shouldValidate: true,
                  shouldDirty: true,
                },
              );
              handleInput(
                'tokenBAmount',
                dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, tokenB.token.decimals - 6, 6).toString(),
              );
            }
          } else {
            // just fill B wallet
            setValue(
              'tokenAAmount',
              dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, tokenA.token.decimals - 6, 6).toString(),
              {
                shouldValidate: true,
                shouldDirty: true,
              },
            );
            handleInput(
              'tokenAAmount',
              dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, tokenA.token.decimals - 6, 6).toString(),
            );
          }
        } else {
          if (isStableCoinAddress(tokenB.token.address)) {
            // fill token B wallet if not greater that B, otherwise A
            if (walletAmountAForPoolB > dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 9, 9)) {
              setValue('tokenBAmount', dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 9, 9).toString(), {
                shouldValidate: true,
                shouldDirty: true,
              });
              handleInput('tokenBAmount', dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 9, 9).toString());
            } else {
              setValue(
                'tokenAAmount',
                dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, tokenA.token.decimals - 6, 6).toString(),
                {
                  shouldValidate: true,
                  shouldDirty: true,
                },
              );
              handleInput(
                'tokenAAmount',
                dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, tokenA.token.decimals - 6, 6).toString(),
              );
            }
          } else {
            // just fill B wallet
            setValue(
              'tokenBAmount',
              dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, tokenB.token.decimals - 6, 6).toString(),
              {
                shouldValidate: true,
                shouldDirty: true,
              },
            );
            handleInput(
              'tokenBAmount',
              dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, tokenB.token.decimals - 6, 6).toString(),
            );
          }
        }
      } else {
        setValue(fieldName, dangerouslyConvertBigIntToNumber(borrowerAmount, 9, 9).toString(), {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    }
    // New token can be minted, just fill the walletAmount
    else {
      if (tabValue === 'DEPOSIT') {
        if (fieldName === 'tokenAAmount') {
          setValue(fieldName, dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 9, 9).toString(), {
            shouldValidate: true,
            shouldDirty: true,
          });
          handleInput(fieldName, dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 9, 9).toString());
        } else if (fieldName === 'tokenBAmount') {
          setValue(fieldName, dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 9, 9).toString(), {
            shouldValidate: true,
            shouldDirty: true,
          });
          handleInput(fieldName, dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 9, 9).toString());
        }
      } else {
        setValue(fieldName, dangerouslyConvertBigIntToNumber(borrowerAmount, 9, 9).toString(), {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    }
  };

  /**
   * Can only be called is the pair is a DebtTokenPair
   */
  const fill150PercentInputValue = () => {
    // Check if current collateral is less than 150% of current debt
    if (currentDebtValueUSD && currentCollateralValueUSD) {
      const tokenAAmount = calculate150PercentTokenValue(
        currentDebtValueUSD,
        currentCollateralValueUSD,
        {
          totalAmount: bigIntStringToFloat(tokenA.totalAmount, tokenA.token.decimals),
          priceUSD: dangerouslyConvertBigIntToNumber(tokenA.token.priceUSDOracle, 9, 9),
        },
        {
          totalAmount: bigIntStringToFloat(tokenB.totalAmount, tokenB.token.decimals),
          priceUSD: dangerouslyConvertBigIntToNumber(tokenB.token.priceUSDOracle, 9, 9),
        },
        foundTokenA,
        foundTokenB,
      );

      setValue('tokenAAmount', tokenAAmount.toString(), {
        shouldValidate: true,
        shouldDirty: true,
      });
      handleInput('tokenAAmount', tokenAAmount.toString());
    }
  };

  const tokenAAmount = watch('tokenAAmount');
  const tokenBAmount = watch('tokenBAmount');

  // Withdraw
  const percentageFromPool = (tokenAAmount ? parseFloat(tokenAAmount) : 0) / bigIntStringToFloat(totalSupply);
  const tokenAAmountForWithdraw = percentageFromPool * bigIntStringToFloat(tokenA.totalAmount, tokenA.token.decimals);
  const tokenBAmountForWithdraw = percentageFromPool * bigIntStringToFloat(tokenB.totalAmount, tokenB.token.decimals);

  const getAddedDebtUSD = () => {
    if (isCollateralPair) {
      return 0;
    }

    if (tabValue === 'DEPOSIT') {
      const tokenADebt =
        isDebtTokenAddress(tokenA.token.address) && tokenAAmount
          ? Math.max(
              (parseFloat(tokenAAmount) - dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 9, 9)) *
                dangerouslyConvertBigIntToNumber(tokenA.token.priceUSDOracle, 9, 9),
              0,
            )
          : 0;

      const tokenBDebt =
        isDebtTokenAddress(tokenB.token.address) && tokenBAmount
          ? Math.max(
              (parseFloat(tokenBAmount) - dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 9, 9)) *
                dangerouslyConvertBigIntToNumber(tokenB.token.priceUSDOracle, 9, 9),
              0,
            )
          : 0;

      return tokenADebt + tokenBDebt;
    } else {
      const tokenADebt = isDebtTokenAddress(tokenA.token.address)
        ? dangerouslyConvertBigIntToNumber((foundTokenA as DebtTokenMeta).troveRepableDebtAmount, 9, 9) >
          tokenAAmountForWithdraw
          ? tokenAAmountForWithdraw * dangerouslyConvertBigIntToNumber(tokenA.token.priceUSDOracle, 9, 9)
          : dangerouslyConvertBigIntToNumber((foundTokenA as DebtTokenMeta).troveRepableDebtAmount, 9, 9) *
            dangerouslyConvertBigIntToNumber(tokenA.token.priceUSDOracle, 9, 9)
        : 0;

      const tokenBDebt = isDebtTokenAddress(tokenB.token.address)
        ? dangerouslyConvertBigIntToNumber((foundTokenB as DebtTokenMeta).troveRepableDebtAmount, 9, 9) >
          tokenBAmountForWithdraw
          ? tokenBAmountForWithdraw * dangerouslyConvertBigIntToNumber(tokenB.token.priceUSDOracle, 9, 9)
          : dangerouslyConvertBigIntToNumber((foundTokenB as DebtTokenMeta).troveRepableDebtAmount, 9, 9) *
            dangerouslyConvertBigIntToNumber(tokenB.token.priceUSDOracle, 9, 9)
        : 0;

      return (tokenADebt + tokenBDebt) * -1;
    }
  };

  return (
    <FeatureBox title="Your Liquidity" noPadding headBorder="bottom" border="full">
      <Tabs value={tabValue} onChange={handleChange} variant="fullWidth" sx={{ mt: 2 }}>
        <Tab label="DEPOSIT" value="DEPOSIT" disableRipple />
        <Tab label="WITHDRAW" value="WITHDRAW" disableRipple disabled={!borrowerAmount} />
      </Tabs>
      <FormProvider {...methods}>
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* DEPOSIT */}

          {tabValue === 'DEPOSIT' && (
            <>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '20px',
                  gap: '50px',
                  borderBottom: '1px solid',
                  borderColor: 'background.paper',
                }}
              >
                <div style={{ marginTop: 6 }}>
                  <Label variant="success">{tokenA.token.symbol}</Label>

                  <Typography
                    sx={{ fontWeight: '400', marginTop: '10px' }}
                    data-testid="apollon-liquidity-pool-deposit-token-a-funds-label"
                  >
                    {roundCurrency(
                      dangerouslyConvertBigIntToNumber(
                        (borrowerAmount * BigInt(tokenA.totalAmount)) / BigInt(totalSupply),
                        tokenA.token.decimals - 6,
                        6,
                      ),
                      5,
                      5,
                    )}
                  </Typography>
                  <Typography variant="label">Deposited</Typography>
                </div>

                <div>
                  <NumberInput
                    name="tokenAAmount"
                    data-testid="apollon-liquidity-pool-deposit-token-a-amount"
                    placeholder="Value"
                    fullWidth
                    onChange={(event) => {
                      handleInput('tokenAAmount', event.target.value);
                    }}
                    rules={{
                      min: { value: 0, message: 'You can only invest positive amounts.' },
                      max: isCollateralTokenAddress(tokenA.token.address)
                        ? {
                            value: dangerouslyConvertBigIntToNumber(
                              foundTokenA.walletAmount,
                              tokenA.token.decimals - 9,
                              9,
                            ),
                            message: 'You wallet does not contain the specified amount.',
                          }
                        : undefined,
                      required: 'This field is required.',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {isCollateralTokenAddress(tokenA.token.address) ? (
                      <div>
                        <Typography
                          variant="caption"
                          data-testid="apollon-collateral-update-dialog-deposit-ether-funds-label"
                          color="info.main"
                        >
                          {roundCurrency(
                            dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, tokenA.token.decimals - 6, 6),
                            5,
                            5,
                          )}
                        </Typography>
                        <Typography variant="label" paragraph>
                          Wallet
                        </Typography>
                      </div>
                    ) : (
                      <div>
                        <Typography
                          variant="caption"
                          data-testid="apollon-collateral-update-dialog-deposit-ether-funds-label"
                          color="info.main"
                        >
                          {tokenAAmount
                            ? roundCurrency(
                                parseFloat(tokenAAmount) <
                                  dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 9, 9)
                                  ? parseFloat(tokenAAmount)
                                  : dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 12, 6),
                                5,
                                5,
                              )
                            : 0}
                        </Typography>
                        <Typography variant="label" paragraph>
                          from Wallet
                        </Typography>
                      </div>
                    )}

                    <Button
                      disabled={foundTokenA.walletAmount <= 0}
                      variant="undercover"
                      sx={{ textDecoration: 'underline', p: 0, mt: 0.25, height: 25 }}
                      onClick={() => fillMaxInputValue('tokenAAmount')}
                    >
                      max
                    </Button>
                  </div>

                  {isDebtTokenAddress(tokenA.token.address) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <Typography
                          variant="caption"
                          data-testid="apollon-collateral-update-dialog-deposit-ether-funds-label"
                          color="info.main"
                        >
                          {tokenAAmount
                            ? roundCurrency(
                                parseFloat(tokenAAmount) >
                                  dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 9, 9)
                                  ? parseFloat(tokenAAmount) -
                                      dangerouslyConvertBigIntToNumber(foundTokenA.walletAmount, 12, 6)
                                  : 0,
                                5,
                                5,
                              )
                            : 0}
                        </Typography>
                        <Typography variant="label" paragraph>
                          newly minted
                        </Typography>
                      </div>

                      {/* <Button
                        disabled
                        // disabled={
                        //   !currentCollateralValueUSD ||
                        //   !currentDebtValueUSD ||
                        //   currentCollateralValueUSD / currentDebtValueUSD < 1.5
                        // }
                        variant="undercover"
                        sx={{ textDecoration: 'underline', p: 0, mt: 0.25, height: 25 }}
                        onClick={() => fill150PercentInputValue()}
                      >
                        to 150%
                      </Button> */}
                    </div>
                  )}
                </div>
              </Box>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '20px',
                  gap: '50px',
                  borderBottom: '1px solid',
                  borderColor: 'background.paper',
                }}
              >
                <div style={{ marginTop: 6 }}>
                  <Label variant="success">{tokenB.token.symbol}</Label>

                  <Typography
                    sx={{ fontWeight: '400', marginTop: '10px' }}
                    data-testid="apollon-liquidity-pool-deposit-token-b-funds-label"
                  >
                    {roundCurrency(
                      dangerouslyConvertBigIntToNumber(
                        (borrowerAmount * BigInt(tokenB.totalAmount)) / BigInt(totalSupply),
                        tokenB.token.decimals - 6,
                        6,
                      ),
                      5,
                      5,
                    )}
                  </Typography>
                  <Typography variant="label">Deposited</Typography>
                </div>

                <div>
                  <NumberInput
                    name="tokenBAmount"
                    data-testid="apollon-liquidity-pool-deposit-token-b-amount"
                    placeholder="Value"
                    fullWidth
                    onChange={(event) => {
                      handleInput('tokenBAmount', event.target.value);
                    }}
                    rules={{
                      min: { value: 0, message: 'You can only invest positive amounts.' },
                      // Make sure coll data is already loaded.
                      max: isCollateralTokenAddress(tokenB.token.address)
                        ? {
                            value: dangerouslyConvertBigIntToNumber(
                              foundTokenB.walletAmount,
                              tokenB.token.decimals - 9,
                              9,
                            ),
                            message: 'You wallet does not contain the specified amount.',
                          }
                        : undefined,
                      required: 'This field is required.',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {isCollateralTokenAddress(tokenB.token.address) ? (
                      <div>
                        <Typography
                          variant="caption"
                          data-testid="apollon-collateral-update-dialog-deposit-ether-funds-label"
                          color="info.main"
                        >
                          {roundCurrency(
                            dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, tokenB.token.decimals - 6, 6),
                            5,
                            5,
                          )}
                        </Typography>
                        <Typography variant="label" paragraph>
                          Wallet
                        </Typography>
                      </div>
                    ) : (
                      <div>
                        <Typography
                          variant="caption"
                          data-testid="apollon-collateral-update-dialog-deposit-ether-funds-label"
                          color="info.main"
                        >
                          {tokenBAmount
                            ? roundCurrency(
                                parseFloat(tokenBAmount) <
                                  dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 9, 9)
                                  ? parseFloat(tokenBAmount)
                                  : dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 12, 6),
                                5,
                                5,
                              )
                            : 0}
                        </Typography>
                        <Typography variant="label" paragraph>
                          from Wallet
                        </Typography>
                      </div>
                    )}

                    <Button
                      disabled={foundTokenB.walletAmount <= 0}
                      variant="undercover"
                      sx={{ textDecoration: 'underline', p: 0, mt: 0.25, height: 25 }}
                      onClick={() => fillMaxInputValue('tokenBAmount')}
                    >
                      max
                    </Button>
                  </div>

                  {isDebtTokenAddress(tokenB.token.address) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <Typography
                          variant="caption"
                          data-testid="apollon-collateral-update-dialog-deposit-ether-funds-label"
                          color="info.main"
                        >
                          {tokenBAmount
                            ? roundCurrency(
                                parseFloat(tokenBAmount) >
                                  dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 9, 9)
                                  ? parseFloat(tokenBAmount) -
                                      dangerouslyConvertBigIntToNumber(foundTokenB.walletAmount, 12, 6)
                                  : 0,
                                5,
                                5,
                              )
                            : 0}
                        </Typography>
                        <Typography variant="label" paragraph>
                          newly minted
                        </Typography>
                      </div>

                      {/* <Button
                        disabled
                        // disabled={
                        //   !currentCollateralValueUSD ||
                        //   !currentDebtValueUSD ||
                        //   currentCollateralValueUSD / currentDebtValueUSD < 1.5
                        // }
                        variant="undercover"
                        sx={{ textDecoration: 'underline', p: 0, mt: 0.25, height: 25 }}
                        onClick={() => fill150PercentInputValue()}
                      >
                        to 150%
                      </Button> */}
                    </div>
                  )}
                </div>
              </Box>
            </>
          )}

          {/* WITHDRAW */}

          {tabValue === 'WITHDRAW' && borrowerAmount > 0 && (
            <Box style={{ display: 'flex', flexDirection: 'column' }}>
              <Box
                sx={{
                  height: '125px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '20px',
                  borderBottom: '1px solid',
                  borderColor: 'background.paper',
                }}
              >
                <div style={{ marginTop: 6 }}>
                  <Label variant="success">
                    {tokenA.token.symbol}-{tokenB.token.symbol}
                  </Label>
                </div>

                <div>
                  <NumberInput
                    name="tokenAAmount"
                    data-testid="apollon-liquidity-pool-withdraw-token-a-amount"
                    placeholder="Value"
                    fullWidth
                    rules={{
                      min: { value: 0, message: 'You can only withdraw positive amounts.' },
                      max: {
                        value: dangerouslyConvertBigIntToNumber(borrowerAmount, 9, 9),
                        message: 'This amount is greater than your deposited amount.',
                      },
                      required: 'This field is required.',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <Typography
                        variant="caption"
                        data-testid="apollon-liquidity-pool-withdraw-token-a-funds-label"
                        color="info.main"
                      >
                        {roundCurrency(dangerouslyConvertBigIntToNumber(borrowerAmount, 12, 6), 5, 5)}
                      </Typography>
                      <br />
                      <Typography variant="label">Deposited</Typography>
                    </div>
                    <Button
                      variant="undercover"
                      sx={{ textDecoration: 'underline', p: 0, mt: 0.25, height: 25 }}
                      onClick={() => fillMaxInputValue('tokenAAmount')}
                    >
                      max
                    </Button>
                  </div>
                </div>
              </Box>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px 20px 0 20px',
                }}
              >
                <Label variant="success">{tokenA.token.symbol}</Label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: 250,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography component="span" style={{ marginRight: '8px' }}>
                      {isDebtTokenAddress(tokenA.token.address)
                        ? tokenAAmountForWithdraw >
                          dangerouslyConvertBigIntToNumber((foundTokenA as DebtTokenMeta).troveRepableDebtAmount, 12, 6)
                          ? roundCurrency(
                              tokenAAmountForWithdraw -
                                dangerouslyConvertBigIntToNumber(
                                  (foundTokenA as DebtTokenMeta).troveRepableDebtAmount,
                                  12,
                                  6,
                                ),
                              5,
                              5,
                            )
                          : 0
                        : roundCurrency(tokenAAmountForWithdraw, 5, 5)}
                    </Typography>

                    <Typography variant="label">Payout</Typography>
                  </div>

                  {isDebtTokenAddress(tokenA.token.address) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography component="span" style={{ marginRight: '8px' }}>
                        {tokenAAmountForWithdraw >
                        dangerouslyConvertBigIntToNumber((foundTokenA as DebtTokenMeta).troveRepableDebtAmount, 12, 6)
                          ? roundCurrency(
                              dangerouslyConvertBigIntToNumber(
                                (foundTokenA as DebtTokenMeta).troveRepableDebtAmount,
                                12,
                                6,
                              ),
                              5,
                              5,
                            )
                          : roundCurrency(tokenAAmountForWithdraw, 5, 5)}
                      </Typography>

                      <Typography variant="label">Debt payed of</Typography>
                    </div>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '20px 20px 0 20px',
                }}
              >
                <Label variant="success">{tokenB.token.symbol}</Label>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    width: 250,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography component="span" style={{ marginRight: '8px' }}>
                      {isDebtTokenAddress(tokenB.token.address)
                        ? tokenBAmountForWithdraw >
                          dangerouslyConvertBigIntToNumber((foundTokenB as DebtTokenMeta).troveRepableDebtAmount, 12, 6)
                          ? roundCurrency(
                              tokenBAmountForWithdraw -
                                dangerouslyConvertBigIntToNumber(
                                  (foundTokenB as DebtTokenMeta).troveRepableDebtAmount,
                                  12,
                                  6,
                                ),
                              5,
                              5,
                            )
                          : 0
                        : roundCurrency(tokenBAmountForWithdraw, 5, 5)}
                    </Typography>

                    <Typography variant="label">Payout</Typography>
                  </div>

                  {isDebtTokenAddress(tokenB.token.address) && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography component="span" style={{ marginRight: '8px' }}>
                        {tokenBAmountForWithdraw >
                        dangerouslyConvertBigIntToNumber((foundTokenB as DebtTokenMeta).troveRepableDebtAmount, 12, 6)
                          ? roundCurrency(
                              dangerouslyConvertBigIntToNumber(
                                (foundTokenB as DebtTokenMeta).troveRepableDebtAmount,
                                12,
                                6,
                              ),
                              5,
                              5,
                            )
                          : roundCurrency(tokenBAmountForWithdraw, 5, 5)}
                      </Typography>

                      <Typography variant="label">Debt payed of</Typography>
                    </div>
                  )}
                </div>
              </div>
            </Box>
          )}

          <Box
            sx={{
              padding: '20px',
              borderBottom: '1px solid',
              borderBottomColor: 'background.paper',
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
                  sx={{ fontFamily: 'Space Grotesk Variable', color: 'info.main', fontWeight: '700', fontSize: '20px' }}
                >
                  {oldRatio !== null ? (
                    displayPercentage(oldRatio, 'default', 0)
                  ) : (
                    <Skeleton variant="text" width={50} />
                  )}
                </Typography>
                <ForwardIcon />
                <Typography
                  sx={{ fontFamily: 'Space Grotesk Variable', color: 'info.main', fontWeight: '700', fontSize: '20px' }}
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
              <Typography variant="shady">Minimum Collateral Ratio</Typography>
              <Typography variant="shady">
                {oldCriticalRatio !== null ? (
                  displayPercentage(oldCriticalRatio, 'default', 0)
                ) : (
                  <Skeleton variant="text" width={50} />
                )}
              </Typography>
            </Box>
            <CollateralRatioVisualization addedDebtUSD={getAddedDebtUSD()} callback={ratioChangeCallback} />
          </Box>

          <div style={{ width: '100%', padding: '20px' }}>
            <RecoveryModeMarketCloseWrapper
              respectRecoveryMode={getAddedDebtUSD() > 0}
              respectMarketClose={getAddedDebtUSD() > 0}
            >
              <Button
                type="submit"
                variant="outlined"
                disabled={
                  (getAddedDebtUSD() > 0 && !oldRatio) ||
                  (newRatio && newRatio < CRIT_RATIO && tabValue === 'DEPOSIT') ||
                  !address
                }
              >
                Update
              </Button>
            </RecoveryModeMarketCloseWrapper>
          </div>
        </form>
      </FormProvider>
    </FeatureBox>
  );
}

export default LiquidityDepositWithdraw;

/**
 * Calculates tokenA amount to reach 150% collateralization.
 * Both Token have a ratio of the LiquidityPool and price. If a user has tokens in their wallet these are used first before
 * new debt is accrued.
 *
 * @param currentDebtValueUSD current constant debt value in USD
 * @param currentCollateralValueUSD current constant collateral value in USD
 * @param tokenA PoolLiquidity of A
 * @param tokenB PoolLiquidity of B
 * @param relevantDebtTokenA DebtTokenMeta of A to get wallet amount
 * @param relevantDebtTokenB DebtTokenMeta of B to get wallet amount
 */
export const calculate150PercentTokenValue = (
  currentDebtValueUSD: number,
  currentCollateralValueUSD: number,
  tokenA: { priceUSD: number; totalAmount: number },
  tokenB: { priceUSD: number; totalAmount: number },
  relevantDebtTokenA: { walletAmount: bigint },
  relevantDebtTokenB: { walletAmount: bigint },
) => {
  // Calculate the USD difference needed to reach 150% collateralization
  const targetDebtUSD = currentCollateralValueUSD / 1.5;
  const diffUSD = targetDebtUSD - currentDebtValueUSD;

  const tokenBTotokenARatio = tokenA.totalAmount / tokenB.totalAmount;
  const ratioWithPrice = (tokenBTotokenARatio * tokenA.priceUSD) / tokenB.priceUSD;

  if (relevantDebtTokenA.walletAmount === BigInt(0) && relevantDebtTokenB.walletAmount === BigInt(0)) {
    const diffTokenAUSD = diffUSD / (1 + ratioWithPrice);

    const tokenAAmount = diffTokenAUSD / tokenA.priceUSD;

    return tokenAAmount;
  }

  const diffWalletTokenA =
    dangerouslyConvertBigIntToNumber(relevantDebtTokenA.walletAmount, 9, 9) -
    dangerouslyConvertBigIntToNumber(relevantDebtTokenB.walletAmount, 9, 9) * tokenBTotokenARatio * ratioWithPrice;
  if (diffWalletTokenA > 0) {
    // fill tokenB with amount for complete diff
    if (diffUSD < diffWalletTokenA * tokenA.priceUSD) {
      const tokenBAmount = diffUSD / tokenB.priceUSD;
      const tokenAAmount = (tokenBAmount * tokenA.totalAmount) / tokenB.totalAmount;

      return tokenAAmount;
    } else {
      const restDebtToShare = diffUSD - diffWalletTokenA * tokenA.priceUSD;
      const diffTokenAUSD = restDebtToShare / (1 + ratioWithPrice);

      const tokenAAmount = diffTokenAUSD / tokenA.priceUSD;

      return dangerouslyConvertBigIntToNumber(relevantDebtTokenA.walletAmount, 9, 9) + tokenAAmount;
    }
  }
  // We have more token B than A
  else {
    const diffWalletTokenBasA = Math.abs(diffWalletTokenA);

    // Everything comes from TokenA / TokenB is not Minted
    if (diffUSD < diffWalletTokenBasA * tokenA.priceUSD) {
      // fill tokenA with amount for complete diff + wallet amount
      const tokenAAmountAsDebt = diffUSD / tokenA.priceUSD;

      return tokenAAmountAsDebt + dangerouslyConvertBigIntToNumber(relevantDebtTokenA.walletAmount, 9, 9);
    } else {
      const restDebtToShare = diffUSD - diffWalletTokenBasA * tokenA.priceUSD;
      let diffTokenAUSD = (restDebtToShare * tokenBTotokenARatio) / (1 + ratioWithPrice);

      const tokenAAmount = diffTokenAUSD / tokenA.priceUSD;

      return (
        dangerouslyConvertBigIntToNumber(relevantDebtTokenB.walletAmount, 9, 9) * tokenBTotokenARatio * ratioWithPrice +
        tokenAAmount
      );
    }
  }
};
