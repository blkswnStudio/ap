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

  const direction =
    token0 == stableCoin
      ? event.params.amount0In.equals(BigInt.fromI32(0))
        ? 'SHORT'
        : 'LONG'
      : event.params.amount1In.equals(BigInt.fromI32(0))
        ? 'SHORT'
        : 'LONG';

  const stableSize =
    direction === 'LONG'
      ? token0 == stableCoin
        ? event.params.amount0In
        : event.params.amount1In
      : token0 == stableCoin
        ? event.params.amount0Out
        : event.params.amount1Out;
  const debtTokenSize =
    direction === 'SHORT'
      ? token0 == stableCoin
        ? event.params.amount1In
        : event.params.amount0In
      : token0 == stableCoin
        ? event.params.amount1Out
        : event.params.amount0Out;

  const swapFee =
    token0 == stableCoin
      ? direction === 'LONG'
        ? event.params.amount0InFee
        : event.params.amount1InFee
      : direction === 'LONG'
        ? event.params.amount1InFee
        : event.params.amount0InFee;

  handleCreateSwapEvent(event, nonStableCoin, event.params.to, direction, debtTokenSize, stableSize, swapFee);

  handleUpdateTokenCandle_volume(event, event.address, token0 == stableCoin ? 1 : 0, nonStableCoin, stableSize);

  let feeUSD = BigInt.fromI32(0);
  if (direction === 'LONG') {
    // TODO: Maybe use pool price instead of oracle?
    const stablePrice = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed)).getPrice(stableCoin).getPrice();
    feeUSD = stablePrice
      .times(stableSize)
      .times(swapFee)
      .div(BigInt.fromI32(10).pow(18 + 18));
  } else {
    const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
    // TODO: Maybe use pool price instead of oracle?
    const tokenPrice = priceFeedContract.getPrice(nonStableCoin).getPrice();

    feeUSD = tokenPrice
      .times(debtTokenSize)
      .times(swapFee)
      .div(BigInt.fromI32(10).pow(18 + 18));
  }

  handleUpdatePool_volume30dUSD(event, stableCoin, nonStableCoin, stableSize, feeUSD);
}

export function handleSync(event: SyncEvent): void {
  const swapPairContract = SwapPair.bind(event.address);
  const token0 = swapPairContract.token0();
  const token1 = swapPairContract.token1();
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin); // This is of type Bytes, so I convert it to Address
  const nonStableCoin = token0 == stableCoin ? token1 : token0;

  // Because Reserves change
  handleUpdateLiquidity_totalAmount(
    event,
    stableCoin,
    nonStableCoin,
    token0 == stableCoin ? event.params.reserve0 : event.params.reserve1,
    token0 == stableCoin ? event.params.reserve1 : event.params.reserve0,
  );
  handleUpdatePool_liquidityDepositAPY(event, stableCoin, nonStableCoin);

  handleUpdateTokenCandle_low_high(event, event.address, token0 == stableCoin ? 0 : 1, nonStableCoin);
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
