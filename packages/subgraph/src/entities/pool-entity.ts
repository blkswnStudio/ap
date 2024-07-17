import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import { Pool, PoolLiquidity, PoolVolume30d, PoolVolumeChunk, SystemInfo, Token } from '../../generated/schema';
import { SwapPair } from '../../generated/templates/SwapPairTemplate/SwapPair';
import { oneEther } from './token-candle-entity';

// 1h
const chunkSize = 60 * 60;
const thirtyDays = BigInt.fromI32(30 * 24 * chunkSize);
const totalChunks = 30 * 24;

export function handleCreateUpdatePool(
  event: ethereum.Event,
  stableCoin: Address,
  nonStableCoin: Address,
  swapPair: Address,
): void {
  let poolEntity = Pool.load(`Pool-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}`);

  // Initialize Pool entity and all the linked averages
  if (poolEntity === null) {
    poolEntity = new Pool(`Pool-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}`);
    poolEntity.address = swapPair;
    poolEntity.stakingPool = swapPair;

    //   Aggregator for recent Volume
    const poolVolume = new PoolVolume30d(`PoolVolume30d-${swapPair.toHexString()}`);
    poolVolume.lastIndex = 1;
    poolVolume.leadingIndex = 1;
    poolVolume.value = BigInt.fromI32(0);
    poolVolume.feeUSD = BigInt.fromI32(0);
    poolVolume.save();
    poolEntity.volume30dUSD = poolVolume.id;

    const poolVolume30dAgo = new PoolVolume30d(`PoolVolume30dAgo-${swapPair.toHexString()}`);
    poolVolume30dAgo.lastIndex = 1;
    poolVolume30dAgo.leadingIndex = 1;
    poolVolume30dAgo.value = BigInt.fromI32(0);
    poolVolume30dAgo.feeUSD = BigInt.fromI32(0);
    poolVolume30dAgo.save();
    poolEntity.volume30dUSD30dAgo = poolVolume30dAgo.id;

    //   Add first PoolChunk
    const poolVolumeChunk = new PoolVolumeChunk(
      `PoolVolumeChunk-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}-1`,
    );
    poolVolumeChunk.timestamp = event.block.timestamp;
    poolVolumeChunk.value = BigInt.fromI32(0);
    poolVolumeChunk.feeUSD = BigInt.fromI32(0);
    poolVolumeChunk.save();

    // Initialize Liquidity
    const liquidity0 = new PoolLiquidity(stableCoin.concat(nonStableCoin));
    liquidity0.token = stableCoin;
    liquidity0.totalAmount = BigInt.fromI32(0);
    liquidity0.save();

    const liquidity1 = new PoolLiquidity(nonStableCoin.concat(stableCoin));
    liquidity1.token = nonStableCoin;
    liquidity1.totalAmount = BigInt.fromI32(0);
    liquidity1.save();

    poolEntity.liquidityDepositAPY = BigInt.fromI32(0);
    poolEntity.totalValueUSD = BigInt.fromI32(0);

    poolEntity.liquidity = [liquidity0.id, liquidity1.id];

    // Setting the info on the token
    const newToken = Token.load(nonStableCoin);
    if (newToken !== null) {
      newToken.isPoolToken = true;
      newToken.save();
    }
  }

  // Update the general data of the pool
  const swapPairContract = SwapPair.bind(swapPair);
  const reserves = swapPairContract.getReserves();

  const liquidity0 = PoolLiquidity.load(poolEntity.liquidity[0])!;
  liquidity0.totalAmount = reserves.value0;
  liquidity0.save();

  const liquidity1 = PoolLiquidity.load(poolEntity.liquidity[1])!;
  liquidity1.totalAmount = reserves.value1;
  liquidity1.save();

  const totalSupply = swapPairContract.totalSupply();
  poolEntity.totalSupply = totalSupply;

  poolEntity.save();
}

