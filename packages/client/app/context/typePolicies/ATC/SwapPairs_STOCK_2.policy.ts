import { makeVar } from '@apollo/client';
import { AddressLike } from 'ethers';
import { Contracts_ATC } from '../../../../config';
import { StakingOperations, SwapPair } from '../../../../generated/types';
import { SchemaDataFreshnessManager_ATC } from '../../chainManagers/apollon-testing-chain';

const defaultFieldValue = BigInt(0);

const SwapPairs_STOCK_2 = {
  [Contracts_ATC.SwapPairs.STOCK_2]: {
    borrowerAmount: {
      fetch: async (swapPair: AddressLike, stakingOperationsContract: StakingOperations, borrower: AddressLike) => {
        SchemaDataFreshnessManager_ATC.SwapPairs[Contracts_ATC.SwapPairs.STOCK_2].borrowerAmount.lastFetched =
          Date.now();

        const userPoolBalance = await stakingOperationsContract.balanceOf(swapPair, borrower);

        SchemaDataFreshnessManager_ATC.SwapPairs[Contracts_ATC.SwapPairs.STOCK_2].borrowerAmount.value(userPoolBalance);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    pendingRewards: {
      fetch: async (stakingOperationsContract: StakingOperations, address: string) => {
        SchemaDataFreshnessManager_ATC.SwapPairs[Contracts_ATC.SwapPairs.STOCK_2].pendingRewards.lastFetched =
          Date.now();

        const pendingRewards = await stakingOperationsContract.pendingReward(Contracts_ATC.SwapPairs.STOCK_2, address);

        SchemaDataFreshnessManager_ATC.SwapPairs[Contracts_ATC.SwapPairs.STOCK_2].pendingRewards.value(pendingRewards);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
    },
    swapFee: {
      fetch: async (swapPairContract: SwapPair, reserve0: bigint, reserve1: bigint) => {
        SchemaDataFreshnessManager_ATC.SwapPairs[Contracts_ATC.SwapPairs.STOCK_2].swapFee.lastFetched = Date.now();

        const [swapFee] = await swapPairContract.getSwapFee(reserve0, reserve1);

        SchemaDataFreshnessManager_ATC.SwapPairs[Contracts_ATC.SwapPairs.STOCK_2].swapFee.value(swapFee);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
    },
  },
};

export default SwapPairs_STOCK_2;
