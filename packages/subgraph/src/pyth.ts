import { Address } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../generated/PriceFeed/PriceFeed';
import { PriceFeedUpdate as PriceFeedUpdateEvent } from '../generated/Pyth/IPyth';
import { Oracle, SystemInfo } from '../generated/schema';
import { ZeroAddress } from '../tests/utils';
import { handleUpdateTokenCandle_lowOracle_highOracle } from './entities/token-candle-entity';
// import { log } from '@graphprotocol/graph-ts';

export function handlePriceFeedUpdate(event: PriceFeedUpdateEvent): void {
  // Oracle must be defined, otherwise ignore event.
  // FIXME: Shit doesnt work, still weird decimals
  // if (Oracle.load(event.params.id)) {
  //   // FIXME: The decimals are fcked. Stocks + Resources are 5 decimals, Crypto is 8 decimals.
  //   // XAG = 3063250
  //   // USDT = 99991626
  //   // TSLA = 31073102
  //   handleUpdateTokenCandle_lowOracle_highOracle(event, event.params.id, event.params.price);
  // }
}
