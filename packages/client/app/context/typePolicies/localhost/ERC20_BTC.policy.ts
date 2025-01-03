import { InMemoryCache, makeVar } from '@apollo/client';
import { AddressLike, ethers } from 'ethers';
import { Contracts_Localhost, isGOVTokenAddress, isStableCoinAddress } from '../../../../config';
import { CollSurplusPool, ERC20, PriceFeed, StabilityPoolManager, TroveManager } from '../../../../generated/types';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
} from '../../../generated/gql-types';
import { GET_BORROWER_COLLATERAL_TOKENS } from '../../../queries';
import { getCheckSum } from '../../../utils/crypto';
import { convertToEtherPrecission } from '../../../utils/math';
import {
  ContractDataFreshnessManager_LOCALHOST,
  SchemaDataFreshnessManager_LOCALHOST,
} from '../../chainManagers/localhost';

const defaultFieldValue = BigInt(0);

const ERC20_BTC = {
  [Contracts_Localhost.ERC20.BTC]: {
    priceUSDOracle: {
      fetch: async (updatedPrice?: bigint, priceFeedContract?: PriceFeed) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].priceUSDOracle.lastFetched =
          Date.now();

        if (priceFeedContract && !updatedPrice) {
          const price = await priceFeedContract.getPrice(Contracts_Localhost.ERC20.BTC);
          updatedPrice = BigInt(price.price);
        }

        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].priceUSDOracle.value(updatedPrice);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 5,
    },

    borrowingRate: {
      fetch: async (troveManagerContract: TroveManager, cache: InMemoryCache, borrower: string) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].borrowingRate.lastFetched =
          Date.now();

        const data = cache.readQuery<GetBorrowerCollateralTokensQuery, GetBorrowerCollateralTokensQueryVariables>({
          query: GET_BORROWER_COLLATERAL_TOKENS,
          variables: { borrower },
        });

        let percentageGovToken = 0n;
        if (data) {
          const totalCollateralValue = data.collateralTokenMetas.reduce(
            (acc, { troveLockedAmount, token }) =>
              acc +
              (convertToEtherPrecission(troveLockedAmount, token.decimals) * token.priceUSDOracle) /
                ethers.parseEther('1'),
            0n,
          );
          const govToken = data?.collateralTokenMetas.find(({ token }) => isGOVTokenAddress(token.address));
          const govTokenValue = govToken
            ? (convertToEtherPrecission(govToken.troveLockedAmount, govToken.token.decimals) *
                govToken.token.priceUSDOracle) /
              ethers.parseEther('1')
            : 0n;

          percentageGovToken = (govTokenValue * ethers.parseEther('1')) / totalCollateralValue;
        }

        const borrowingRate = await troveManagerContract.getBorrowingRate(
          isStableCoinAddress(Contracts_Localhost.ERC20.BTC),
          percentageGovToken,
        );

        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].borrowingRate.value(borrowingRate);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 15,
      initDelayed: 1000 * 3,
    },

    walletAmount: {
      fetch: async (collTokenContract: ERC20, depositor: AddressLike) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].walletAmount.lastFetched = Date.now();

        const walletAmount = await collTokenContract.balanceOf(depositor);

        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].walletAmount.value(walletAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    troveLockedAmount: {
      fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].troveLockedAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveWithdrawableColls.fetch(
            fetchSource.troveManagerContract,
            fetchSource.borrower,
          );
        }

        const tokenAmount =
          ContractDataFreshnessManager_LOCALHOST.TroveManager.getTroveWithdrawableColls.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_Localhost.ERC20.BTC),
          )?.amount ?? defaultFieldValue;
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].troveLockedAmount.value(tokenAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    stabilityGainedAmount: {
      fetch: async (fetchSource?: { stabilityPoolManagerContract: StabilityPoolManager; depositor: AddressLike }) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].stabilityGainedAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorCollGains.fetch(
            fetchSource.stabilityPoolManagerContract,
            fetchSource.depositor,
          );
        }

        const tokenAmount =
          ContractDataFreshnessManager_LOCALHOST.StabilityPoolManager.getDepositorCollGains.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_Localhost.ERC20.BTC),
          )?.amount ?? defaultFieldValue;
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].stabilityGainedAmount.value(
          tokenAmount,
        );
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    collSurplusAmount: {
      fetch: async (fetchSource?: { collSurplusContract: CollSurplusPool; depositor: AddressLike }) => {
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].collSurplusAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_LOCALHOST.CollSurplusPool.getCollateral.fetch(
            fetchSource.collSurplusContract,
            fetchSource.depositor,
          );
        }

        const tokenAmount =
          ContractDataFreshnessManager_LOCALHOST.CollSurplusPool.getCollateral.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_Localhost.ERC20.BTC),
          )?.amount ?? defaultFieldValue;
        SchemaDataFreshnessManager_LOCALHOST.ERC20[Contracts_Localhost.ERC20.BTC].collSurplusAmount.value(tokenAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
  },
};

export default ERC20_BTC;
