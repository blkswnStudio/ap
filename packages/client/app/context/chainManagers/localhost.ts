import { makeVar } from '@apollo/client';
import { Contracts_Localhost, isCollateralTokenAddress, isDebtTokenAddress } from '../../../config';
import {
  CollSurplusPool,
  HintHelpers,
  RedemptionOperations as RedemptionOperationsContract,
  StabilityPoolManager,
  StoragePool,
  TroveManager,
} from '../../../generated/types';
import { ContractDataFreshnessManagerType, ContractValue, TokenAmount } from '../CustomApolloProvider';
// GENERATED IMPORT CODE START - DO NOT EDIT THIS SECTION MANUALLY
import { AddressLike } from 'ethers';
import DebtToken_STABLE from '../typePolicies/localhost/DebtToken_STABLE.policy';
import DebtToken_STOCK_1 from '../typePolicies/localhost/DebtToken_STOCK_1.policy';
import DebtToken_STOCK_2 from '../typePolicies/localhost/DebtToken_STOCK_2.policy';
import ERC20_BTC from '../typePolicies/localhost/ERC20_BTC.policy';
import ERC20_GOV from '../typePolicies/localhost/ERC20_GOV.policy';
import ERC20_USDT from '../typePolicies/localhost/ERC20_USDT.policy';
import SwapPairs_BTC from '../typePolicies/localhost/SwapPairs_BTC.policy';
import SwapPairs_GOV from '../typePolicies/localhost/SwapPairs_GOV.policy';
import SwapPairs_STOCK_1 from '../typePolicies/localhost/SwapPairs_STOCK_1.policy';
import SwapPairs_STOCK_2 from '../typePolicies/localhost/SwapPairs_STOCK_2.policy';
import SwapPairs_USDT from '../typePolicies/localhost/SwapPairs_USDT.policy';
// GENERATED IMPORT CODE END

const defaultFieldValue = BigInt(0);

/**
 * This manages the data fetching from the contracts if the data is reused. E.g.: get many debts from the trovemanager instead of making individual calls.
 */
