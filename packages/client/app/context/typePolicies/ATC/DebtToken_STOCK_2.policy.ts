import { InMemoryCache, makeVar } from '@apollo/client';
import { AddressLike, ethers } from 'ethers';
import { Contracts_ATC, isGOVTokenAddress, isStableCoinAddress } from '../../../../config';
import { DebtToken, PriceFeed, StabilityPoolManager, TroveManager } from '../../../../generated/types';
import {
  GetBorrowerCollateralTokensQuery,
  GetBorrowerCollateralTokensQueryVariables,
} from '../../../generated/gql-types';
import { GET_BORROWER_COLLATERAL_TOKENS } from '../../../queries';
import { getCheckSum } from '../../../utils/crypto';
import { convertToEtherPrecission } from '../../../utils/math';
import {
  ContractDataFreshnessManager_ATC,
  SchemaDataFreshnessManager_ATC,
} from '../../chainManagers/apollon-testing-chain';

const defaultFieldValue = BigInt(0);

const DebtToken_STOCK_2 = {
  [Contracts_ATC.DebtToken.STOCK_2]: {
    priceUSDOracle: {
      fetch: async (updatedPrice?: bigint, priceFeedContract?: PriceFeed) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].priceUSDOracle.lastFetched =
          Date.now();

        if (priceFeedContract && !updatedPrice) {
          const price = await priceFeedContract.getPrice(Contracts_ATC.DebtToken.STOCK_2);
          updatedPrice = BigInt(price.price);
        }

        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].priceUSDOracle.value(updatedPrice);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 5,
    },

    borrowingRate: {
      fetch: async (troveManagerContract: TroveManager, cache: InMemoryCache, borrower: string) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].borrowingRate.lastFetched =
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
          isStableCoinAddress(Contracts_ATC.DebtToken.STOCK_2),
          percentageGovToken,
        );

        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].borrowingRate.value(borrowingRate);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 15,
      initDelayed: 1000 * 3,
    },

    walletAmount: {
      fetch: async (debtTokenContract: DebtToken, borrower: AddressLike) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].walletAmount.lastFetched = Date.now();

        const borrowerBalance = await debtTokenContract.balanceOf(borrower);

        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].walletAmount.value(borrowerBalance);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    troveMintedAmount: {
      fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].troveMintedAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.TroveManager.getTroveDebt.fetch(
            fetchSource.troveManagerContract,
            fetchSource.borrower,
          );
        }

        const tokenAmount =
          ContractDataFreshnessManager_ATC.TroveManager.getTroveDebt.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STOCK_2),
          )?.amount ?? defaultFieldValue;
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].troveMintedAmount.value(tokenAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    troveDebtAmount: {
      fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].troveDebtAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.TroveManager.getTroveRepayableDebts.fetch(
            fetchSource.troveManagerContract,
            fetchSource.borrower,
          );
        }

        const repayableDebt = ContractDataFreshnessManager_ATC.TroveManager.getTroveRepayableDebts.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STOCK_2),
        )?.amount;
        if (repayableDebt) {
          SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].troveDebtAmount.value(
            repayableDebt,
          );
        }
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    troveRepableDebtAmount: {
      fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].troveRepableDebtAmount.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.TroveManager.getTroveRepayableDebts.fetch(
            fetchSource.troveManagerContract,
            fetchSource.borrower,
          );
        }

        const repayableDebt = ContractDataFreshnessManager_ATC.TroveManager.getTroveRepayableDebts.value.find(
          ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STOCK_2),
        )?.amount;
        if (repayableDebt) {
          SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].troveRepableDebtAmount.value(
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
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].providedStability.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorDeposits.fetch(
            fetchSource.stabilityPoolManagerContract,
            fetchSource.depositor,
          );
        }

        const tokenAmount =
          ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorDeposits.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STOCK_2),
          )?.amount ?? defaultFieldValue;
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].providedStability.value(tokenAmount);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },

    compoundedDeposit: {
      fetch: async (fetchSource?: { stabilityPoolManagerContract: StabilityPoolManager; depositor: AddressLike }) => {
        SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].compoundedDeposit.lastFetched =
          Date.now();

        if (fetchSource) {
          await ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCompoundedDeposits.fetch(
            fetchSource.stabilityPoolManagerContract,
            fetchSource.depositor,
          );
        }

        const compoundedDeposit =
          ContractDataFreshnessManager_ATC.StabilityPoolManager.getDepositorCompoundedDeposits.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts_ATC.DebtToken.STOCK_2),
          )?.amount;

        if (compoundedDeposit) {
          SchemaDataFreshnessManager_ATC.DebtToken[Contracts_ATC.DebtToken.STOCK_2].compoundedDeposit.value(
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

export default DebtToken_STOCK_2;
