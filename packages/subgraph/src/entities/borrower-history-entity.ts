import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import { BorrowerHistory, SystemInfo, TokenAmount } from '../../generated/schema';
import { oneEther } from './token-candle-entity';
// import { log } from '@graphprotocol/graph-ts';

export function handleCreateBorrowerHistory(
  event: ethereum.Event,
  poolAddress: Address,
  borrower: Address,
  // DEPOSITED | WITHDRAWN | CLAIMED_REWARDS
  type: string,
  tokenAddressesLost: Address[],
  /**
   * Should always be negative
   */
  tokenAmountsLost: BigInt[],
  tokenAddressesGained: Address[],
  tokenAmountsGained: BigInt[],
): void {
  const borrowerHistoryEntity = new BorrowerHistory(event.transaction.hash.concatI32(event.logIndex.toI32()));
  const systemInfo = SystemInfo.load(`SystemInfo`)!;

  borrowerHistoryEntity.pool = poolAddress;
  borrowerHistoryEntity.borrower = borrower;
  borrowerHistoryEntity.timestamp = event.block.timestamp;

  const operationValuesLost: Bytes[] = [];
  // only used in CLAIMED_REWARDS
  let allLostDepositsUSD = BigInt.fromI32(0);

  for (let i = 0; i < tokenAddressesLost.length; i++) {
    const tokenAddress = tokenAddressesLost[i];
    const operationValue = new TokenAmount(
      event.transaction.hash.concatI32(event.logIndex.toI32()).concat(tokenAddress),
    );

    operationValue.token = tokenAddress;
    operationValue.amount = tokenAmountsLost[i];
    operationValue.save();

    operationValuesLost.push(operationValue.id);

    if (type === 'CLAIMED_REWARDS') {
      const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
      const tokenPrice = priceFeedContract.getPrice(tokenAddress).getPrice();
      allLostDepositsUSD = allLostDepositsUSD.plus(tokenPrice.times(operationValue.amount).div(oneEther));
    }
  }

  const operationValuesGained: Bytes[] = [];
  // only used in CLAIMED_REWARDS
  let allRewardsUSD = BigInt.fromI32(0);

  for (let i = 0; i < tokenAddressesGained.length; i++) {
    const tokenAddress = tokenAddressesGained[i];
    const operationValue = new TokenAmount(
      event.transaction.hash.concatI32(event.logIndex.toI32()).concat(tokenAddress),
    );

    operationValue.token = tokenAddress;
    operationValue.amount = tokenAmountsGained[i];
    operationValue.save();

    operationValuesGained.push(operationValue.id);

    if (type === 'CLAIMED_REWARDS') {
      const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
      const tokenPrice = priceFeedContract.getPrice(tokenAddress).getPrice();
      allRewardsUSD = allRewardsUSD.plus(tokenPrice.times(operationValue.amount).div(oneEther));
    }
  }

  borrowerHistoryEntity.values = operationValuesLost.concat(operationValuesGained);
  borrowerHistoryEntity.type = type;

  if (type === 'CLAIMED_REWARDS') {
    borrowerHistoryEntity.claimInUSD = allRewardsUSD;
    borrowerHistoryEntity.lostDepositInUSD = allLostDepositsUSD;
  }

  borrowerHistoryEntity.save();
}
