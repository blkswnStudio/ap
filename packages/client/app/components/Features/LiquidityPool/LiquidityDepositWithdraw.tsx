'use client';

import { useQuery } from '@apollo/client';
import { Alert, Box, InputAdornment, Skeleton } from '@mui/material';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { parseEther, parseUnits } from 'ethers';
import { useSnackbar } from 'notistack';
import { SyntheticEvent, useCallback, useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  isCollateralTokenAddress,
  isDebtTokenAddress,
  isGOVTokenAddress,
  isStableCoinAddress,
} from '../../../../config';
import { IBase } from '../../../../generated/types/TroveManager';
import { useErrorMonitoring } from '../../../context/ErrorMonitoringContext';
import { useEthers } from '../../../context/EthersProvider';
import { usePriceFeedData } from '../../../context/PriceFeedDataProvider';
import { useSelectedToken } from '../../../context/SelectedTokenProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { useUtilities } from '../../../context/UtilityProvider';
import { evictCacheTimeoutForObject } from '../../../context/utils';
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
  GET_SYSTEMINFO,
} from '../../../queries';
import { standardDataPollInterval } from '../../../utils/constants';
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
import CollateralRatioVisualization from '../../Visualizations/CollateralRatioVisualization';

const SLIPPAGE = 0.02;

type Props = {
  selectedPoolAddress: string | null;
};

type FieldValues = {
  tokenAAmount: string;
  tokenBAmount: string;
  borrowingRate: string;
};

