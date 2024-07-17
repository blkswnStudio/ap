import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { handlePriceFeedInitialized } from '../src/price-feed';
import { createPriceFeedInitializedEvent } from './price-feed-utils';
import { mockStoragePool_checkRecoveryMode } from './storage-pool-utils';
import { MockDebtTokenAddress, MockDebtToken_STABLE_Address, initSystemInfo, initToken } from './utils';

describe('handlePriceFeedInitialized()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken(MockDebtToken_STABLE_Address);
    mockStoragePool_checkRecoveryMode();
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdateSystemInfo_priceFeed: set priceFeed on systemInfo', () => {
    const event = createPriceFeedInitializedEvent(MockDebtTokenAddress, MockDebtTokenAddress);

    handlePriceFeedInitialized(event);

    const entityId = `SystemInfo`;
    assert.entityCount('SystemInfo', 1);
    assert.fieldEquals('SystemInfo', entityId, 'priceFeed', MockDebtTokenAddress.toHexString());
  });
});
