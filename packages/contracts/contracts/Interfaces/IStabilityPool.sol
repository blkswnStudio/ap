// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IDebtToken.sol';
import './IBase.sol';

interface IStabilityPool is IBase {
  // --- Events ---

  event StabilityPoolInitialized(address stabilityPoolManagerAddress, address depositTokenAddress);

  event StabilityProvided(address user, uint amount);
  event StabilityWithdrawn(address user, uint amount);
  event StabilityGainsWithdrawn(address user, uint depositLost, TokenAmount[] gainsWithdrawn);

  // used as trigger to update the users compounded deposit and current coll gains (there is not user specific event for that)
  event StabilityOffset(uint removedDeposit, TokenAmount[] addedGains);

  event P_Updated(uint _P);
  event S_Updated(address _tokenAddress, uint _S, uint128 _epoch, uint128 _scale);
  event EpochUpdated(uint128 _currentEpoch);
  event ScaleUpdated(uint128 _currentScale);
  event DepositSnapshotUpdated(address indexed _depositor);
  // event G_Updated(uint _G, uint128 _epoch, uint128 _scale);

  // --- Errors  ---

  error NotFromStabilityPoolManager();
  error ZeroAmount();
  error NotOneTrove();
  error UnknownCollateral();

  // --- Functions ---

  function getDepositToken() external view returns (IDebtToken);

  function getTotalDeposit() external view returns (uint);

  function getDepositorDeposit(address _depositor) external view returns (uint);

  function getCompoundedDebtDeposit(address _depositor) external view returns (uint);

  function getTotalGainedColl() external view returns (TokenAmount[] memory coll);

  function getDepositorCollGain(address _depositor, address _collToken) external view returns (uint);

  function getDepositorCollSnapshot(address _depositor, address _collToken) external view returns (uint);

  function provideToSP(address user, uint _amount) external;

  function withdrawFromSP(address user, uint _amount) external;

  function withdrawGains(address user) external;

  function offset(uint _debtToOffset, TokenAmount[] memory _collToAdd) external;

  function provideIncentives(TokenAmount[] memory _collToAdd) external;
}
