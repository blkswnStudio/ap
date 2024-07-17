// import { log } from '@graphprotocol/graph-ts';
import { Address } from '@graphprotocol/graph-ts';
import { PairCreated as PairCreatedEvent } from '../generated/SwapOperations/SwapOperations';
import { SystemInfo } from '../generated/schema';
import { SwapPairTemplate } from '../generated/templates';
import { handleCreateUpdatePool } from './entities/pool-entity';
import { handleCreateTokenCandleSingleton } from './entities/token-candle-entity';

export function handlePairCreated(event: PairCreatedEvent): void {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin);

  // FIXME: Investigate why pool has different order for GOV
  const nonStableCoin = event.params.token0 == stableCoin ? event.params.token1 : event.params.token0;
  const stableCoinToken = event.params.token0 == stableCoin ? event.params.token0 : event.params.token1;

  SwapPairTemplate.create(event.params.pair);
  handleCreateUpdatePool(event, stableCoinToken, nonStableCoin, event.params.pair);

  handleCreateTokenCandleSingleton(event, nonStableCoin);
}
