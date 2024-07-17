import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { EIP712, MockDebtToken, MockERC20, MockERC20__factory, MockDebtToken__factory } from '../typechain';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { AddressLike, ContractTransactionResponse } from 'ethers';
import { parseUnits } from 'ethers';
import { AddressZero } from '@ethersproject/constants';
import deployTestBase, { Contracts } from './deployTestBase';
import { generatePriceUpdateDataWithFee, setPrice as setPythPrice, updateOracle } from './pythHelper';
import { DeployHelper } from '@moonlabs/solidity-scripts/deployHelpers';
import { deployMockDebtsAndColls } from '../deploy/modules/core';

export const MAX_BORROWING_FEE = parseUnits('0.05');

export const PermitTypes = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

export async function deployTestMockDebtsAndColls(contracts: Contracts, collTokens: number, debtTokens: number) {
  // deploy helper
  const deploy = new DeployHelper();
  deploy.silent = true;
  await deploy.init();

  const alreadyExistingColls = await contracts.tokenManager.getCollTokenAddresses();
  const alreadyExistingDebts = await contracts.tokenManager.getDebtTokenAddresses();
  const { colls, debts } = await deployMockDebtsAndColls(
    deploy,
    contracts as any,
    collTokens - alreadyExistingColls.length,
    debtTokens - alreadyExistingDebts.length
  );

  const from = (await ethers.getSigners())[0];
  alreadyExistingColls.forEach(address => {
    if (colls.some(_c => _c.target === address)) return;
    colls.push(new ethers.Contract(address, MockERC20__factory.abi, from));
  });
  alreadyExistingDebts.forEach(address => {
    if (debts.some(_d => _d.target === address)) return;
    debts.push(new ethers.Contract(address, MockDebtToken__factory.abi, from));
  });

  return { colls, debts };
}

export async function deployTesting(deployTokensExceptStableAndGov: boolean = true) {
  return deployTestBase(deployTokensExceptStableAndGov);
}

export const getDomain = async (token: EIP712) => {
  const domain = await token.eip712Domain();
  return {
    chainId: domain.chainId,
    name: domain.name,
    verifyingContract: domain.verifyingContract,
    version: domain.version,
  };
};

export function createTokenAmountList(tokens: MockERC20[] | MockDebtToken[], tokenCount: number, amountFn: any) {
  return tokens
    .slice(0, tokenCount)
    .map(tokenAddress => ({ tokenAddress, amount: amountFn(tokenAddress) }))
    .filter(({ amount }) => amount > 0);
}

export const setPrice = async (tokenLabel: string, price: string, contracts: Contracts) => {
  await setPythPrice(tokenLabel, parseFloat(price));
  await updateOracle(contracts);
};

export const openTrove = async ({
  from,
  contracts,
  colls,
  debts,
}: {
  from: SignerWithAddress;
  contracts: Contracts;
  colls: any[];
  debts?: any[];
}) => {
  for (const { tokenAddress, amount } of colls) {
    await tokenAddress.unprotectedMint(from, amount);
    await tokenAddress.connect(from).approve(contracts.borrowerOperations, amount);
  }

  const od = await generatePriceUpdateDataWithFee(contracts);
  const openTx = await contracts.borrowerOperations.connect(from).openTrove(colls, od.data, { value: od.fee });
  if (debts) await increaseDebt(from, contracts, debts);
  return openTx;
};

export const addColl = async (from: SignerWithAddress, contracts: Contracts, colls: any[], approve = false) => {
  if (approve)
    for (const { tokenAddress, amount } of colls) {
      await tokenAddress.unprotectedMint(from, amount);
      await tokenAddress.connect(from).approve(contracts.borrowerOperations, amount);
    }

  const afterPathCR = await contracts.hintHelpers.getICRIncludingPatch(from, colls, [], [], []);
  const [upperHint, lowerHint] = await getHints(contracts, afterPathCR);
  const od = await generatePriceUpdateDataWithFee(contracts);
  return contracts.borrowerOperations.connect(from).addColl(colls, upperHint, lowerHint, od.data, { value: od.fee });
};

