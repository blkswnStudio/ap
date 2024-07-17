import { Address, BigInt } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../generated/PriceFeed/PriceFeed';
import { SystemInfo } from '../generated/schema';
import {
  Burn as BurnEvent,
  Mint as MintEvent,
  Swap as SwapEvent,
  SwapPair,
  Sync as SyncEvent,
  Transfer as TransferEvent,
} from '../generated/templates/SwapPairTemplate/SwapPair';
import {
  handleUpdateLiquidity_totalAmount,
  handleUpdatePool_liquidityDepositAPY,
  handleUpdatePool_totalSupply,
  handleUpdatePool_volume30dUSD,
} from './entities/pool-entity';
import { handleCreateSwapEvent } from './entities/swap-event-entity';
import { handleUpdateTokenCandle_low_high, handleUpdateTokenCandle_volume } from './entities/token-candle-entity';

export function handleBurn(event: BurnEvent): void {
  const swapPairContract = SwapPair.bind(event.address);
  const token0 = swapPairContract.token0();
  const token1 = swapPairContract.token1();
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin); // This is of type Bytes, so I convert it to Address
  const nonStableCoin = token0 == stableCoin ? token1 : token0;

  handleUpdatePool_totalSupply(event, stableCoin, nonStableCoin);
}

export function handleMint(event: MintEvent): void {
  const swapPairContract = SwapPair.bind(event.address);
  const token0 = swapPairContract.token0();
  const token1 = swapPairContract.token1();
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin); // This is of type Bytes, so I convert it to Address
  const nonStableCoin = token0 == stableCoin ? token1 : token0;

  handleUpdatePool_totalSupply(event, stableCoin, nonStableCoin);
}

export function handleSwap(event: SwapEvent): void {
  const swapPairContract = SwapPair.bind(event.address);
  const token0 = swapPairContract.token0();
  const token1 = swapPairContract.token1();

  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin); // This is of type Bytes, so I convert it to Address
  const nonStableCoin = token0 == stableCoin ? token1 : token0;

  const direction = event.params.amount0In.equals(BigInt.fromI32(0)) ? 'SHORT' : 'LONG';

  const stableSize = direction === 'LONG' ? event.params.amount0In : event.params.amount0Out;
  const debtTokenSize = direction === 'SHORT' ? event.params.amount1In : event.params.amount1Out;

  const swapFee = direction === 'LONG' ? event.params.amount0InFee : event.params.amount1InFee;
  const feeUSD =
    direction === 'LONG'
      ? swapFee
      : PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed)).getUSDValue2(nonStableCoin, swapFee);

  handleCreateSwapEvent(event, nonStableCoin, event.params.to, direction, debtTokenSize, stableSize, swapFee);
  handleUpdateTokenCandle_volume(event, event.address, nonStableCoin, stableSize);
  handleUpdatePool_volume30dUSD(event, stableCoin, nonStableCoin, stableSize, feeUSD);
}

export function handleSync(event: SyncEvent): void {
  const swapPairContract = SwapPair.bind(event.address);
  const token0 = swapPairContract.token0();
  const token1 = swapPairContract.token1();
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin); // This is of type Bytes, so I convert it to Address

  // Because Reserves change
  handleUpdateLiquidity_totalAmount(event, stableCoin, token1, event.params.reserve0, event.params.reserve1);
  handleUpdatePool_liquidityDepositAPY(event, stableCoin, token1);

  handleUpdateTokenCandle_low_high(event, event.address, token1);
}

export function handleTransfer(event: TransferEvent): void {
  const swapPairContract = SwapPair.bind(event.address);
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin); // This is of type Bytes, so I convert it to Address

  const token0 = swapPairContract.token0();
  const token1 = swapPairContract.token1();
  const nonStableCoin = token0 == stableCoin ? token1 : token0;

  // TODO: Can be optimized because added/substracted value is already included in event. Do it later.
  handleUpdatePool_totalSupply(event, stableCoin, nonStableCoin);
}