export function handleUpdatePool_volume30dUSD(
  event: ethereum.Event,
  stableCoin: Address,
  nonStableCoin: Address,
  value: BigInt,
  feeUSD: BigInt,
): void {
  const poolEntity = Pool.load(`Pool-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}`)!;

  //   load last VolumeChunk and check if its outdated
  const recentVolume = PoolVolume30d.load(poolEntity.volume30dUSD)!;

  const leadingVolumeChunk = PoolVolumeChunk.load(
    `PoolVolumeChunk-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}-${recentVolume.leadingIndex}`,
  )!;
  const leadingChunkIsOutdated = leadingVolumeChunk.timestamp.plus(BigInt.fromI32(chunkSize)).lt(event.block.timestamp);

  // create a new chunk
  if (leadingChunkIsOutdated) {
    const newVolumeChunk = new PoolVolumeChunk(
      `PoolVolumeChunk-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}-${recentVolume.leadingIndex + 1}`,
    );
    // increase timestamp by exactly chunksize
    newVolumeChunk.timestamp = leadingVolumeChunk.timestamp.plus(BigInt.fromI32(chunkSize));
    newVolumeChunk.value = value;
    newVolumeChunk.feeUSD = feeUSD;
    newVolumeChunk.save();

    recentVolume.leadingIndex += 1;
  } else {
    // just add it to the leading chunk
    leadingVolumeChunk.value = leadingVolumeChunk.value.plus(value);
    leadingVolumeChunk.feeUSD = leadingVolumeChunk.feeUSD.plus(feeUSD);
    leadingVolumeChunk.save();
  }

  // add new volume
  recentVolume.value = recentVolume.value.plus(value);
  recentVolume.feeUSD = recentVolume.feeUSD.plus(feeUSD);

  const lastVolumeChunk = PoolVolumeChunk.load(
    `PoolVolumeChunk-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}-${recentVolume.lastIndex}`,
  )!;
  const lastChunkIsOutdated = lastVolumeChunk.timestamp.plus(thirtyDays).lt(event.block.timestamp);

  if (lastChunkIsOutdated) {
    recentVolume.value = recentVolume.value.minus(lastVolumeChunk.value);
    recentVolume.feeUSD = recentVolume.feeUSD.minus(lastVolumeChunk.feeUSD);
    recentVolume.lastIndex += 1;

    const volume30DaysAgo = PoolVolume30d.load(poolEntity.volume30dUSD30dAgo)!;

    // add new chunk that is just older than 30 days
    volume30DaysAgo.leadingIndex += 1;
    volume30DaysAgo.value = volume30DaysAgo.value.plus(lastVolumeChunk.value);
    volume30DaysAgo.feeUSD = volume30DaysAgo.feeUSD.plus(lastVolumeChunk.feeUSD);

    // remove chunk that is older than 60 days
    const lastVolumeChunk30DaysAgo = PoolVolumeChunk.load(
      `PoolVolumeChunk-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}-${volume30DaysAgo.lastIndex}`,
    )!;
    const lastChunkIsOutdated = lastVolumeChunk30DaysAgo.timestamp
      .plus(thirtyDays.times(BigInt.fromI32(2)))
      .lt(event.block.timestamp);
    if (lastChunkIsOutdated) {
      volume30DaysAgo.value = volume30DaysAgo.value.minus(lastVolumeChunk30DaysAgo.value);
      volume30DaysAgo.feeUSD = volume30DaysAgo.feeUSD.minus(lastVolumeChunk30DaysAgo.feeUSD);
      volume30DaysAgo.lastIndex += 1;
    }

    volume30DaysAgo.save();
  }

  recentVolume.save();
}

export function handleUpdatePool_liquidityDepositAPY(
  event: ethereum.Event,
  stableCoin: Address,
  nonStableCoin: Address,
): void {
  const poolEntity = Pool.load(`Pool-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}`)!;
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));

  // TODO: This represents the expected APY not the actual APY => determine what is wanted.
  const liquidity0 = PoolLiquidity.load(stableCoin.concat(nonStableCoin))!;
  const liquidity0USD = priceFeedContract.getPrice(stableCoin).getPrice().times(liquidity0.totalAmount).div(oneEther);
  const liquidity1 = PoolLiquidity.load(nonStableCoin.concat(stableCoin))!;
  const liquidity1USD = priceFeedContract
    .getPrice(nonStableCoin)
    .getPrice()
    .times(liquidity1.totalAmount)
    .div(oneEther);

  const totalValueUSD = liquidity0USD.plus(liquidity1USD);

  const recentVolume = PoolVolume30d.load(poolEntity.volume30dUSD)!;
  // scale one Month to a year
  const apy = recentVolume.feeUSD.times(oneEther).times(BigInt.fromI32(12)).div(totalValueUSD);

  poolEntity.totalValueUSD = totalValueUSD;
  poolEntity.liquidityDepositAPY = apy;
  poolEntity.save();
}

export function handleUpdatePool_totalSupply(event: ethereum.Event, stableCoin: Address, nonStableCoin: Address): void {
  const poolEntity = Pool.load(`Pool-${stableCoin.toHexString()}-${nonStableCoin.toHexString()}`)!;

  const swapPairContract = SwapPair.bind(event.address);
  const totalSupply = swapPairContract.totalSupply();
  poolEntity.totalSupply = totalSupply;

  poolEntity.save();
}

export function handleUpdateLiquidity_totalAmount(
  event: ethereum.Event,
  stableCoin: Address,
  nonStableCoin: Address,
  reserveStable: BigInt,
  reserveNonStable: BigInt,
): void {
  const liquidity0 = PoolLiquidity.load(stableCoin.concat(nonStableCoin))!;
  liquidity0.totalAmount = reserveStable;
  liquidity0.save();

  const liquidity1 = PoolLiquidity.load(nonStableCoin.concat(stableCoin))!;
  liquidity1.totalAmount = reserveNonStable;
  liquidity1.save();
}