export const withdrawalColl = async (from: SignerWithAddress, contracts: Contracts, colls: any[]) => {
  const afterPathCR = await contracts.hintHelpers.getICRIncludingPatch(from, [], colls, [], []);
  const [upperHint, lowerHint] = await getHints(contracts, afterPathCR);
  const od = await generatePriceUpdateDataWithFee(contracts);
  return contracts.borrowerOperations
    .connect(from)
    .withdrawColl(colls, upperHint, lowerHint, od.data, { value: od.fee });
};

export const increaseDebt = async (
  from: SignerWithAddress,
  contracts: Contracts,
  debts: any[],
  maxFeePercentage = MAX_BORROWING_FEE,
  priceDataUpdateOffset: number = 0,
  offsetToken?: string
) => {
  const afterPathCR = await contracts.hintHelpers.getICRIncludingPatch(from, [], [], debts, []);
  const [upperHint, lowerHint] = await getHints(contracts, afterPathCR);
  const od = await generatePriceUpdateDataWithFee(contracts, priceDataUpdateOffset, offsetToken);
  return {
    tx: await contracts.borrowerOperations
      .connect(from)
      .increaseDebts(debts, { upperHint, lowerHint, maxFeePercentage }, od.data, { value: od.fee }),
  };
};

export const repayDebt = async (from: SignerWithAddress, contracts: Contracts, debts: any[]) => {
  const afterPathCR = await contracts.hintHelpers.getICRIncludingPatch(from, [], [], [], debts);
  const [upperHint, lowerHint] = await getHints(contracts, afterPathCR);
  const od = await generatePriceUpdateDataWithFee(contracts);
  return {
    tx: await contracts.borrowerOperations
      .connect(from)
      .repayDebt(debts, upperHint, lowerHint, od.data, { value: od.fee }),
  };
};

export const liquidate = async (user: SignerWithAddress, contracts: Contracts) => {
  const od = await generatePriceUpdateDataWithFee(contracts);
  return await contracts.liquidationOperations.liquidate(user, od.data, { value: od.fee });
};

export const closeTrove = async (user: SignerWithAddress, contracts: Contracts) => {
  const od = await generatePriceUpdateDataWithFee(contracts);
  return await contracts.borrowerOperations.connect(user).closeTrove(od.data, { value: od.fee });
};

export const batchLiquidate = async (users: SignerWithAddress[], contracts: Contracts) => {
  const od = await generatePriceUpdateDataWithFee(contracts);
  return await contracts.liquidationOperations.batchLiquidateTroves(users, od.data, { value: od.fee });
};

export const redeem = async (
  from: SignerWithAddress,
  toRedeem: bigint,
  contracts: Contracts,
  maxFeePercentage = MAX_BORROWING_FEE
) => {
  const amountStableTroves = await contracts.sortedTroves.getSize();
  const iterations = await contracts.hintHelpers.getRedemptionIterationHints(
    toRedeem,
    Math.round(Math.min(4000, 15 * Math.sqrt(Number(amountStableTroves)))),
    Math.round(Math.random() * 100000000000)
  );
  const od = await generatePriceUpdateDataWithFee(contracts);
  return contracts.redemptionOperations.connect(from).redeemCollateral(
    toRedeem,
    iterations.map((i: any[]) => ({ trove: i[0], upperHint: i[1], lowerHint: i[2], expectedCR: i[3] })),
    maxFeePercentage,
    od.data,
    { value: od.fee }
  );
};

