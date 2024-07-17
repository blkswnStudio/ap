import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { handleStabilityPoolManagerInitiated } from '../src/stability-pool-manager';
import { createStabilityPoolManagerInitiatedEvent } from './stability-pool-manager-utils';
import { mockStoragePool_checkRecoveryMode } from './storage-pool-utils';
import { MockDebtTokenAddress, MockDebtToken_STABLE_Address, initSystemInfo, initToken } from './utils';

describe('handleStabilityPoolManagerInitiated()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken(MockDebtToken_STABLE_Address);
    mockStoragePool_checkRecoveryMode();
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdateSystemInfo_stabilityPoolManager: set stabilityPoolManager on systemInfo', () => {
    const event = createStabilityPoolManagerInitiatedEvent(
      MockDebtTokenAddress,
      MockDebtTokenAddress,
      MockDebtTokenAddress,
      MockDebtTokenAddress,
    );

    handleStabilityPoolManagerInitiated(event);

    const entityId = `SystemInfo`;
    assert.entityCount('SystemInfo', 1);
    assert.fieldEquals('SystemInfo', entityId, 'stabilityPoolManager', MockDebtTokenAddress.toHexString());
  });
});
