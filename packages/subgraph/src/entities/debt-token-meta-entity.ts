import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import {
  DebtTokenMeta,
  SystemInfo,
  TotalReserveAverage,
  TotalReserveAverageChunk,
  TotalSupplyAverage,
  TotalSupplyAverageChunk,
} from '../../generated/schema';
import { DebtToken } from '../../generated/templates/DebtTokenTemplate/DebtToken';
import { oneEther } from './token-candle-entity';

export function handleCreateUpdateDebtTokenMeta(
  event: ethereum.Event,
  tokenAddress: Address,
  totalReserve: BigInt | null = null,
): void {
  let debtTokenMeta = DebtTokenMeta.load(`DebtTokenMeta-${tokenAddress.toHexString()}`);
  const systemInfo = SystemInfo.load(`SystemInfo`)!;

  if (debtTokenMeta === null) {
    debtTokenMeta = new DebtTokenMeta(`DebtTokenMeta-${tokenAddress.toHexString()}`);
    createDebtTokenMeta_stabilityDepositAPY_totalReserve30dAverage_totalSupply30dAverage(event, tokenAddress);
  }

  const tokenContract = DebtToken.bind(tokenAddress);

  debtTokenMeta.token = tokenAddress;
  debtTokenMeta.timestamp = event.block.timestamp;

  const totalSupply = tokenContract.totalSupply();
  const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
  const tokenPrice = priceFeedContract.getPrice(tokenAddress).getPrice();

  debtTokenMeta.totalSupplyUSD = totalSupply.times(tokenPrice).div(oneEther);

  const stableCoin = Address.fromBytes(systemInfo.stableCoin);

  if (tokenAddress == stableCoin) {
    if (totalReserve === null) {
      debtTokenMeta.totalReserve = tokenContract.balanceOf(Address.fromBytes(systemInfo.reservePool));
    } else {
      debtTokenMeta.totalReserve = totalReserve;
    }
  } else {
    debtTokenMeta.totalReserve = BigInt.fromI32(0);
  }

  // Just link average but update them atomically.
  debtTokenMeta.totalSupplyUSD30dAverage = `TotalSupplyAverage-${tokenAddress.toHexString()}`;

  if (tokenAddress == stableCoin) {
    debtTokenMeta.totalReserve30dAverage = `TotalReserveAverage-${tokenAddress.toHexString()}`;
  }

  debtTokenMeta.save();
}

function createDebtTokenMeta_stabilityDepositAPY_totalReserve30dAverage_totalSupply30dAverage(
  event: ethereum.Event,
  tokenAddress: Address,
): void {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin);

  // Only Stable has a reserve
  if (tokenAddress == stableCoin) {
    const totalReserveAverage = new TotalReserveAverage(`TotalReserveAverage-${tokenAddress.toHexString()}`);
    totalReserveAverage.value = BigInt.fromI32(0);
    totalReserveAverage.index = 1;
    totalReserveAverage.save();

    // "TotalReserveAverageChunk" + token + index
    const totalReserveAverageFirstChunk = new TotalReserveAverageChunk(
      `TotalReserveAverageChunk-${tokenAddress.toHexString()}-1`,
    );
    totalReserveAverageFirstChunk.timestamp = event.block.timestamp;
    totalReserveAverageFirstChunk.value = BigInt.fromI32(0);
    totalReserveAverageFirstChunk.save();
  }

  const totalSupplyAverage = new TotalSupplyAverage(`TotalSupplyAverage-${tokenAddress.toHexString()}`);
  totalSupplyAverage.value = BigInt.fromI32(0);
  totalSupplyAverage.index = 1;
  totalSupplyAverage.save();

  // "TotalSupplyAverageChunk" + token + index
  const totalSupplyAverageFirstChunk = new TotalSupplyAverageChunk(
    `TotalSupplyAverageChunk-${tokenAddress.toHexString()}-1`,
  );
  totalSupplyAverageFirstChunk.timestamp = event.block.timestamp;
  totalSupplyAverageFirstChunk.value = BigInt.fromI32(0);
  totalSupplyAverageFirstChunk.save();
}

