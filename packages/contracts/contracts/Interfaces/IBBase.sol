// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import './IBase.sol';
import './IDebtToken.sol';

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
}
