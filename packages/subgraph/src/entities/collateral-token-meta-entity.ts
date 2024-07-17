import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import { ReservePool } from '../../generated/ReservePool/ReservePool';
import { StoragePool } from '../../generated/StoragePool/StoragePool';
import {
  CollateralTokenMeta,
  SystemInfo,
  Token,
  TotalReserveAverage,
  TotalReserveAverageChunk,
  TotalValueLockedAverage,
  TotalValueLockedChunk,
} from '../../generated/schema';
import { bigIntWithZeros } from './token-candle-entity';
// import { log } from '@graphprotocol/graph-ts';

export function handleCreateUpdateCollateralTokenMeta(
  event: ethereum.Event,
  tokenAddress: Address,
  govReserve: BigInt | null = null,
  supportedCollateralRatio: BigInt | null = null,
): void {
  let collateralTokenMeta = CollateralTokenMeta.load(`CollateralTokenMeta-${tokenAddress.toHexString()}`);
  if (collateralTokenMeta === null) {
    collateralTokenMeta = new CollateralTokenMeta(`CollateralTokenMeta-${tokenAddress.toHexString()}`);
    createCollateralTokenMeta_totalReserve30dAverage(event, tokenAddress);
    handleCreateCollateralTokenMeta_totalValueLockedUSD30dAverage(event, tokenAddress);
  }

  if (!supportedCollateralRatio && !collateralTokenMeta.supportedCollateralRatio) {
    collateralTokenMeta.supportedCollateralRatio = BigInt.fromI32(0);
  }
  // Only when initialized set it to any value in case of race condition
  else if (supportedCollateralRatio !== null) {
    collateralTokenMeta.supportedCollateralRatio = supportedCollateralRatio;
  }

  collateralTokenMeta.token = tokenAddress;
  collateralTokenMeta.timestamp = event.block.timestamp;

  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const storagePoolContract = StoragePool.bind(Address.fromBytes(systemInfo.storagePool));
  const govToken = Address.fromBytes(systemInfo.govToken);

  if (tokenAddress == govToken) {
    const reservePoolContract = ReservePool.bind(Address.fromBytes(systemInfo.reservePool));

    if (govReserve === null) {
      const try_govReserveCap = reservePoolContract.try_govReserveCap();
      collateralTokenMeta.totalReserve = try_govReserveCap.reverted ? BigInt.fromI32(0) : try_govReserveCap.value;
    } else {
      collateralTokenMeta.totalReserve = govReserve;
    }
    collateralTokenMeta.totalReserve30dAverage = `TotalReserveAverage-${tokenAddress.toHexString()}`;
  } else {
    collateralTokenMeta.totalReserve = BigInt.fromI32(0);
  }

  // FIXME: Should not be optional but coll Token only exists in storage pool after trove has been opened.
  const tryTotalAmount = storagePoolContract.try_getTokenTotalAmount(tokenAddress, true);

  if (tryTotalAmount.reverted) {
    collateralTokenMeta.totalValueLockedUSD = BigInt.fromI32(0);
  } else {
    const token = Token.load(tokenAddress)!;
    const tokenDecimalDivisor = bigIntWithZeros(token.decimals);

    const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
    const tokenPrice = priceFeedContract.getPrice(tokenAddress).getPrice();
    collateralTokenMeta.totalValueLockedUSD = tokenPrice.times(tryTotalAmount.value).div(tokenDecimalDivisor);
  }

  collateralTokenMeta.totalValueLockedUSD30dAverage = `TotalValueLockedAverage-${tokenAddress.toHexString()}`;
  collateralTokenMeta.save();
}

export const handleCreateCollateralTokenMeta_totalValueLockedUSD30dAverage = (
  event: ethereum.Event,
  tokenAddress: Address,
): void => {
  const tvlAverage = new TotalValueLockedAverage(`TotalValueLockedAverage-${tokenAddress.toHexString()}`);
  tvlAverage.value = BigInt.fromI32(0);
  tvlAverage.index = 1;
  tvlAverage.save();

  // "TotalValueLockedChunk" + token + index
  const tvlAverageFirstChunk = new TotalValueLockedChunk(`TotalValueLockedChunk-${tokenAddress.toHexString()}-1`);
  tvlAverageFirstChunk.timestamp = event.block.timestamp;
  tvlAverageFirstChunk.value = BigInt.fromI32(0);
  tvlAverageFirstChunk.save();
};

