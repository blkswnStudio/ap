// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';
import '@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/IDebtToken.sol';
import './Interfaces/ITokenManager.sol';
import './Interfaces/ISwapOperations.sol';

/*
 *
 * Based upon OpenZeppelin's ERC20 contract:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol
 *
 * and their EIP2612 (ERC20Permit / ERC712) functionality:
 * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/53516bc555a454862470e7860a9b5254db4d00f5/contracts/token/ERC20/ERC20Permit.sol
 *
 *
 * --- Functionality added specific to the DToken ---
 *
 * 1) Transfer protection: blacklist of addresses that are invalid recipients (i.e. core Liquity contracts) in external
 * transfer() and transferFrom() calls. The purpose is to protect users from losing tokens by mistakenly sending dToken directly to a Liquity
 * core contract, when they should rather call the right function.
 *
 * 2) sendToPool(): functions callable only Liquity core contracts, which move dTokens between Liquity <-> user.
 */

contract DebtToken is CheckContract, IDebtToken {
  uint256 private _totalSupply;
  string internal _NAME;
  string internal _SYMBOL;
  string internal _VERSION;
  uint8 internal constant _DECIMALS = 18;
  bool internal immutable _IS_STABLE_COIN;

  // --- Data for EIP2612 ---

  // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
  bytes32 private constant _PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;
  // keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
  bytes32 private constant _TYPE_HASH = 0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f;

  // Cache the domain separator as an immutable value, but also store the chain id that it corresponds to, in order to
  // invalidate the cached domain separator if the chain id changes.
  bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;
  uint256 private immutable _CACHED_CHAIN_ID;

  bytes32 private immutable _HASHED_NAME;
  bytes32 private immutable _HASHED_VERSION;

  mapping(address => uint256) private _nonces;

  // User data for dToken
  mapping(address => uint256) private _balances;
  // sender => spender => amount
  mapping(address => mapping(address => uint256)) private _allowances;

  // Stock Split
  int public constant override STOCK_SPLIT_PRECISION = 1e8; // 100%
  int public constant STOCK_SPLIT_MARGIN = (STOCK_SPLIT_PRECISION / 100) * 5; // 5%
  // To prevent precision loss, we will NEVER have a stockSplit where abs(split) < STOCK_SPLIT_PRECISION.
  // A negative number represents a division, a positive number a multiplication.
  // So instead of multiplying with 0.333333 and get a precision loss, we will divide by 3 instead
  int public override currentStockSplit = STOCK_SPLIT_PRECISION;

  // Stock Exchange
  address public override exchangeStock;
  // See comment on stockSplit about preventing precision loss
  int public override stockExchangeRate;

  // --- Addresses ---
  address public immutable troveManagerAddress;
  address public immutable redemptionOperationsAddress;
  address public immutable borrowerOperationsAddress;
  address public immutable stabilityPoolManagerAddress;
  address public immutable priceFeedAddress;
  ITokenManager public immutable tokenManager;
  ISwapOperations public immutable swapOperations;

  constructor(
    address _troveManagerAddress,
    address _redemptionOperationsAddress,
    address _borrowerOperationsAddress,
    address _stabilityPoolManagerAddress,
    address _tokenManagerAddress,
    address _swapOperationsAddress,
    address _priceFeedAddress,
    string memory _symbol,
    string memory _name,
    string memory _version,
    bool _isStableCoin
  ) {
    checkContract(_troveManagerAddress);
    checkContract(_redemptionOperationsAddress);
    checkContract(_borrowerOperationsAddress);
    checkContract(_stabilityPoolManagerAddress);
    checkContract(_tokenManagerAddress);
    checkContract(_swapOperationsAddress);
    checkContract(_priceFeedAddress);

    troveManagerAddress = _troveManagerAddress;
    redemptionOperationsAddress = _redemptionOperationsAddress;
    borrowerOperationsAddress = _borrowerOperationsAddress;
    stabilityPoolManagerAddress = _stabilityPoolManagerAddress;
    priceFeedAddress = _priceFeedAddress;
    tokenManager = ITokenManager(_tokenManagerAddress);
    swapOperations = ISwapOperations(_swapOperationsAddress);

    _NAME = _name;
    _SYMBOL = _symbol;
    _VERSION = _version;
    _IS_STABLE_COIN = _isStableCoin;

    bytes32 hashedName = keccak256(bytes(_NAME));
    bytes32 hashedVersion = keccak256(bytes(_VERSION));

    _HASHED_NAME = hashedName;
    _HASHED_VERSION = hashedVersion;
    _CACHED_CHAIN_ID = _chainID();
    _CACHED_DOMAIN_SEPARATOR = _buildDomainSeparator(_TYPE_HASH, hashedName, hashedVersion);
  }

  // --- Functions for Stock Renaming ---

  function setSymbolAndName(string memory _symbol, string memory _name) external override {
    _requireCallerIsDebtTokenManager();

    // set
    _SYMBOL = _symbol;
    _NAME = _name;

    emit SetSymbolAndName(_SYMBOL, _NAME);
  }

  // --- Functions for Stock Exchange ---

  function setStockExchange(address _exchangeForStock, int _exchangeRate) external override {
    // check
    _requireCallerIsDebtTokenManager();
    if (_exchangeForStock == address(this)) revert InvalidStockForExchange();
    tokenManager.getDebtToken(_exchangeForStock); //check if valid stock token
    if (_exchangeRate >= -STOCK_SPLIT_PRECISION && _exchangeRate < STOCK_SPLIT_PRECISION) revert InvalidExchangeRate();

    // set
    exchangeStock = _exchangeForStock;
    stockExchangeRate = _exchangeRate;
    emit SetStockExchange(exchangeStock, stockExchangeRate);
  }

  // --- Functions for Stock Splits ---

  function setNextStockSplitRelative(int32 _relativeSplit) external override {
    _requireCallerIsDebtTokenManager();

    // check for valid relative split
    if (_relativeSplit >= -1 && _relativeSplit <= 1) revert InvalidRealtiveStockSplit();

    // get dividend
    int dividend = (currentStockSplit > 0 ? currentStockSplit : STOCK_SPLIT_PRECISION) *
      (_relativeSplit > 0 ? int(_relativeSplit) : int(1));

    // get divisor
    int divisor = (currentStockSplit < 0 ? -currentStockSplit : STOCK_SPLIT_PRECISION) *
      (_relativeSplit < 0 ? int(-_relativeSplit) : int(1));

    // get stock split (with this method we reduce precision loss)
    int split;
    if (divisor > dividend) {
      // reverse stock split
      split = -((divisor * STOCK_SPLIT_PRECISION) / dividend);
    } else {
      // stock split
      split = (dividend * STOCK_SPLIT_PRECISION) / divisor;
    }

    // check for valid split
    if (split >= -STOCK_SPLIT_PRECISION && split < STOCK_SPLIT_PRECISION) revert InvalidStockSplit();

    currentStockSplit = split;
    emit SetStockSplit(currentStockSplit);
  }

  // --- Functions for intra-Liquity calls ---

  function isStableCoin() external view override returns (bool) {
    return _IS_STABLE_COIN;
  }

  function mint(address _account, uint256 _amount) external override {
    _requireCallerIsBorrowerOperationsOrTroveManager();
    _requireMintingEnabled();
    _mint(_account, _amount);
  }

  function burn(address _account, uint256 _amount) external override {
    if (
      msg.sender != borrowerOperationsAddress &&
      msg.sender != stabilityPoolManagerAddress &&
      msg.sender != redemptionOperationsAddress &&
      !swapOperations.isPair(msg.sender)
    ) revert NotFromBOorTroveMorSPorDebtToken();

    _burn(_account, _amount);
  }

  function sendToPool(address _sender, address _poolAddress, uint256 _amount) external override {
    // FIXME: This doesnt guarantee that receiver is really a pool
    _requireCallerIsStabilityPoolManager();
    _transfer(_sender, _poolAddress, _amount);
  }

  function totalSupply() external view override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) external view override returns (uint256) {
    return _balances[account];
  }

  function transfer(address recipient, uint256 amount) external override returns (bool) {
    _requireValidRecipient(recipient);
    _transfer(msg.sender, recipient, amount);
    return true;
  }

  function allowance(address owner, address spender) external view override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) external override returns (bool) {
    _approve(msg.sender, spender, amount);
    return true;
  }

  function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
    _requireValidRecipient(recipient);
    _approve(sender, msg.sender, _allowances[sender][msg.sender] - amount);
    _transfer(sender, recipient, amount);
    return true;
  }

  function increaseAllowance(address spender, uint256 addedValue) external override returns (bool) {
    _approve(msg.sender, spender, _allowances[msg.sender][spender] + addedValue);
    return true;
  }

  function decreaseAllowance(address spender, uint256 subtractedValue) external override returns (bool) {
    _approve(msg.sender, spender, _allowances[msg.sender][spender] - subtractedValue);
    return true;
  }

  // --- EIP 2612 Functionality ---

  function domainSeparator() external view override returns (bytes32) {
    if (_chainID() == _CACHED_CHAIN_ID && keccak256(bytes(_NAME)) == _HASHED_NAME) {
      return _CACHED_DOMAIN_SEPARATOR;
    } else {
      return _buildDomainSeparator(_TYPE_HASH, keccak256(bytes(_NAME)), _HASHED_VERSION);
    }
  }

  function permit(
    address owner,
    address spender,
    uint amount,
    uint deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external override {
    if (deadline < block.timestamp) revert ExpiredDeadline();
    bytes32 digest = keccak256(
      abi.encodePacked(
        '\x19\x01',
        this.domainSeparator(),
        keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, amount, _nonces[owner]++, deadline))
      )
    );

    bytes32 signedMsg = MessageHashUtils.toEthSignedMessageHash(digest);
    address recoveredAddress = ECDSA.recover(signedMsg, v, r, s);
    if (recoveredAddress != owner) revert InvalidSignature();
    _approve(owner, spender, amount);
  }

  function nonces(address owner) external view override returns (uint256) {
    // FOR EIP 2612
    return _nonces[owner];
  }

  // --- Internal operations ---

  function _chainID() private view returns (uint256 chainID) {
    assembly {
      chainID := chainid()
    }
  }

  function _buildDomainSeparator(bytes32 typeHash, bytes32 newName, bytes32 newVersion) private view returns (bytes32) {
    return keccak256(abi.encode(typeHash, newName, newVersion, _chainID(), address(this)));
  }

  // --- Internal operations ---
  // Warning: sanity checks (for sender and recipient) should have been done before calling these internal functions
  function _transfer(address sender, address recipient, uint256 amount) internal {
    assert(sender != address(0));
    if (_balances[sender] < amount) revert InsufficientBalance();

    _balances[sender] -= amount;
    _balances[recipient] += amount;
    emit Transfer(sender, recipient, amount);
  }

  function _mint(address account, uint256 amount) internal {
    assert(account != address(0));

    _totalSupply += amount;
    _balances[account] += amount;
    emit Transfer(address(0), account, amount);
  }

  function _burn(address account, uint256 amount) internal {
    assert(account != address(0));

    _balances[account] -= amount;
    _totalSupply -= amount;
    emit Transfer(account, address(0), amount);
  }

  function _approve(address owner, address spender, uint256 amount) internal {
    assert(owner != address(0));
    assert(spender != address(0));

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }

  // --- 'require' functions ---

  function _requireCallerIsPriceFeed() internal view {
    if (msg.sender != priceFeedAddress) revert NotFromPriceFeed();
  }

  function _requireValidRecipient(address _recipient) internal view {
    if (_recipient == address(0) || _recipient == address(this)) revert ZeroAddress();
    if (
      _recipient == stabilityPoolManagerAddress ||
      _recipient == troveManagerAddress ||
      _recipient == borrowerOperationsAddress
    ) revert NotAllowedDirectTransfer();
  }

  function _requireCallerIsBorrowerOperationsOrTroveManager() internal view {
    if (msg.sender != borrowerOperationsAddress && msg.sender != troveManagerAddress) revert NotFromBorrowerOps();
  }

  function _requireMintingEnabled() internal view {
    if (!tokenManager.enableMinting()) revert MintingDisabled();
  }

  function _requireCallerIsStabilityPoolManager() internal view {
    if (msg.sender != stabilityPoolManagerAddress) revert NotFromSPManager();
  }

  function _requireCallerIsDebtTokenManager() internal view {
    if (msg.sender != address(tokenManager)) revert NotFromDTManager();
  }

  // --- Optional functions ---

  function name() external view override returns (string memory) {
    return _NAME;
  }

  function symbol() external view override returns (string memory) {
    return _SYMBOL;
  }

  function decimals() external pure override returns (uint8) {
    return _DECIMALS;
  }

  function version() external view override returns (string memory) {
    return _VERSION;
  }

  function permitTypeHash() external pure override returns (bytes32) {
    return _PERMIT_TYPEHASH;
  }
}