export const handleUpdateDebtTokenMeta_totalReserve30dAverage = (
  event: ethereum.Event,
  tokenAddress: Address,
  totalReserve: BigInt,
): void => {
  // Load Average or initialize it
  const totalReserveAverage = TotalReserveAverage.load(`TotalReserveAverage-${tokenAddress.toHexString()}`)!;

  //  Add additional chunks the average has not been recalculated in the last 60 mins with last value (because there has been no update).
  let lastChunk = TotalReserveAverageChunk.load(
    `TotalReserveAverageChunk-${tokenAddress.toHexString()}-${totalReserveAverage.index.toString()}`,
  )!;
  let moreThanOneChunkOutdated = lastChunk.timestamp.lt(event.block.timestamp.minus(BigInt.fromI32(2 * 60 * 60)));

  while (moreThanOneChunkOutdated) {
    totalReserveAverage.index = totalReserveAverage.index + 1;
    const totalReserveAverageNewChunk = new TotalReserveAverageChunk(
      `TotalReserveAverageChunk-${tokenAddress.toHexString()}-${totalReserveAverage.index.toString()}`,
    );
    totalReserveAverageNewChunk.timestamp = lastChunk.timestamp.plus(BigInt.fromI32(60 * 60));
    totalReserveAverageNewChunk.value = lastChunk.value;
    totalReserveAverageNewChunk.save();

    lastChunk = totalReserveAverageNewChunk;
    moreThanOneChunkOutdated = lastChunk.timestamp.lt(event.block.timestamp.minus(BigInt.fromI32(2 * 60 * 60)));
  }

  // Add to the last chunk.
  if (lastChunk.timestamp.le(event.block.timestamp.minus(BigInt.fromI32(60 * 60)))) {
    // Add a new chunk anyway
    totalReserveAverage.index = totalReserveAverage.index + 1;

    const totalReserveAverageNewChunk = new TotalReserveAverageChunk(
      `TotalReserveAverageChunk-${tokenAddress.toHexString()}-${totalReserveAverage.index.toString()}`,
    );
    totalReserveAverageNewChunk.timestamp = lastChunk.timestamp.plus(BigInt.fromI32(60 * 60));
    totalReserveAverageNewChunk.value = totalReserve;
    totalReserveAverageNewChunk.save();
    // recalculate average based on if its the first 30 days or not
    if (totalReserveAverage.index <= 24 * 30) {
      totalReserveAverage.value = totalReserveAverage.value
        .times(BigInt.fromI32(totalReserveAverage.index - 1))
        .plus(totalReserveAverageNewChunk.value)
        .div(BigInt.fromI32(totalReserveAverage.index));
    } else {
      const outdatedChunk = TotalReserveAverageChunk.load(
        `TotalReserveAverageChunk-${tokenAddress.toHexString()}-${(totalReserveAverage.index - 30 * 24).toString()}`,
      )!;
      // Otherwise remove last chunk and add new chunk and recalculate average
      const dividedByChunks = BigInt.fromI32(30 * 24);
      totalReserveAverage.value = totalReserveAverage.value
        .plus(totalReserveAverageNewChunk.value.div(dividedByChunks))
        .minus(outdatedChunk.value.div(dividedByChunks));
    }
  } else {
    // Update the average
    totalReserveAverage.value = totalReserveAverage.value
      .minus(
        lastChunk.value.div(BigInt.fromI32(totalReserveAverage.index < 24 * 30 ? totalReserveAverage.index : 30 * 24)),
      )
      .plus(
        totalReserve.div(BigInt.fromI32(totalReserveAverage.index < 24 * 30 ? totalReserveAverage.index : 30 * 24)),
      );
    // Update the last chunk
    lastChunk.value = totalReserve;
    lastChunk.save();
  }

  totalReserveAverage.save();
};

