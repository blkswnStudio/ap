import { PriceFeedInitialized as PriceFeedInitializedEvent } from '../generated/PriceFeed/PriceFeed';
import { handleUpdateSystemInfo_priceFeed } from './entities/system-info-entity';

export function handlePriceFeedInitialized(event: PriceFeedInitializedEvent): void {
  handleUpdateSystemInfo_priceFeed(event, event.address);
}
