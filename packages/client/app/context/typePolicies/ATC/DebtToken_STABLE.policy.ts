import { makeVar } from '@apollo/client';
import { AddressLike, parseEther } from 'ethers';
import { Contracts_ATC, isStableCoinAddress } from '../../../../config';
import { DebtToken, PriceFeed, StabilityPoolManager, TroveManager } from '../../../../generated/types';
import { getCheckSum } from '../../../utils/crypto';
import {
  ContractDataFreshnessManager_ATC,
  SchemaDataFreshnessManager_ATC,
} from '../../chainManagers/apollon-testing-chain';

const defaultFieldValue = BigInt(0);

const DebtToken_STABLE = {
  [Contracts_ATC.DebtToken.STABLE]: {
    priceUSDOracle: {
      fetch: async (updatedPrice?: bigint, priceFeedContract?: PriceFeed) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].priceUSDOracle.lastFetched =
          Date.now();

        // if (priceFeedContract && !updatedPrice) {
        //   const price = await priceFeedContract.getPrice(Contracts_ATC.DebtToken.STABLE);
        //   updatedPrice = BigInt(price.price);
        // }

        // SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].priceUSDOracle.value(updatedPrice);
      },
      value: makeVar(parseEther('1')),
      lastFetched: 0,
      timeout: 1000 * 10,
    },

    borrowingRate: {
      fetch: async (troveManagerContract: TroveManager) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].borrowingRate.lastFetched = Date.now();

        const borrowingRate = await troveManagerContract.getBorrowingRate(
          isStableCoinAddress(Contracts_ATC.DebtToken.STABLE),
        );

        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].borrowingRate.value(borrowingRate);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    walletAmount: {
      fetch: async (debtTokenContract: DebtToken, borrower: AddressLike) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].walletAmount.lastFetched = Date.now();

        const borrowerBalance = await debtTokenContract.balanceOf(borrower);

        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].walletAmount.value(borrowerBalance);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    troveMintedAmount: {
      fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].troveMintedAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.TroveManager.getTroveDebt.fetch(
            fetchSource.troveManagerContract,
            fetchSource.borrower,
          );
        }

        const tokenAmount = ContractDataFreshnessManager_ATC.TroveManager.getTroveDebt.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STABLE),
        )?.amount;
        if (tokenAmount) {
          SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].troveMintedAmount.value(tokenAmount);
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    troveDebtAmount: {
      fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
        if (fetchSource) {
          SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].troveDebtAmount.lastFetched =
            Date.now();

          // Here we get the debt without the non-repayable debts, only applies to STABLE for now
          const troveRepayableDebts = await fetchSource.troveManagerContract['getTroveRepayableDebts(address,bool)'](
            fetchSource.borrower,
            true,
          );

          const tokenAmounts = troveRepayableDebts.map(([tokenAddress, amount]) => ({
            tokenAddress,
            amount,
          }));

          const debtAmount = tokenAmounts.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STABLE),
          )?.amount;

          if (debtAmount) {
            SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].troveDebtAmount.value(debtAmount);
          }
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    troveRepableDebtAmount: {
      fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].troveRepableDebtAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.TroveManager.getTroveRepayableDebts.fetch(
            fetchSource.troveManagerContract,
            fetchSource.borrower,
          );
        }

        const repayableDebt = ContractDataFreshnessManager_ATC.TroveManager.getTroveRepayableDebts.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STABLE),
        )?.amount;
        if (repayableDebt) {
          SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].troveRepableDebtAmount.value(
            repayableDebt,
          );
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    providedStability: {
      fetch: async (fetchSource?: { stabilityPoolManagerContract: StabilityPoolManager; depositor: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].providedStability.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorDeposits.fetch(
            fetchSource.stabilityPoolManagerContract,
            fetchSource.depositor,
          );
        }

        const tokenAmount = ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorDeposits.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STABLE),
        )?.amount;
        if (tokenAmount) {
          SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].providedStability.value(tokenAmount);
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    compoundedDeposit: {
      fetch: async (fetchSource?: { stabilityPoolManagerContract: StabilityPoolManager; depositor: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].compoundedDeposit.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCompoundedDeposits.fetch(
            fetchSource.stabilityPoolManagerContract,
            fetchSource.depositor,
          );
        }

        const compoundedDeposit =
          ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCompoundedDeposits.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STABLE),
          )?.amount;

        if (compoundedDeposit) {
          SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STABLE].compoundedDeposit.value(
            compoundedDeposit,
          );
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
  },
};

export default DebtToken_STABLE;
