'use client';

import { PropsWithChildren, createContext, useContext } from 'react';
import { getAllowance, getDynamicSwapFee } from '../utils/crypto';

export type UtilityProviderProps = {
  getDynamicSwapFeeOverride?: typeof getDynamicSwapFee;
  getAllowanceOverride?: typeof getAllowance;
};

export const UtilityProviderContext = createContext<{
  getDynamicSwapFee: typeof getDynamicSwapFee;
  getAllowance: typeof getAllowance;
}>({
  getDynamicSwapFee: (() => {}) as any,
  getAllowance: (() => {}) as any,
});

export default function UtilityProvider({
  children,
  getDynamicSwapFeeOverride,
  getAllowanceOverride,
}: PropsWithChildren<UtilityProviderProps>): JSX.Element {
  return (
    <UtilityProviderContext.Provider
      value={{
        getDynamicSwapFee: getDynamicSwapFeeOverride!,
        getAllowance: getAllowanceOverride!,
      }}
    >
      {children}
    </UtilityProviderContext.Provider>
  );
}

export function useUtilities(): {
  getDynamicSwapFee: typeof getDynamicSwapFee;
  getAllowance: typeof getAllowance;
} {
  const context = useContext(UtilityProviderContext);
  if (context === undefined) {
    throw new Error('useUtilities must be used within an UtilityProviderContext');
  }
  return context;
}
