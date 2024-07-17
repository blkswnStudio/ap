import { AddressLike, ethers } from 'ethers';
import { isStableCoinAddress } from '../../config';
import { ERC20, HintHelpers, SortedTroves, SwapPair } from '../../generated/types';
import { IBase } from '../../generated/types/TroveManager';

export const getCheckSum = (address: string) => {
  return ethers.getAddress(address);
};

export async function getHints(
  sortedTroves: SortedTroves,
  hintHelpers: HintHelpers,
  {
    borrower,
    addedColl,
    addedDebt,
    removedColl,
    removedDebt,
  }: {
    borrower: string;
    addedColl: IBase.TokenAmountStruct[];
    removedColl: IBase.TokenAmountStruct[];
    addedDebt: IBase.TokenAmountStruct[];
    removedDebt: IBase.TokenAmountStruct[];
  },
) {
  const collateralRatio = await hintHelpers.getICRIncludingPatch(
    borrower,
    addedColl,
    removedColl,
    addedDebt,
    removedDebt,
  );

  let hint: string;
  const amountStableTroves = await sortedTroves.getSize();

  if (amountStableTroves === 0n) {
    hint = ethers.ZeroAddress;
  } else {
    const [_hint] = await hintHelpers.getApproxHint(
      collateralRatio,
      Math.round(Math.min(4000, 15 * Math.sqrt(Number(amountStableTroves)))),
      Math.round(Math.random() * 100000000000),
    );
    hint = _hint;
  }

  return sortedTroves.findInsertPosition(collateralRatio, hint, hint);
}

export const getDynamicSwapFee = async (
  swapPairContract: SwapPair,
  reserveStable: bigint,
  reserveNonStable: bigint,
) => {
  const token0 = await swapPairContract.token0();

  if (isStableCoinAddress(token0)) {
    return swapPairContract.getSwapFee(reserveStable, reserveNonStable);
  }

  return swapPairContract.getSwapFee(reserveNonStable, reserveStable);
};

export const getAllowance = async (tokenContract: ERC20, owner: AddressLike, spender: AddressLike) => {
  return tokenContract.allowance(owner, spender);
};