function LiquidityDepositWithdraw({ selectedPoolAddress }: Props) {
  const { enqueueSnackbar } = useSnackbar();

  const {
    address,
    contracts: {
      swapOperationsContract,
      debtTokenContracts,
      collateralTokenContracts,
      sortedTrovesContract,
      hintHelpersContract,
    },
    currentNetwork,
  } = useEthers();
  const { getPythUpdateData } = usePriceFeedData();
  const { Sentry } = useErrorMonitoring();
  const { setSteps } = useTransactionDialog();
  const { getAllowance } = useUtilities();
  const { JUSDToken } = useSelectedToken();

  const [tabValue, setTabValue] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');

  const [oldRatio, setOldRatio] = useState<number | null>(null);
  const [newRatio, setNewRatio] = useState<number | null>(null);
  const [oldCriticalRatio, setOldCriticalRatio] = useState<number | null>(null);
  const [showMaxMintFee, setShowMaxMintFee] = useState(false);

  const latestUserInput = useRef<null | { address: string; amount: string }>(null);

  const { data: debtTokenData } = useQuery<GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables>(
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
  const { data: collTokenData } = useQuery<GetBorrowerCollateralTokensQuery, GetBorrowerCollateralTokensQueryVariables>(
    GET_BORROWER_COLLATERAL_TOKENS,
    {
      variables: { borrower: address },
      skip: !address,
      pollInterval: standardDataPollInterval,
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );

  // For Update after TX
  const { data: borrowerPoolsData } = useQuery<GetBorrowerLiquidityPoolsQuery, GetBorrowerLiquidityPoolsQueryVariables>(
    GET_BORROWER_LIQUIDITY_POOLS,
    {
      variables: { borrower: address },
      onError: (error) => {
        enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
        Sentry.captureException(error);
      },
    },
  );
  const selectedPool = borrowerPoolsData?.pools.find(({ address }) => address === selectedPoolAddress);

  const methods = useForm<FieldValues>({
    defaultValues: {
      tokenAAmount: '',
      tokenBAmount: '',
      borrowingRate: '0',
    },
    reValidateMode: 'onChange',
    shouldUnregister: true,
  });
  const { handleSubmit, setValue, reset, watch } = methods;

  const ratioChangeCallback = useCallback(
    (newRatio: number, oldRatio: number, _: number, __: number, oldCriticalRatio: number) => {
      setNewRatio(newRatio);
      setOldRatio(oldRatio);
      setOldCriticalRatio(oldCriticalRatio);
    },
    [setNewRatio, setOldRatio],
  );

  useEffect(() => {
    if (!selectedPool?.borrowerAmount) {
      setTabValue('DEPOSIT');
    }

    reset();
    if (JUSDToken?.borrowingRate) {
      setValue('borrowingRate', (2 + dangerouslyConvertBigIntToNumber(JUSDToken.borrowingRate, 12, 6 - 2)).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPool?.id]);

  useEffect(() => {
    if (JUSDToken?.borrowingRate) {
      setValue('borrowingRate', (2 + dangerouslyConvertBigIntToNumber(JUSDToken.borrowingRate, 12, 6 - 2)).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JUSDToken?.borrowingRate]);

  // Wait until pool has been selected
  if (!selectedPool) return null;

  const { liquidity, borrowerAmount, totalSupply } = selectedPool;
  const liquidityData = liquidity.map((liquidity) => ({
    ...liquidity,
    token: { ...liquidity.token, priceUSD: dangerouslyConvertBigIntToNumber(liquidity.token.priceUSDOracle, 9, 9) },
  }));
  // Subgraph has wrong order
  const tokenA = liquidityData.find(({ token }) => isStableCoinAddress(token.address))!;
  const tokenB = liquidityData.find(({ token }) => !isStableCoinAddress(token.address))!;

  const pairHasCollateral = !isDebtTokenAddress(tokenA.token.address) || !isDebtTokenAddress(tokenB.token.address);
  const isCollateralPair = !isDebtTokenAddress(tokenA.token.address) && !isDebtTokenAddress(tokenB.token.address);

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
    if (JUSDToken?.borrowingRate) {
      setValue('borrowingRate', (2 + dangerouslyConvertBigIntToNumber(JUSDToken.borrowingRate, 12, 6 - 2)).toString());
    }
    setShowMaxMintFee(false);
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

    if (latestUserInput.current === null) {
      console.error('latestUserInput.current is null');
      Sentry.captureMessage('latestUserInput.current is null');
      return;
    }

    let tokenAAmount =
      latestUserInput.current?.address === tokenA.token.address
        ? parseUnits(latestUserInput.current.amount, tokenA.token.decimals)
        : (parseUnits(latestUserInput.current.amount, tokenB.token.decimals) * BigInt(tokenA.totalAmount)) /
          BigInt(tokenB.totalAmount);
    const tokenBAmount =
      latestUserInput.current?.address === tokenB.token.address
        ? parseUnits(latestUserInput.current.amount, tokenB.token.decimals)
        : (parseUnits(latestUserInput.current.amount, tokenA.token.decimals) * BigInt(tokenB.totalAmount)) /
          BigInt(tokenA.totalAmount);
    const deadline = new Date().getTime() + 1000 * 60 * 2; // 2 minutes

    if (tabValue === 'DEPOSIT') {
      const currentAllowanceTokenA = isDebtTokenAddress(tokenA.token.address)
        ? await getAllowance(debtTokenContracts[tokenA.token.address], address, swapOperationsContract.target)
        : isCollateralTokenAddress(tokenA.token.address)
          ? await getAllowance(collateralTokenContracts[tokenA.token.address], address, swapOperationsContract.target)
          : 0n;
      const amountAToApprove = isDebtTokenAddress(tokenA.token.address)
        ? tokenAAmount > foundTokenA.walletAmount
          ? foundTokenA.walletAmount
          : tokenAAmount
        : isCollateralTokenAddress(tokenA.token.address)
          ? tokenAAmount
          : 0n;
      const tokenAApprovalNecessary = amountAToApprove > currentAllowanceTokenA;

      const currentAllowanceTokenB = isDebtTokenAddress(tokenB.token.address)
        ? await getAllowance(debtTokenContracts[tokenB.token.address], address, swapOperationsContract.target)
        : isCollateralTokenAddress(tokenB.token.address)
          ? await getAllowance(collateralTokenContracts[tokenB.token.address], address, swapOperationsContract.target)
          : 0n;
      const amountBToApprove = isDebtTokenAddress(tokenB.token.address)
        ? tokenBAmount > foundTokenB.walletAmount
          ? foundTokenB.walletAmount
          : tokenBAmount
        : isCollateralTokenAddress(tokenB.token.address)
          ? tokenBAmount
          : 0n;

      const tokenBApprovalNecessary = amountBToApprove > currentAllowanceTokenB;

      // convert to 18 decimals again for percentage
      const maxMintFeePercentage = data.borrowingRate
        ? parseUnits(data.borrowingRate, 18 - 2)
        : parseEther('0.02') + JUSDToken!.borrowingRate;

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
                  amount: tokenAAmount > foundTokenA.walletAmount ? tokenAAmount - foundTokenA.walletAmount : BigInt(0),
                },
                {
                  tokenAddress: tokenB.token.address,
                  amount: tokenBAmount > foundTokenB.walletAmount ? tokenBAmount - foundTokenB.walletAmount : BigInt(0),
                },
              ].filter(({ tokenAddress, amount }) => isDebtTokenAddress(tokenAddress) && amount > 0);
              const [upperHint, lowerHint] = await getHints(sortedTrovesContract, hintHelpersContract, {
                borrower: address,
                addedColl: [],
                addedDebt: debtAmounts,
                removedColl: [],
                removedDebt: [],
              });
              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

              return swapOperationsContract
                .addLiquidity(
                  tokenA.token.address,
                  tokenB.token.address,
                  tokenAAmount,
                  tokenBAmount,
                  (tokenAAmount * (floatToBigInt(1) - maxMintFeePercentage)) / floatToBigInt(1),
                  (tokenBAmount * (floatToBigInt(1) - maxMintFeePercentage)) / floatToBigInt(1),
                  {
                    priceUpdateData: updateDataInBytes,
                    meta: {
                      lowerHint,
                      upperHint,
                      maxFeePercentage: maxMintFeePercentage,
                    },
                  },
                  deadline,
                  { value: priceUpdateFee },
                )
                .catch((err) => {
                  Sentry.captureException(`Error adding liquidity: ${JSON.stringify(debtAmounts.map(({ amount, tokenAddress }) => ({ tokenAddress, amount: amount.toString() })))}, ${tokenA.token.address},
                  ${tokenB.token.address},
                  ${tokenAAmount},
                  ${tokenBAmount},
                  ${(tokenAAmount * (floatToBigInt(1) - maxMintFeePercentage)) / floatToBigInt(1)},
                  ${(tokenBAmount * (floatToBigInt(1) - maxMintFeePercentage)) / floatToBigInt(1)},
                  ${selectedPool.totalSupply},
                  ${selectedPool.liquidity[0].totalAmount},
                  ${selectedPool.liquidity[1].totalAmount},
                  ${selectedPool.borrowerAmount}
                  `);

                  throw new Error(err, { cause: swapOperationsContract });
                });
            },
            waitForResponseOf:
              tokenAApprovalNecessary && tokenBApprovalNecessary
                ? [0, 1]
                : tokenAApprovalNecessary || tokenBApprovalNecessary
                  ? [0]
                  : [],
            reloadQueriesAfterMined: [
              GET_BORROWER_COLLATERAL_TOKENS,
              GET_BORROWER_DEBT_TOKENS,
              GET_BORROWER_LIQUIDITY_POOLS,
              GET_SYSTEMINFO,
            ],
            actionAfterMined: (client) => {
              // In case debt is minted by deposit
              if (!isCollateralPair) {
                client.cache.evict({ fieldName: 'getSystemInfo' });
                client.cache.gc();
                evictCacheTimeoutForObject(currentNetwork!, ['TroveManager']);
              }

              // Instantly update the borrower amount after deposit
              evictCacheTimeoutForObject(
                currentNetwork!,
                ['SwapPairs', selectedPoolAddress as string],
                ['borrowerAmount'],
              );
            },
          },
        },
      ]);
    } else {
      // If the input is very close to the max amount we use the max to not leave rest.
      const tokenMaxAmount = borrowerAmount;

      tokenAAmount =
        tokenMaxAmount - parseEther(latestUserInput.current.amount) < parseEther('0.000001')
          ? tokenMaxAmount
          : tokenAAmount;
      const isMaxWithdrawn = tokenAAmount === tokenMaxAmount;

      const percentageFromPool = (tokenAAmount * floatToBigInt(1, tokenA.token.decimals)) / BigInt(totalSupply);
      const tokenAAmountForWithdraw = (percentageFromPool * BigInt(tokenA.totalAmount)) / floatToBigInt(1);
      const tokenBAmountForWithdraw = (percentageFromPool * BigInt(tokenB.totalAmount)) / floatToBigInt(1);

      // Only consider troveRepableDebtAmount
      const debtAmounts: IBase.TokenAmountStruct[] = [
        {
          tokenAddress: tokenA.token.address,
          amount: (foundTokenA as DebtTokenMeta).troveRepableDebtAmount
            ? tokenAAmountForWithdraw > (foundTokenA as DebtTokenMeta).troveRepableDebtAmount
              ? (foundTokenA as DebtTokenMeta).troveRepableDebtAmount
              : tokenAAmountForWithdraw
            : (0n as bigint),
        },
        {
          tokenAddress: tokenB.token.address,
          amount: (foundTokenB as DebtTokenMeta).troveRepableDebtAmount
            ? tokenBAmountForWithdraw > (foundTokenB as DebtTokenMeta).troveRepableDebtAmount
              ? (foundTokenB as DebtTokenMeta).troveRepableDebtAmount
              : tokenBAmountForWithdraw
            : (0n as bigint),
        },
      ].filter(({ tokenAddress, amount }) => isDebtTokenAddress(tokenAddress) && amount > 0);

      const tokenAAmountAfterDebt =
        tokenAAmountForWithdraw -
        ((debtAmounts.find(({ tokenAddress }) => tokenAddress === tokenA.token.address)?.amount as bigint) ?? 0n);
      const tokenBAmountAfterDebt =
        tokenBAmountForWithdraw -
        ((debtAmounts.find(({ tokenAddress }) => tokenAddress === tokenB.token.address)?.amount as bigint) ?? 0n);

      setSteps([
        {
          title: `Remove Liquidity from the ${tokenA.token.symbol}-${tokenB.token.symbol} pool.`,
          transaction: {
            methodCall: async () => {
              const [upperHint, lowerHint] = await getHints(sortedTrovesContract, hintHelpersContract, {
                borrower: address,
                addedColl: [],
                addedDebt: [],
                removedColl: [],
                removedDebt: debtAmounts,
              });
              const { updateDataInBytes, priceUpdateFee } = await getPythUpdateData();

              return swapOperationsContract
                .removeLiquidity(
                  tokenA.token.address,
                  tokenB.token.address,
                  tokenAAmount,
                  (tokenAAmountAfterDebt * floatToBigInt(1 - SLIPPAGE)) / floatToBigInt(1),
                  (tokenBAmountAfterDebt * floatToBigInt(1 - SLIPPAGE)) / floatToBigInt(1),
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
            reloadQueriesAfterMined: [
              GET_BORROWER_COLLATERAL_TOKENS,
              GET_BORROWER_DEBT_TOKENS,
              GET_BORROWER_LIQUIDITY_POOLS,
              GET_SYSTEMINFO,
            ],
            actionAfterMined: (client) => {
              if (isMaxWithdrawn) {
                setTabValue('DEPOSIT');
              }

              debtAmounts.forEach(({ tokenAddress }) => {
                evictCacheTimeoutForObject(
                  currentNetwork!,
                  ['DebtToken', tokenAddress as string],
                  ['troveRepableDebtAmount'],
                );
              });

              // In case debt is payed of by withdrawal
              if (!isCollateralPair) {
                client.cache.evict({ fieldName: 'getSystemInfo' });
                client.cache.gc();
                evictCacheTimeoutForObject(currentNetwork!, ['TroveManager']);
              }

              // Instantly update the borrower amount after deposit
              evictCacheTimeoutForObject(
                currentNetwork!,
                ['SwapPairs', selectedPoolAddress as string],
                ['borrowerAmount'],
              );
            },
          },
        },
      ]);
    }

    setTimeout(() => {
      reset();
      if (JUSDToken?.borrowingRate) {
        setValue(
          'borrowingRate',
          (2 + dangerouslyConvertBigIntToNumber(JUSDToken.borrowingRate, 12, 6 - 2)).toString(),
        );
      }
      setTimeout(() => {
        setShowMaxMintFee(false);
      }, 100);
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
    }

    latestUserInput.current = {
      address: fieldName === 'tokenAAmount' ? tokenA.token.address : tokenB.token.address,
      amount: value,
    };
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
        latestUserInput.current = {
          address: tokenA.token.address,
          amount: dangerouslyConvertBigIntToNumber(borrowerAmount, 9, 9).toString(),
        };
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
        latestUserInput.current = {
          address: tokenA.token.address,
          amount: dangerouslyConvertBigIntToNumber(borrowerAmount, 9, 9).toString(),
        };
      }
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
                      max: !isDebtTokenAddress(tokenA.token.address)
                        ? {
                            value: dangerouslyConvertBigIntToNumber(
                              foundTokenA.walletAmount,
                              tokenA.token.decimals - 6,
                              6,
                            ),
                            message: 'You wallet does not contain the specified amount.',
                          }
                        : undefined,
                      required: 'This field is required.',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {!isDebtTokenAddress(tokenA.token.address) ? (
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
                      max: !isDebtTokenAddress(tokenB.token.address)
                        ? {
                            value: dangerouslyConvertBigIntToNumber(
                              foundTokenB.walletAmount,
                              tokenB.token.decimals - 6,
                              6,
                            ),
                            message: 'You wallet does not contain the specified amount.',
                          }
                        : undefined,
                      required: 'This field is required.',
                    }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    {!isDebtTokenAddress(tokenB.token.address) ? (
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

              <div style={{ width: '100%', padding: '20px 20px 0 20px' }}>
                {showMaxMintFee && (
                  <div>
                    <NumberInput
                      name="borrowingRate"
                      data-testid="apollon-LM-borrowingRate"
                      rules={{
                        min: { value: 0, message: 'You can not specify a smaller amount.' },
                        max: { value: 6, message: 'Amount can not be greater.' },
                      }}
                      label="Max. Mint Fee"
                      fullWidth
                      InputProps={{
                        endAdornment: <InputAdornment position="end">%</InputAdornment>,
                      }}
                    />

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 6,
                      }}
                    >
                      <Typography variant="label" paragraph>
                        probable min. Mint Fee
                      </Typography>
                      <Typography variant="caption" color="info.main">
                        {displayPercentage(
                          dangerouslyConvertBigIntToNumber(JUSDToken!.borrowingRate, 12, 6),
                          'default',
                          5,
                        )}
                      </Typography>
                    </div>
                  </div>
                )}

                <Button variant="contained" onClick={() => setShowMaxMintFee(!showMaxMintFee)}>
                  {showMaxMintFee ? 'Less' : 'More'}
                </Button>
              </div>
            </>
          )}

          {/* WITHDRAW */}

          {tabValue === 'WITHDRAW' && borrowerAmount > 0 && (
            <Box style={{ display: 'flex', flexDirection: 'column' }}>
              <Box
                sx={{
                  padding: '20px',
                  borderBottom: '1px solid',
                  borderColor: 'background.paper',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
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
                      onChange={(event) => {
                        const value = event.target.value;
                        setValue('tokenAAmount', value);
                        latestUserInput.current = {
                          // address just a placeholder to share code
                          address: tokenA.token.address,
                          amount: value,
                        };
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

                {selectedPool.pendingRewards > 0 && parseFloat(tokenAAmount) > 0 && (
                  <Alert color="info" variant="outlined" sx={{ mt: 1 }}>
                    <Typography variant="caption">
                      You are about to claim{' '}
                      {roundNumber(dangerouslyConvertBigIntToNumber(selectedPool.pendingRewards, 9, 9), 5)}{' '}
                      {
                        collTokenData?.collateralTokenMetas.find(({ token }) => isGOVTokenAddress(token.address))?.token
                          .symbol
                      }{' '}
                      that are staked in this pool when you withdraw liquidity from it.
                    </Typography>
                  </Alert>
                )}
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
                  (tabValue === 'DEPOSIT' && newRatio && oldCriticalRatio && newRatio <= oldCriticalRatio) ||
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
