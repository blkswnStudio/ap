import { makeVar } from '@apollo/client';
import { AddressLike } from 'ethers';
import { Contracts_ATC, isStableCoinAddress } from '../../../../config';
import { CollSurplusPool, ERC20, PriceFeed, StabilityPoolManager, TroveManager } from '../../../../generated/types';
import { getCheckSum } from '../../../utils/crypto';
import {
  ContractDataFreshnessManager_ATC,
  SchemaDataFreshnessManager_ATC,
} from '../../chainManagers/apollon-testing-chain';

const defaultFieldValue = BigInt(0);

const ERC20_STABLE = {
  [Contracts_ATC.ERC20.STABLE]: {
    priceUSDOracle: {
      fetch: async (updatedPrice?: bigint, priceFeedContract?: PriceFeed) => {
        SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].priceUSDOracle.lastFetched = Date.now();

        if (priceFeedContract && !updatedPrice) {
          const price = await priceFeedContract.getPrice(Contracts_ATC.ERC20.STABLE);
          updatedPrice = BigInt(price.price);
        }

        SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].priceUSDOracle.value(updatedPrice);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 10,
    },

    borrowingRate: {
      fetch: async (troveManagerContract: TroveManager) => {
        SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].borrowingRate.lastFetched = Date.now();

        const borrowingRate = await troveManagerContract.getBorrowingRate(isStableCoinAddress(Contracts_ATC.ERC20.STABLE));

        SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].borrowingRate.value(borrowingRate);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    walletAmount: {
      fetch: async (collTokenContract: ERC20, depositor: AddressLike) => {
        SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].walletAmount.lastFetched = Date.now();

        const walletAmount = await collTokenContract.balanceOf(depositor);

        SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].walletAmount.value(walletAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    troveLockedAmount: {
      fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].troveLockedAmount.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.TroveManager.getTroveWithdrawableColls.fetch(
            fetchSource.troveManagerContract,
            fetchSource.borrower,
          );
        }

        const tokenAmount = ContractDataFreshnessManager_ATC.TroveManager.getTroveWithdrawableColls.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.ERC20.STABLE),
        )?.amount;
        if (tokenAmount) {
          SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].troveLockedAmount.value(tokenAmount);
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    stabilityGainedAmount: {
      fetch: async (fetchSource?: { stabilityPoolManagerContract: StabilityPoolManager; depositor: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].stabilityGainedAmount.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCollGains.fetch(
            fetchSource.stabilityPoolManagerContract,
            fetchSource.depositor,
          );
        }

        const tokenAmount = ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCollGains.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.ERC20.STABLE),
        )?.amount;
        if (tokenAmount) {
          SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].stabilityGainedAmount.value(tokenAmount);
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    collSurplusAmount: {
      fetch: async (fetchSource?: { collSurplusContract: CollSurplusPool; depositor: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].collSurplusAmount.lastFetched = Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.CollSurplusPool.getCollateral.fetch(
            fetchSource.collSurplusContract,
            fetchSource.depositor,
          );
        }

        const tokenAmount = ContractDataFreshnessManager_ATC.CollSurplusPool.getCollateral.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.ERC20.STABLE),
        )?.amount;
        if (tokenAmount) {
          SchemaDataFreshnessManager_ATC.ERC20[Contracts_ATC.ERC20.STABLE].collSurplusAmount.value(tokenAmount);
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
  },
};

export default ERC20_STABLE;