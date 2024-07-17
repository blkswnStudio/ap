// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBase.sol';
import './IDebtToken.sol';
import './IStabilityPool.sol';

interface IBBase is IBase {
  enum Status {
    nonExistent,
    active,
    closedByOwner,
    closedByLiquidationInNormalMode,
    closedByLiquidationInRecoveryMode
  }

  struct DebtTokenAmount {
    IDebtToken debtToken;
    uint netDebt;
    uint borrowingFee; // only in case of stable coin
  }

  struct RemainingStability {
    IStabilityPool stabilityPool;
    address tokenAddress;
    uint remaining;
    uint debtToOffset; // debt amount which will be removed from the stability pool to liquidate the trove
    TokenAmount[] collGained; // coll which will be sent to the SP as rewards (multiple entries with same token address are possible)
  }
}