export const handleUpdateCollateralTokenMeta_totalValueLockedUSD30dAverage = (
  event: ethereum.Event,
  tokenAddress: Address,
  collateralTokenMeta: CollateralTokenMeta | null = null,
): void => {
  if (collateralTokenMeta === null) {
    collateralTokenMeta = CollateralTokenMeta.load(`CollateralTokenMeta-${tokenAddress.toHexString()}`)!;
  }

  // Load Average or initialize it
  const tvlAverage = TotalValueLockedAverage.load(`TotalValueLockedAverage-${tokenAddress.toHexString()}`)!;
  //  Add additional chunks the average has not been recalculated in the last 60 mins with last value (because there has been no update).
  let lastChunk = TotalValueLockedChunk.load(
    `TotalValueLockedChunk-${tokenAddress.toHexString()}-${tvlAverage.index.toString()}`,
  )!;
  let moreThanOneChunkOutdated = lastChunk.timestamp.lt(event.block.timestamp.minus(BigInt.fromI32(2 * 60 * 60)));
  while (moreThanOneChunkOutdated) {
    tvlAverage.index = tvlAverage.index + 1;
    const tvlAverageNewChunk = new TotalValueLockedChunk(
      `TotalValueLockedChunk-${tokenAddress.toHexString()}-${tvlAverage.index.toString()}`,
    );
    tvlAverageNewChunk.timestamp = lastChunk.timestamp.plus(BigInt.fromI32(60 * 60));
    tvlAverageNewChunk.value = lastChunk.value;
    tvlAverageNewChunk.save();

    lastChunk = tvlAverageNewChunk;
    moreThanOneChunkOutdated = lastChunk.timestamp.lt(event.block.timestamp.minus(BigInt.fromI32(2 * 60 * 60)));
  }

  // Add to the last chunk.
  if (lastChunk.timestamp.le(event.block.timestamp.minus(BigInt.fromI32(60 * 60)))) {
    // Add a new chunk anyway
    tvlAverage.index = tvlAverage.index + 1;

    const tvlAverageNewChunk = new TotalValueLockedChunk(
      `TotalValueLockedChunk-${tokenAddress.toHexString()}-${tvlAverage.index.toString()}`,
    );
    tvlAverageNewChunk.timestamp = lastChunk.timestamp.plus(BigInt.fromI32(60 * 60));
    tvlAverageNewChunk.value = collateralTokenMeta.totalValueLockedUSD;
    tvlAverageNewChunk.save();

    // recalculate average based on if its the first 30 days or not
    if (tvlAverage.index <= 24 * 30) {
      tvlAverage.value = tvlAverage.value
        .times(BigInt.fromI32(tvlAverage.index - 1))
        .plus(tvlAverageNewChunk.value)
        .div(BigInt.fromI32(tvlAverage.index));
    } else {
      const outdatedChunk = TotalValueLockedChunk.load(
        `TotalValueLockedChunk-${tokenAddress.toHexString()}-${(tvlAverage.index - 30 * 24).toString()}`,
      )!;
      // Otherwise remove last chunk and add new chunk and recalculate average
      const dividedByChunks = BigInt.fromI32(30 * 24);
      tvlAverage.value = tvlAverage.value
        .plus(tvlAverageNewChunk.value.div(dividedByChunks))
        .minus(outdatedChunk.value.div(dividedByChunks));
    }
  } else {
    // Update the average
    tvlAverage.value = tvlAverage.value
      .minus(lastChunk.value.div(BigInt.fromI32(tvlAverage.index < 24 * 30 ? tvlAverage.index : 30 * 24)))
      .plus(
        collateralTokenMeta.totalValueLockedUSD.div(
          BigInt.fromI32(tvlAverage.index < 24 * 30 ? tvlAverage.index : 30 * 24),
        ),
      );

    // Update the last chunk
    lastChunk.value = collateralTokenMeta.totalValueLockedUSD;
    lastChunk.save();
  }

  tvlAverage.save();
};

function createCollateralTokenMeta_totalReserve30dAverage(event: ethereum.Event, tokenAddress: Address): void {
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

export const handleUpdateCollateralTokenMeta_totalReserve30dAverage = (
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