export async function getHints(contracts: Contracts, cr: bigint) {
  let hint;
  const amountStableTroves = await contracts.sortedTroves.getSize();
  if (amountStableTroves === 0n) hint = AddressZero;
  else {
    const [_hint] = await contracts.hintHelpers.getApproxHint(
      cr,
      Math.round(Math.min(4000, 15 * Math.sqrt(Number(amountStableTroves)))),
      Math.round(Math.random() * 100000000000)
    );
    hint = _hint;
  }

  return contracts.sortedTroves.findInsertPosition(cr, hint, hint);
}

/**
 * asserts that a transaction fails and is reverted. Part of the error message can be asserted.
 *
 * @param txPromise transaction that should be reverted
 * @param message part of the revert message that should be included. Usually the custom error of the contract.
 */
export const assertRevert = async (txPromise: Promise<ContractTransactionResponse>, message?: string) => {
  try {
    const tx = await txPromise;
    const receipt = await tx.wait();
    expect(receipt?.status).to.be.equal(0);
  } catch (err: any) {
    expect(err.message).include('revert');
    if (message) expect(err.message).include(message);
  }
};

export const gasUsed = async (tx: ContractTransactionResponse) => {
  const receipt = await tx.wait();
  return BigInt(receipt?.cumulativeGasUsed ?? 0) * BigInt(receipt?.gasPrice ?? 0);
};

export const whaleShrimpTroveInit = async (
  contracts: Contracts,
  signers: SignerWithAddress[],
  debtToken: MockDebtToken = contracts.STABLE
) => {
  const BTC: MockERC20 = contracts.BTC;

  let defaulter_1: SignerWithAddress;
  let defaulter_2: SignerWithAddress;
  let whale: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let dennis: SignerWithAddress;
  [, defaulter_1, defaulter_2, , whale, alice, bob, carol, dennis] = signers;

  await openTrove({
    from: whale,
    contracts,
    colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
    debts: [{ tokenAddress: debtToken, amount: parseUnits('1850') }],
  });

  // A, B, C open troves and make Stability Pool deposits
  await openTrove({
    from: alice,
    contracts,
    colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
    debts: [{ tokenAddress: debtToken, amount: parseUnits('1000') }],
  });
  await openTrove({
    from: bob,
    contracts,
    colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
    debts: [{ tokenAddress: debtToken, amount: parseUnits('2000') }],
  });
  await openTrove({
    from: carol,
    contracts,
    colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
    debts: [{ tokenAddress: debtToken, amount: parseUnits('3000') }],
  });

  // D opens a trove
  await openTrove({
    from: dennis,
    contracts,
    colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
    debts: [{ tokenAddress: debtToken, amount: parseUnits('300') }],
  });

  // Would-be defaulters open troves
  await openTrove({
    from: defaulter_1,
    contracts,
    colls: [{ tokenAddress: BTC, amount: parseUnits('0.02', 8) }],
    debts: [{ tokenAddress: debtToken, amount: parseUnits('100') }],
  });
  await openTrove({
    from: defaulter_2,
    contracts,
    colls: [{ tokenAddress: BTC, amount: parseUnits('0.02', 8) }],
    debts: [{ tokenAddress: debtToken, amount: parseUnits('100') }],
  });
};

export const buildPriceCache = async (contracts: Contracts) => {
  const priceCache = await contracts.priceFeed.buildPriceCache(false);
  return {
    collPrices: priceCache[0].map(a => ({
      tokenAddress: a[0],
      tokenDecimals: a[1],
      price: a[2],
      isPriceTrusted: a[3],
      isPrimary: a[4],
      supportedCollateralRatio: a[5],
    })),
    debtPrices: priceCache[1].map(a => ({
      tokenAddress: a[0],
      tokenDecimals: a[1],
      price: a[2],
      isPriceTrusted: a[3],
      isPrimary: a[4],
      supportedCollateralRatio: a[5],
    })),
  };
};

export const getTroveEntireColl = async (contracts: Contracts, trove: SignerWithAddress) => {
  return (await contracts.hintHelpers['getCurrentICR(address)'](trove)).currentCollInUSD;
};

