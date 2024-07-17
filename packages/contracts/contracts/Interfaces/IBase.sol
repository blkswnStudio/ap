// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IBase {
  enum PoolType {
    Active, // assets in active troves
    Default, // assets from redistributions, which are not yet claimed by the trove owners
    GasCompensation, // stableCoin from gas compensation
    Unassigned // assets from a trove liquidation of the last coll type, can be claimed by anyone
  }

  error FeeExceedMaxPercentage();
  error AlreadyInitialized();

  struct MintMeta {
    address upperHint;
    address lowerHint;
    uint maxFeePercentage;
  }

  struct PriceUpdateAndMintMeta {
    MintMeta meta;
    bytes[] priceUpdateData;
  }

  struct RAmount {
    address tokenAddress;
    bool isColl; // coll or debt token
    uint amount; // initial value in trove
    uint pendingReward; // gained rewards since deposit
    uint pendingInterest; // gained interest since deposit (only for stable coin)
    uint gasCompensation; // gas compensation for liquidation
    uint toLiquidate; // amount + pendingReward - gasCompensation
    uint toRedistribute; // across other open troves
    uint toOffset; // by stability pools
    uint collSurplus; // coll only, in case of an ICR > MCR liquidation
  }

  struct CAmount {
    address tokenAddress;
    bool isColl; // coll or debt token
    uint amount;
  }

  struct TokenPrice {
    address tokenAddress;
    uint tokenDecimals;
    uint price;
    bool isPriceTrusted;
    uint supportedCollateralRatio; // only relevant for coll tokens
  }

  struct PriceCache {
    TokenPrice[] collPrices;
    TokenPrice[] debtPrices;
  }

  struct TokenAmount {
    address tokenAddress;
    uint amount;
  }

  struct RedeemIteration {
    address trove;
    address upperHint;
    address lowerHint;
    uint expectedCR;
  }

  struct SingleRedemptionVariables {
    TokenAmount stableCoinEntry;
    //
    uint stableCoinLot; // redeemer pays for the debts of the trove owner
    TokenAmount[] collLots; // will be removed from the troves coll and paid to the redeemer
    //
    uint troveCollInUSD;
    uint redeemableTroveCollInUSD;
    uint troveDebtInUSD;
    uint resultingCR;
  }
}
