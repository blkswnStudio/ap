import { makeVar } from '@apollo/client';
import { AddressLike } from 'ethers';
import { Contracts_ATC, isCollateralTokenAddress, isDebtTokenAddress } from '../../../config';
import {
  CollSurplusPool,
  HintHelpers,
  RedemptionOperations as RedemptionOperationsContract,
  StabilityPoolManager,
  StakingVestingOperations,
  StoragePool,
  TroveManager,
} from '../../../generated/types';
import { ContractDataFreshnessManagerType, ContractValue, TokenAmount } from '../CustomApolloProvider';
// GENERATED IMPORT CODE START - DO NOT EDIT THIS SECTION MANUALLY
import DebtToken_STABLE from '../typePolicies/ATC/DebtToken_STABLE.policy';
import DebtToken_STOCK_1 from '../typePolicies/ATC/DebtToken_STOCK_1.policy';
import DebtToken_STOCK_2 from '../typePolicies/ATC/DebtToken_STOCK_2.policy';
import ERC20_BTC from '../typePolicies/ATC/ERC20_BTC.policy';
import ERC20_GOV from '../typePolicies/ATC/ERC20_GOV.policy';
import ERC20_STABLE from '../typePolicies/ATC/ERC20_STABLE.policy';
import ERC20_STOCK_1 from '../typePolicies/ATC/ERC20_STOCK_1.policy';
import ERC20_STOCK_2 from '../typePolicies/ATC/ERC20_STOCK_2.policy';
import ERC20_USDT from '../typePolicies/ATC/ERC20_USDT.policy';
import SwapPairs_BTC from '../typePolicies/ATC/SwapPairs_BTC.policy';
import SwapPairs_GOV from '../typePolicies/ATC/SwapPairs_GOV.policy';
import SwapPairs_STOCK_1 from '../typePolicies/ATC/SwapPairs_STOCK_1.policy';
import SwapPairs_STOCK_2 from '../typePolicies/ATC/SwapPairs_STOCK_2.policy';
import SwapPairs_USDT from '../typePolicies/ATC/SwapPairs_USDT.policy';
// GENERATED IMPORT CODE END

const defaultFieldValue = BigInt(0);

/**
 * This manages the data fetching from the contracts if the data is reused. E.g.: get many debts from the trovemanager instead of making individual calls.
 */