export const getTroveEntireDebt = async (contracts: Contracts, trove: SignerWithAddress) => {
  return (await contracts.hintHelpers['getCurrentICR(address)'](trove)).currentDebtInUSD;
};

export const getTroveStake = async (contracts: Contracts, trove: SignerWithAddress, token: AddressLike) => {
  return await contracts.troveManager.getTroveStakes(trove, token);
};

export const checkRecoveryMode = async (contracts: Contracts) => {
  return (await contracts.storagePool.checkRecoveryMode()).isInRecoveryMode;
};

export const getTCR = async (contracts: Contracts) => {
  return (await contracts.storagePool.checkRecoveryMode()).TCR;
};

export const fastForwardTime = (seconds: number) => time.increase(seconds);
export const getLatestBlockTimestamp = () => time.latest();

export const getEmittedLiquidationValues = async (
  liquidationTx: ContractTransactionResponse | null,
  contracts: Contracts
) => {
  const receipt = await liquidationTx?.wait();
  for (const log of receipt?.logs ?? []) {
    const logData = contracts.liquidationOperations.interface.parseLog(log as any);
    if (logData?.name !== 'LiquidationSummary') continue;

    const liquidatedDebt = logData.args[0];
    const liquidatedColl = logData.args[1];
    const collGasComp = logData.args[2];
    return [liquidatedDebt, liquidatedColl, collGasComp];
  }
  return [];
};

export const getStableFeeFromStableBorrowingEvent = async (
  tx: ContractTransactionResponse | null,
  contracts: Contracts
) => {
  const receipt = await tx?.wait();
  for (const log of receipt?.logs ?? []) {
    const logData = contracts.borrowerOperations.interface.parseLog(log as any);
    if (logData?.name === 'PaidBorrowingFee') return logData.args[1];
  }
  return 0n;
};

export const getRedemptionMeta = async (tx: ContractTransactionResponse | null, contracts: Contracts) => {
  const receipt = await tx?.wait();

  const meta: { redemptions: any[]; totals: any[] } = { redemptions: [], totals: [] };
  for (const log of receipt?.logs ?? []) {
    const logData = contracts.redemptionOperations.interface.parseLog(log as any);
    if (logData?.name === 'SuccessfulRedemption') meta.totals = logData.args;
    else if (logData?.name === 'RedeemedFromTrove') meta.redemptions.push(logData.args);
  }
  return meta;
};

export async function createPoolPair(
  contracts: Contracts,
  tokenA: MockDebtToken | MockERC20,
  tokenB: MockDebtToken | MockERC20
) {
  const pairFactory = await ethers.getContractFactory('SwapPair');
  const pair = await pairFactory.deploy(contracts.swapOperations.target);
  await pair.waitForDeployment();

  return contracts.swapOperations.createPair(pair.target, tokenA, tokenB);
}

export const TimeValues = {
  SECONDS_IN_ONE_MINUTE: 60,
  SECONDS_IN_ONE_HOUR: 60 * 60,
  SECONDS_IN_ONE_DAY: 60 * 60 * 24,
  SECONDS_IN_ONE_WEEK: 60 * 60 * 24 * 7,
  SECONDS_IN_SIX_WEEKS: 60 * 60 * 24 * 7 * 6,
  SECONDS_IN_ONE_MONTH: 60 * 60 * 24 * 30,
  SECONDS_IN_ONE_YEAR: 60 * 60 * 24 * 365,
  MINUTES_IN_ONE_WEEK: 60 * 24 * 7,
  MINUTES_IN_ONE_MONTH: 60 * 24 * 30,
  MINUTES_IN_ONE_YEAR: 60 * 24 * 365,
};

//added trove status
export const TroveStatus = {
  NON_EXISTENT: 0,
  ACTIVE: 1,
  CLOSED_BY_OWNER: 2,
  CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE: 3,
  CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE: 4,
};

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
