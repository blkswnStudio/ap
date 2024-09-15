import { makeVar } from '@apollo/client';
import { AddressLike } from 'ethers';
import { Contracts_Localhost } from '../../../../config';
import { StakingOperations, SwapPair } from '../../../../generated/types';
import { SchemaDataFreshnessManager_LOCALHOST } from '../../chainManagers/localhost';

const defaultFieldValue = BigInt(0);

const SwapPairs_STOCK_1 = {
  [Contracts_Localhost.SwapPairs.STOCK_1]: {
    borrowerAmount: {
      fetch: async (swapPair: AddressLike, stakingOperationsContract: StakingOperations, borrower: AddressLike) => {
        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[
          Contracts_Localhost.SwapPairs.STOCK_1
        ].borrowerAmount.lastFetched = Date.now();

        const userPoolBalance = await stakingOperationsContract.balanceOf(swapPair, borrower);

        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[Contracts_Localhost.SwapPairs.STOCK_1].borrowerAmount.value(
          userPoolBalance,
        );
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    pendingRewards: {
      fetch: async (stakingOperationsContract: StakingOperations, address: string) => {
        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[
          Contracts_Localhost.SwapPairs.STOCK_1
        ].pendingRewards.lastFetched = Date.now();

        const pendingRewards = await stakingOperationsContract.pendingReward(
          Contracts_Localhost.SwapPairs.STOCK_1,
          address,
        );

        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[Contracts_Localhost.SwapPairs.STOCK_1].pendingRewards.value(
          pendingRewards,
        );
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
    },
    swapFee: {
      fetch: async (swapPairContract: SwapPair, reserve0: bigint, reserve1: bigint) => {
        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[Contracts_Localhost.SwapPairs.STOCK_1].swapFee.lastFetched =
          Date.now();

        const swapFee = await swapPairContract.getSwapFee(reserve0, reserve1);

        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[Contracts_Localhost.SwapPairs.STOCK_1].swapFee.value(swapFee);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
    },
  },
};

export default SwapPairs_STOCK_1;
