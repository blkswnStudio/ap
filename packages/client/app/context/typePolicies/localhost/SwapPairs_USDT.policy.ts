import { makeVar } from '@apollo/client';
import { AddressLike } from 'ethers';
import { Contracts_Localhost } from '../../../../config';
import { StakingOperations, SwapPair } from '../../../../generated/types';
import { SchemaDataFreshnessManager_LOCALHOST } from '../../chainManagers/localhost';

const defaultFieldValue = BigInt(0);

const SwapPairs_USDT = {
  [Contracts_Localhost.SwapPairs.USDT]: {
    borrowerAmount: {
      fetch: async (swapPair: AddressLike, stakingOperationsContract: StakingOperations, borrower: AddressLike) => {
        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[Contracts_Localhost.SwapPairs.USDT].borrowerAmount.lastFetched =
          Date.now();

        const userPoolBalance = await stakingOperationsContract.balanceOf(swapPair, borrower);

        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[Contracts_Localhost.SwapPairs.USDT].borrowerAmount.value(
          userPoolBalance,
        );
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
      periodic: 1000 * 30,
    },
    swapFee: {
      fetch: async (swapPairContract: SwapPair, reserve0: bigint, reserve1: bigint) => {
        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[Contracts_Localhost.SwapPairs.USDT].swapFee.lastFetched =
          Date.now();

        const swapFee = await swapPairContract.getSwapFee(reserve0, reserve1);

        SchemaDataFreshnessManager_LOCALHOST.SwapPairs[Contracts_Localhost.SwapPairs.USDT].swapFee.value(swapFee);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
    },
  },
};

export default SwapPairs_USDT;