export const ContractDataFreshnessManager_LOCALHOST: {
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
  CollSurplusPool: Record<string, ContractValue<TokenAmount[]>>;
} = {
  TroveManager: {
    getTroveDebt: {
      fetch: async (troveManagerContract: TroveManager, borrower: AddressLike) => {
        ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveDebt.lastFetched = Date.now();
        const troveDebt = await troveManagerContract.getTroveDebt(borrower);

        const tokenAmounts = troveDebt.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveDebt.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_Localhost.DebtToken).forEach((tokenAddress) => {
          if (isDebtTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_LOCALHOST.DebtToken[tokenAddress].troveMintedAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },
    getTroveRepayableDebts: {
      fetch: async (troveManagerContract: TroveManager, borrower: AddressLike) => {
        ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveRepayableDebts.lastFetched = Date.now();

        const troveRepayableDebts = await troveManagerContract['getTroveRepayableDebts(address,bool)'](borrower, false);

        const tokenAmounts = troveRepayableDebts.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveRepayableDebts.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_Localhost.DebtToken).forEach((tokenAddress) => {
          if (isDebtTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_LOCALHOST.DebtToken[tokenAddress].troveRepableDebtAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },
    getTroveWithdrawableColls: {
      fetch: async (troveManagerContract: TroveManager, borrower: AddressLike) => {
        ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveWithdrawableColls.lastFetched = Date.now();
        const troveColl = await troveManagerContract.getTroveWithdrawableColls(borrower);

        const tokenAmounts = troveColl.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveWithdrawableColls.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_Localhost.ERC20).forEach((tokenAddress) => {
          if (isCollateralTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_LOCALHOST.ERC20[tokenAddress].troveLockedAmount.fetch();
          }
        });
        Object.values(Contracts_Localhost.DebtToken).forEach((tokenAddress) => {
          if (isDebtTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_LOCALHOST.DebtToken[tokenAddress].troveLockedAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },
    getCurrentICR: {
      fetch: async (borrower: AddressLike, hintHelpersContract: HintHelpers) => {
        ContractDataFreshnessManager_LOCALHOST.TroveManager.getCurrentICR.lastFetched = Date.now();

        const borrowerICR = await hintHelpersContract['getCurrentICR(address)'](borrower);

        ContractDataFreshnessManager_LOCALHOST.TroveManager.getCurrentICR.value = borrowerICR as any;
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
        ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorDeposits.lastFetched = Date.now();
        const depositorDeposits = await stabilityPoolManagerContract.getDepositorDeposits(depositor);

        const tokenAmounts = depositorDeposits.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorDeposits.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_Localhost.DebtToken).forEach((tokenAddress) => {
          if (isDebtTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_LOCALHOST.DebtToken[tokenAddress].providedStability.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },

    getDepositorCollGains: {
      fetch: async (stabilityPoolManagerContract: StabilityPoolManager, depositor: AddressLike) => {
        ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorCollGains.lastFetched = Date.now();
        const depositorCollGains = await stabilityPoolManagerContract.getDepositorCollGains(depositor);

        const tokenAmounts = depositorCollGains.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorCollGains.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_Localhost.ERC20).forEach((tokenAddress) => {
          if (isCollateralTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_LOCALHOST.ERC20[tokenAddress].stabilityGainedAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },

    getDepositorCompoundedDeposits: {
      fetch: async (stabilityPoolManagerContract: StabilityPoolManager, depositor: AddressLike) => {
        ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorCompoundedDeposits.lastFetched =
          Date.now();
        const depositorCompoundedDeposits =
          await stabilityPoolManagerContract.getDepositorCompoundedDeposits(depositor);

        const tokenAmounts = depositorCompoundedDeposits.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorCompoundedDeposits.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_Localhost.DebtToken).forEach((tokenAddress) => {
          if (isDebtTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_LOCALHOST.DebtToken[tokenAddress].compoundedDeposit.fetch();
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
        ContractDataFreshnessManager_LOCALHOST.StoragePool.checkRecoveryMode.lastFetched = Date.now();
        const [isInRecoveryMode, systemTCR, entireSystemColl, entireSystemDebt] =
          await storagePoolContract['checkRecoveryMode()']();

        ContractDataFreshnessManager_LOCALHOST.StoragePool.checkRecoveryMode.value = {
          isInRecoveryMode,
          TCR: systemTCR,
          entireSystemColl,
          entireSystemDebt,
        };

        // Update the values of all tokens after fetching.
        SchemaDataFreshnessManager_LOCALHOST.StoragePool.totalCollateralRatio.fetch();
        SchemaDataFreshnessManager_LOCALHOST.StoragePool.recoveryModeActive.fetch();
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
        ContractDataFreshnessManager_LOCALHOST.CollSurplusPool.getCollateral.lastFetched = Date.now();

        const depositorSurplusCollateral = await collSurplusContract.getCollateral(depositor);

        const tokenAmounts = depositorSurplusCollateral.map(([tokenAddress, amount]) => ({
          tokenAddress,
          amount,
        }));

        ContractDataFreshnessManager_LOCALHOST.CollSurplusPool.getCollateral.value = tokenAmounts;

        // Update the values of all tokens after fetching.
        Object.values(Contracts_Localhost.ERC20).forEach((tokenAddress) => {
          if (isCollateralTokenAddress(tokenAddress)) {
            SchemaDataFreshnessManager_LOCALHOST.ERC20[tokenAddress].collSurplusAmount.fetch();
          }
        });
      },
      value: [],
      lastFetched: 0,
      timeout: 1000 * 2,
    },
  },
};

/**
 * This manages the data, fetching and freshness on each client side field in the schema
 */
export const SchemaDataFreshnessManager_LOCALHOST: ContractDataFreshnessManagerType<typeof Contracts_Localhost> = {
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
  } as any ,

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
        SchemaDataFreshnessManager_LOCALHOST.StoragePool.totalCollateralRatio.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.StoragePool.checkRecoveryMode.fetch(
            fetchSource.storagePoolContract,
          );
        }

        const { TCR } = ContractDataFreshnessManager_LOCALHOST.StoragePool.checkRecoveryMode.value;
        SchemaDataFreshnessManager_LOCALHOST.StoragePool.totalCollateralRatio.value(TCR);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    recoveryModeActive: {
      fetch: async (fetchSource?: { storagePoolContract: StoragePool }) => {
        SchemaDataFreshnessManager_LOCALHOST.StoragePool.recoveryModeActive.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.StoragePool.checkRecoveryMode.fetch(
            fetchSource.storagePoolContract,
          );
        }

        const { isInRecoveryMode } = ContractDataFreshnessManager_LOCALHOST.StoragePool.checkRecoveryMode.value;

        SchemaDataFreshnessManager_LOCALHOST.StoragePool.recoveryModeActive.value(isInRecoveryMode as any);
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
        SchemaDataFreshnessManager_LOCALHOST.RedemptionOperations.redemptionRateWithDecay.lastFetched = Date.now();

        const redemptionFee = await redemptionOperationsContract.getRedemptionRateWithDecay();

        SchemaDataFreshnessManager_LOCALHOST.RedemptionOperations.redemptionRateWithDecay.value(redemptionFee);
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
        SchemaDataFreshnessManager_LOCALHOST.TroveManager.borrowerIMCR.lastFetched = Date.now();
        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.TroveManager.getCurrentICR.fetch(
            fetchSource.borrower,
            fetchSource.hintHelpersContract,
          );
        }

        const { IMCR } = ContractDataFreshnessManager_LOCALHOST.TroveManager.getCurrentICR.value as any;

        SchemaDataFreshnessManager_LOCALHOST.TroveManager.borrowerIMCR.value(IMCR);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    borrowerICR: {
      fetch: async (fetchSource: { borrower: AddressLike; hintHelpersContract: HintHelpers }) => {
        SchemaDataFreshnessManager_LOCALHOST.TroveManager.borrowerICR.lastFetched = Date.now();
        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.TroveManager.getCurrentICR.fetch(
            fetchSource.borrower,
            fetchSource.hintHelpersContract,
          );
        }

        const { ICR } = ContractDataFreshnessManager_LOCALHOST.TroveManager.getCurrentICR.value as any;

        SchemaDataFreshnessManager_LOCALHOST.TroveManager.borrowerICR.value(ICR);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    borrowingInterestRate: {
      fetch: async (troveManagerContract: TroveManager) => {
        SchemaDataFreshnessManager_LOCALHOST.TroveManager.borrowingInterestRate.lastFetched = Date.now();

        const borrowingInterestRate = await troveManagerContract.borrowingInterestRate();

        SchemaDataFreshnessManager_LOCALHOST.TroveManager.borrowingInterestRate.value(borrowingInterestRate);
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
};