export const handleUpdateDebtTokenMeta_totalSupplyUSD30dAverage = (
  event: ethereum.Event,
  tokenAddress: Address,
): void => {
  const debtTokenContract = DebtToken.bind(tokenAddress);
  const totalSupply = debtTokenContract.totalSupply();

  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
  const tokenPrice = priceFeedContract.getPrice(tokenAddress).getPrice();

  const totalSupplyUSD = totalSupply.times(tokenPrice).div(oneEther);

  // Load Average or initialize it
  const totalSupplyAverage = TotalSupplyAverage.load(`TotalSupplyAverage-${tokenAddress.toHexString()}`)!;

  //  Add additional chunks the average has not been recalculated in the last 60 mins with last value (because there has been no update).
  let lastChunk = TotalSupplyAverageChunk.load(
    `TotalSupplyAverageChunk-${tokenAddress.toHexString()}-${totalSupplyAverage.index.toString()}`,
  )!;
  let moreThanOneChunkOutdated = lastChunk.timestamp.lt(event.block.timestamp.minus(BigInt.fromI32(2 * 60 * 60)));

  // TODO: Still must test this!
  while (moreThanOneChunkOutdated) {
    totalSupplyAverage.index = totalSupplyAverage.index + 1;
    const totalSupplyAverageNewChunk = new TotalSupplyAverageChunk(
      `TotalSupplyAverageChunk-${tokenAddress.toHexString()}-${totalSupplyAverage.index.toString()}`,
    );
    totalSupplyAverageNewChunk.timestamp = lastChunk.timestamp.plus(BigInt.fromI32(60 * 60));
    totalSupplyAverageNewChunk.value = lastChunk.value;
    totalSupplyAverageNewChunk.save();

    lastChunk = totalSupplyAverageNewChunk;
    moreThanOneChunkOutdated = lastChunk.timestamp.lt(event.block.timestamp.minus(BigInt.fromI32(2 * 60 * 60)));
  }

  // Add the last chunk.
  if (lastChunk.timestamp.le(event.block.timestamp.minus(BigInt.fromI32(60 * 60)))) {
    // Add a new chunk anyway
    totalSupplyAverage.index = totalSupplyAverage.index + 1;

    const totalSupplyAverageNewChunk = new TotalSupplyAverageChunk(
      `TotalSupplyAverageChunk-${tokenAddress.toHexString()}-${totalSupplyAverage.index.toString()}`,
    );
    totalSupplyAverageNewChunk.timestamp = lastChunk.timestamp.plus(BigInt.fromI32(60 * 60));
    totalSupplyAverageNewChunk.value = totalSupplyUSD;
    totalSupplyAverageNewChunk.save();

    // recalculate average based on if its the first 30 days or not
    if (totalSupplyAverage.index <= 24 * 30) {
      totalSupplyAverage.value = totalSupplyAverage.value
        .times(BigInt.fromI32(totalSupplyAverage.index - 1))
        .plus(totalSupplyAverageNewChunk.value)
        .div(BigInt.fromI32(totalSupplyAverage.index));
    } else {
      const outdatedChunk = TotalSupplyAverageChunk.load(
        `TotalSupplyAverageChunk-${tokenAddress.toHexString()}-${(totalSupplyAverage.index - 30 * 24).toString()}`,
      )!;
      // Otherwise remove last chunk and add new chunk and recalculate average
      const dividedByChunks = BigInt.fromI32(30 * 24);
      totalSupplyAverage.value = totalSupplyAverage.value
        .plus(totalSupplyAverageNewChunk.value.div(dividedByChunks))
        .minus(outdatedChunk.value.div(dividedByChunks));
    }
  } else {
    // Update the average
    totalSupplyAverage.value = totalSupplyAverage.value
      .minus(
        lastChunk.value.div(BigInt.fromI32(totalSupplyAverage.index < 24 * 30 ? totalSupplyAverage.index : 30 * 24)),
      )
      .plus(
        totalSupplyUSD.div(BigInt.fromI32(totalSupplyAverage.index < 24 * 30 ? totalSupplyAverage.index : 30 * 24)),
      );
    // Update the last chunk
    lastChunk.value = totalSupplyUSD;
    lastChunk.save();
  }

  totalSupplyAverage.save();
};
