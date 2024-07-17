'use client';

import { useQuery } from '@apollo/client';
import { ethers } from 'ethers';
import { PropsWithChildren, createContext, useContext, useState } from 'react';
import { isStableCoinAddress } from '../../config';
import { GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables } from '../generated/gql-types';
import { GET_BORROWER_DEBT_TOKENS } from '../queries';
import { standardDataPollInterval } from '../utils/contants';
import { convertToEtherPrecission } from '../utils/math';
import { useEthers } from './EthersProvider';

export type SelectedToken = {
  id: string;
  swapFee: bigint;
  decimals: number;
  change: number;
  isFavorite: boolean;
  address: string;
  symbol: string;
  priceUSDOracle: bigint;
  priceUSD24hAgo: bigint;
  volume30dUSD: bigint;
  borrowingRate: bigint;
  pool: {
    // id to fetch from API
    id: string;
    // Contract address of SwapPair
    address: string;
    // STABLE is always first
    liquidityPair: bigint[];
    totalValueUSD: bigint;
  };
};

export const SelectedTokenContext = createContext<{
  JUSDToken: (GetBorrowerDebtTokensQuery['debtTokenMetas'][number]['token'] & { walletAmount: bigint }) | undefined;
  tokenRatio: bigint;
  selectedToken: SelectedToken | null;
  setSelectedToken: (asset: SelectedToken) => void;
}>({
  JUSDToken: undefined,
  tokenRatio: BigInt(0),
  selectedToken: null,
  setSelectedToken: () => {},
});

export default function SelectedTokenProvider({ children }: PropsWithChildren): JSX.Element {
  const { address } = useEthers();

  const [selectedToken, setSelectedToken] = useState<SelectedToken | null>(null);

  const { data } = useQuery<GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables>(GET_BORROWER_DEBT_TOKENS, {
    // Do I need this?
    // fetchPolicy: 'cache-first',
    variables: {
      borrower: address,
    },
    pollInterval: standardDataPollInterval,
  });

  const STABLE = data?.debtTokenMetas.find(({ token }) => isStableCoinAddress(token.address));
  const STABLEToken = STABLE ? { ...STABLE.token, walletAmount: STABLE.walletAmount } : undefined;

  const tokenRatio =
    STABLEToken === undefined || selectedToken === null
      ? ethers.parseEther('1')
      : (selectedToken!.pool.liquidityPair[0] * ethers.parseEther('1')) /
        convertToEtherPrecission(selectedToken!.pool.liquidityPair[1], selectedToken.decimals);

  return (
    <SelectedTokenContext.Provider
      value={{
        selectedToken,
        setSelectedToken,
        JUSDToken: STABLEToken,
        tokenRatio,
      }}
    >
      {children}
    </SelectedTokenContext.Provider>
  );
}

export function useSelectedToken(): {
  JUSDToken: (GetBorrowerDebtTokensQuery['debtTokenMetas'][number]['token'] & { walletAmount: bigint }) | undefined;
  tokenRatio: bigint;
  selectedToken: SelectedToken | null;
  setSelectedToken: (asset: SelectedToken) => void;
} {
  const context = useContext(SelectedTokenContext);
  if (context === undefined) {
    throw new Error('useSelectedToken must be used within an SelectedTokenProvider');
  }
  return context;
}
