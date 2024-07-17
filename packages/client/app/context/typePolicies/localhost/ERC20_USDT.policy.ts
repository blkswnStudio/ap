import { makeVar } from '@apollo/client';
import { AddressLike } from 'ethers';
import { Contracts_Localhost, isStableCoinAddress } from '../../../../config';
import { CollSurplusPool, ERC20, PriceFeed, StabilityPoolManager, TroveManager } from '../../../../generated/types';
import { getCheckSum } from '../../../utils/crypto';
import {
  ContractDataFreshnessManager_LOCALHOST,
  SchemaDataFreshnessManager_LOCALHOST,
} from '../../chainManagers/localhost';

const defaultFieldValue = BigInt(0);

const ERC20_USDT = {
  [Contracts_Localhost.ERC20.USDT]: {
    priceUSDOracle: {
      fetch: async (updatedPrice?: bigint, priceFeedContract?: PriceFeed) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].priceUSDOracle.lastFetched =
          Date.now();

        if (priceFeedContract && !updatedPrice) {
          const price = await priceFeedContract.getPrice(Contracts_Localhost.ERC20.USDT);
          updatedPrice = BigInt(price.price);
        }

        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].priceUSDOracle.value(updatedPrice);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 10,
    },

    borrowingRate: {
      fetch: async (troveManagerContract: TroveManager) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].borrowingRate.lastFetched =
          Date.now();

        const borrowingRate = await troveManagerContract.getBorrowingRate(
          isStableCoinAddress(Contracts_Localhost.ERC20.USDT),
        );

        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].borrowingRate.value(borrowingRate);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    walletAmount: {
      fetch: async (collTokenContract: ERC20, depositor: AddressLike) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].walletAmount.lastFetched =
          Date.now();

        const walletAmount = await collTokenContract.balanceOf(depositor);

        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].walletAmount.value(walletAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    troveLockedAmount: {
      fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].troveLockedAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveWithdrawableColls.fetch(
            fetchSource.troveManagerContract,
            fetchSource.borrower,
          );
        }

        const tokenAmount = ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveWithdrawableColls.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_Localhost.ERC20.USDT),
        )?.amount;
        if (tokenAmount) {
          SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].troveLockedAmount.value(
            tokenAmount,
          );
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    stabilityGainedAmount: {
      fetch: async (fetchSource?: { stabilityPoolManagerContract: StabilityPoolManager; depositor: AddressLike }) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].stabilityGainedAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorCollGains.fetch(
            fetchSource.stabilityPoolManagerContract,
            fetchSource.depositor,
          );
        }

        const tokenAmount =
          ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorCollGains.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_Localhost.ERC20.USDT),
          )?.amount;
        if (tokenAmount) {
          SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].stabilityGainedAmount.value(
            tokenAmount,
          );
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    collSurplusAmount: {
      fetch: async (fetchSource?: { collSurplusContract: CollSurplusPool; depositor: AddressLike }) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].collSurplusAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.CollSurplusPool.getCollateral.fetch(
            fetchSource.collSurplusContract,
            fetchSource.depositor,
          );
        }

        const tokenAmount = ContractDataFreshnessManager_LOCALHOST.CollSurplusPool.getCollateral.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_Localhost.ERC20.USDT),
        )?.amount;
        if (tokenAmount) {
          SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.USDT].collSurplusAmount.value(
            tokenAmount,
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

export default ERC20_USDT;