export const ContractDataFreshnessManager_ATC: {
  TroveManager: Record<string, ContractValue<TokenAmount[]>>;
  StabilityPoolManager: Record<string, ContractValue<TokenAmount[]>>;
  StoragePool: Record<
    string,
    ContractValue<{
      isInRecoveryMode: boolean;
      TCR: bigint;
      entireSystemColl: bigint;
      entireSystemDebt: bigint;
    }>
  >;
  StakingVestingOperations: Record<
    string,
    ContractValue<{
      remainingTime: bigint;
      totalAmount: bigint;
      claimableAmount: bigint;
      burnedAmount: bigint;
    }>
  >;
  CollSurplusPool: Record<string, ContractValue<TokenAmount[]>>;
} = {
  TroveManager: {
    getTroveDebt: {
      fetch: async (troveManagerContract: TroveManager, borrower: AddressLike) => {
        ContractDataFreshnessManager_ATC.TroveManager.getTroveDebt.lastFetched = Date.now();
        const troveDebt = await troveManagerContract.getTroveDebt(borrower);

        const tokenAmounts = troveDebt.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_ATC.TroveManager.getTroveDebt.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_ATC.DebtToken).forEach((tokenAddress) => {
          if (isDebtTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_ATC.DebtToken[tokenAddress].troveMintedAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },
    getTroveRepayableDebts: {
      fetch: async (troveManagerContract: TroveManager, borrower: AddressLike) => {
        ContractDataFreshnessManager_ATC.TroveManager.getTroveRepayableDebts.lastFetched = Date.now();

        const troveRepayableDebts = await troveManagerContract['getTroveRepayableDebts(address,bool)'](borrower, false);

        const tokenAmounts = troveRepayableDebts.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_ATC.TroveManager.getTroveRepayableDebts.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_ATC.DebtToken).forEach((tokenAddress) => {
          if (isDebtTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_ATC.DebtToken[tokenAddress].troveRepableDebtAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },
    getTroveWithdrawableColls: {
      fetch: async (troveManagerContract: TroveManager, borrower: AddressLike) => {
        ContractDataFreshnessManager_ATC.TroveManager.getTroveWithdrawableColls.lastFetched = Date.now();
        const troveColl = await troveManagerContract.getTroveWithdrawableColls(borrower);

        const tokenAmounts = troveColl.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_ATC.TroveManager.getTroveWithdrawableColls.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_ATC.ERC20).forEach((tokenAddress) => {
          if (isCollateralTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_ATC.ERC20[tokenAddress].troveLockedAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },
    getCurrentICR: {
      fetch: async (borrower: AddressLike, hintHelpersContract: HintHelpers) => {
        ContractDataFreshnessManager_ATC.TroveManager.getCurrentICR.lastFetched = Date.now();

        const borrowerICR = await hintHelpersContract['getCurrentICR(address)'](borrower);

        ContractDataFreshnessManager_ATC.TroveManager.getCurrentICR.value = borrowerICR as any;
      },
      value: {
        ICR: defaultFieldValue,
        IMCR: defaultFieldValue,
        currentDebtInUSD: defaultFieldValue,
      } as any,
      lastFetched: 0,
      timeout: 1000 * 2,
    },
  },

  StabilityPoolManager: {
    getDepositorDeposits: {
      fetch: async (stabilityPoolManagerContract: StabilityPoolManager, depositor: AddressLike) => {
        ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorDeposits.lastFetched = Date.now();
        const depositorDeposits = await stabilityPoolManagerContract.getDepositorDeposits(depositor);

        const tokenAmounts = depositorDeposits.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorDeposits.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_ATC.DebtToken).forEach((tokenAddress) => {
          if (isDebtTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_ATC.DebtToken[tokenAddress].providedStability.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },

    getDepositorCollGains: {
      fetch: async (stabilityPoolManagerContract: StabilityPoolManager, depositor: AddressLike) => {
        ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCollGains.lastFetched = Date.now();
        const depositorCollGains = await stabilityPoolManagerContract.getDepositorCollGains(depositor);

        const tokenAmounts = depositorCollGains.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCollGains.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_ATC.ERC20).forEach((tokenAddress) => {
          if (isCollateralTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_ATC.ERC20[tokenAddress].stabilityGainedAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },

    getDepositorCompoundedDeposits: {
      fetch: async (stabilityPoolManagerContract: StabilityPoolManager, depositor: AddressLike) => {
        ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCompoundedDeposits.lastFetched = Date.now();
        const depositorCompoundedDeposits =
          await stabilityPoolManagerContract.getDepositorCompoundedDeposits(depositor);

        const tokenAmounts = depositorCompoundedDeposits.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCompoundedDeposits.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_ATC.DebtToken).forEach((tokenAddress) => {
          if (isDebtTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_ATC.DebtToken[tokenAddress].compoundedDeposit.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },
  },

  StoragePool: {
    checkRecoveryMode: {
      fetch: async (storagePoolContract: StoragePool) => {
        ContractDataFreshnessManager_ATC.StoragePool.checkRecoveryMode.lastFetched = Date.now();
        const [isInRecoveryMode, systemTCR, entireSystemColl, entireSystemDebt] =
          await storagePoolContract['checkRecoveryMode()']();

        ContractDataFreshnessManager_ATC.StoragePool.checkRecoveryMode.value = {
          isInRecoveryMode,
          TCR: systemTCR,
          entireSystemColl,
          entireSystemDebt,
        };

        // Update the values of all tokens after fetching.
        SchemaDataFreshnessManager_ATC.StoragePool.totalCollateralRatio.fetch();
        SchemaDataFreshnessManager_ATC.StoragePool.recoveryModeActive.fetch();
      },
      value: {
        isInRecoveryMode: false,
        TCR: BigInt(0),
        entireSystemColl: BigInt(0),
        entireSystemDebt: BigInt(0),
      } as any,
      lastFetched: 0,
      timeout: 1000 * 2,
    },
  },

  CollSurplusPool: {
    getCollateral: {
      fetch: async (collSurplusContract: CollSurplusPool, depositor: AddressLike) => {
        ContractDataFreshnessManager_ATC.CollSurplusPool.getCollateral.lastFetched = Date.now();

        const depositorSurplusCollateral = await collSurplusContract.getCollateral(depositor);

        const tokenAmounts = depositorSurplusCollateral.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_ATC.CollSurplusPool.getCollateral.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_ATC.ERC20).forEach((tokenAddress) => {
          if (isCollateralTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_ATC.ERC20[tokenAddress].collSurplusAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },
  },
  StakingVestingOperations: {
    checkVesting: {
      fetch: async (
        stakingVestingOperationsContract: StakingVestingOperations,
        token: AddressLike,
        depositor: AddressLike,
      ) => {
        ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.lastFetched = Date.now();

        const [remainingTime, totalAmount, claimableAmount, burnedAmount] =
          await stakingVestingOperationsContract.checkVesting(token, depositor);

        ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.value = {
          remainingTime,
          totalAmount,
          claimableAmount,
          burnedAmount,
        };

        SchemaDataFreshnessManager_ATC.StakingVestingOperations.remainingTime.fetch();
        SchemaDataFreshnessManager_ATC.StakingVestingOperations.totalAmount.fetch();
        SchemaDataFreshnessManager_ATC.StakingVestingOperations.claimableAmount.fetch();
        SchemaDataFreshnessManager_ATC.StakingVestingOperations.burnedAmount.fetch();
      },
      value: {
        remainingTime: BigInt(0),
        totalAmount: BigInt(0),
        claimableAmount: BigInt(0),
        burnedAmount: BigInt(0),
      } as any,
      lastFetched: 0,
      timeout: 1000 * 2,
    },
  },
};

/**
 * This manages the data, fetching and freshness on each client side field in the schema
 */
export const SchemaDataFreshnessManager_ATC: ContractDataFreshnessManagerType<typeof Contracts_ATC> = {
  // GENERATED CODE START - DO NOT EDIT THIS SECTION MANUALLY
  DebtToken: {
    ...DebtToken_STABLE,
    ...DebtToken_STOCK_1,
    ...DebtToken_STOCK_2,
  },

  ERC20: {
    ...ERC20_BTC,
    ...ERC20_USDT,
    ...ERC20_GOV,
    ...ERC20_STABLE,
    ...ERC20_STOCK_1,
    ...ERC20_STOCK_2,
  },

  SwapPairs: {
    ...SwapPairs_BTC,
    ...SwapPairs_USDT,
    ...SwapPairs_STOCK_1,
    ...SwapPairs_STOCK_2,
    ...SwapPairs_GOV,
  },
  // GENERATED CODE END

  StoragePool: {
    totalCollateralRatio: {
      fetch: async (fetchSource?: { storagePoolContract: StoragePool }) => {
        SchemaDataFreshnessManager_ATC.StoragePool.totalCollateralRatio.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StoragePool.checkRecoveryMode.fetch(fetchSource.storagePoolContract);
        }

        const { TCR } = ContractDataFreshnessManager_ATC.StoragePool.checkRecoveryMode.value;
        SchemaDataFreshnessManager_ATC.StoragePool.totalCollateralRatio.value(TCR);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    recoveryModeActive: {
      fetch: async (fetchSource?: { storagePoolContract: StoragePool }) => {
        SchemaDataFreshnessManager_ATC.StoragePool.recoveryModeActive.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StoragePool.checkRecoveryMode.fetch(fetchSource.storagePoolContract);
        }

        const { isInRecoveryMode } = ContractDataFreshnessManager_ATC.StoragePool.checkRecoveryMode.value;

        SchemaDataFreshnessManager_ATC.StoragePool.recoveryModeActive.value(isInRecoveryMode as any);
      },
      value: makeVar(false as any),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
  },
  RedemptionOperations: {
    redemptionRateWithDecay: {
      fetch: async (redemptionOperationsContract: RedemptionOperationsContract) => {
        SchemaDataFreshnessManager_ATC.RedemptionOperations.redemptionRateWithDecay.lastFetched = Date.now();

        const redemptionFee = await redemptionOperationsContract.getRedemptionRateWithDecay();

        SchemaDataFreshnessManager_ATC.RedemptionOperations.redemptionRateWithDecay.value(redemptionFee);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
  },

  TroveManager: {
    borrowerIMCR: {
      fetch: async (fetchSource: { borrower: AddressLike; hintHelpersContract: HintHelpers }) => {
        SchemaDataFreshnessManager_ATC.TroveManager.borrowerIMCR.lastFetched = Date.now();
        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.TroveManager.getCurrentICR.fetch(
            fetchSource.borrower,
            fetchSource.hintHelpersContract,
          );
        }

        const { IMCR } = ContractDataFreshnessManager_ATC.TroveManager.getCurrentICR.value as any;

        SchemaDataFreshnessManager_ATC.TroveManager.borrowerIMCR.value(IMCR);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    borrowerICR: {
      fetch: async (fetchSource: { borrower: AddressLike; hintHelpersContract: HintHelpers }) => {
        SchemaDataFreshnessManager_ATC.TroveManager.borrowerICR.lastFetched = Date.now();
        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.TroveManager.getCurrentICR.fetch(
            fetchSource.borrower,
            fetchSource.hintHelpersContract,
          );
        }

        const { ICR } = ContractDataFreshnessManager_ATC.TroveManager.getCurrentICR.value as any;

        SchemaDataFreshnessManager_ATC.TroveManager.borrowerICR.value(ICR);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    borrowingInterestRate: {
      fetch: async (troveManagerContract: TroveManager) => {
        SchemaDataFreshnessManager_ATC.TroveManager.borrowingInterestRate.lastFetched = Date.now();

        const borrowingInterestRate = await troveManagerContract.borrowingInterestRate();

        SchemaDataFreshnessManager_ATC.TroveManager.borrowingInterestRate.value(borrowingInterestRate);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 3600,
    },
  },

  StabilityPoolManager: {},
  SwapOperations: {},
  HintHelpers: {},
  SortedTroves: {},
  BorrowerOperations: {},
  PriceFeed: {},
  CollSurplus: {},
  StakingOperations: {},
  StakingVestingOperations: {
    remainingTime: {
      fetch: async (fetchSource?: {
        depositor: AddressLike;
        token: AddressLike;
        stakingVestingOperationsContract: StakingVestingOperations;
      }) => {
        SchemaDataFreshnessManager_ATC.StakingVestingOperations.remainingTime.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.fetch(
            fetchSource.stakingVestingOperationsContract,
            fetchSource.token,
            fetchSource.depositor,
          );
        }

        const { remainingTime } = ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.value as any;

        SchemaDataFreshnessManager_ATC.StakingVestingOperations.remainingTime.value(remainingTime);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    totalAmount: {
      fetch: async (fetchSource?: {
        depositor: AddressLike;
        token: AddressLike;
        stakingVestingOperationsContract: StakingVestingOperations;
      }) => {
        SchemaDataFreshnessManager_ATC.StakingVestingOperations.totalAmount.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.fetch(
            fetchSource.stakingVestingOperationsContract,
            fetchSource.token,
            fetchSource.depositor,
          );
        }

        const { totalAmount } = ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.value as any;

        SchemaDataFreshnessManager_ATC.StakingVestingOperations.totalAmount.value(totalAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    claimableAmount: {
      fetch: async (fetchSource?: {
        depositor: AddressLike;
        token: AddressLike;
        stakingVestingOperationsContract: StakingVestingOperations;
      }) => {
        SchemaDataFreshnessManager_ATC.StakingVestingOperations.claimableAmount.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.fetch(
            fetchSource.stakingVestingOperationsContract,
            fetchSource.token,
            fetchSource.depositor,
          );
        }

        const { claimableAmount } = ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.value as any;

        SchemaDataFreshnessManager_ATC.StakingVestingOperations.claimableAmount.value(claimableAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    burnedAmount: {
      fetch: async (fetchSource?: {
        depositor: AddressLike;
        token: AddressLike;
        stakingVestingOperationsContract: StakingVestingOperations;
      }) => {
        SchemaDataFreshnessManager_ATC.StakingVestingOperations.burnedAmount.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.fetch(
            fetchSource.stakingVestingOperationsContract,
            fetchSource.token,
            fetchSource.depositor,
          );
        }

        const { burnedAmount } = ContractDataFreshnessManager_ATC.StakingVestingOperations.checkVesting.value as any;

        SchemaDataFreshnessManager_ATC.StakingVestingOperations.burnedAmount.value(burnedAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
  },
};
