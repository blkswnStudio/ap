import { BigInt } from '@graphprotocol/graph-ts';
import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { oneEther } from '../src/entities/token-candle-entity';
import { handleTransfer } from '../src/erc-20';
import { createTransferEvent } from './erc-20-utils';
import { mockPriceFeed_getUSDValue } from './price-feed-utils';
import { mockTokenManager_isDebtToken } from './token-manager-utils';
import {
  MockCollToken_OTHER_Address,
  MockDebtTokenAddress,
  MockSecondUserAddress,
  MockUserAddress,
  ZeroAddress,
  initSystemInfo,
} from './utils';

describe('handleTransfer()', () => {
  beforeEach(() => {
    initSystemInfo();

    mockTokenManager_isDebtToken(MockCollToken_OTHER_Address, false);
  });

  afterEach(() => {
    clearStore();
  });

  describe('handleUpdateTradingUserPosition_onTransfer()', () => {
    test('mint for generic DebtToken (no action)', () => {
      mockTokenManager_isDebtToken(MockDebtTokenAddress, true);
      handleTransfer(createTransferEvent(ZeroAddress, MockUserAddress, oneEther, MockDebtTokenAddress));
      assert.entityCount('TradingUserPosition', 0);
    });

    test('mint for generic ERC20', () => {
      mockPriceFeed_getUSDValue(MockCollToken_OTHER_Address, oneEther);
      handleTransfer(createTransferEvent(ZeroAddress, MockUserAddress, oneEther, MockCollToken_OTHER_Address));

      const entityId = `${MockUserAddress.toHexString()}-${MockCollToken_OTHER_Address.toHexString()}`;
      assert.entityCount('TradingUserPosition', 1);
      assert.fieldEquals('TradingUserPosition', entityId, 'amount', oneEther.toString());
      assert.fieldEquals('TradingUserPosition', entityId, 'value', oneEther.toString());
      assert.fieldEquals('TradingUserPosition', entityId, 'lastTransferAmount', BigInt.fromI32(0).toString());
      assert.fieldEquals('TradingUserPosition', entityId, 'lastTransferValue', BigInt.fromI32(0).toString());
    });

    test('transfer away generic ERC20', () => {
      const mintAmount = oneEther.times(BigInt.fromI32(2));
      const entityId = `${MockUserAddress.toHexString()}-${MockCollToken_OTHER_Address.toHexString()}`;

      // first mint 2 ether
      mockPriceFeed_getUSDValue(MockCollToken_OTHER_Address, mintAmount);
      handleTransfer(createTransferEvent(ZeroAddress, MockUserAddress, mintAmount, MockCollToken_OTHER_Address));
      assert.fieldEquals('TradingUserPosition', entityId, 'amount', mintAmount.toString());
      assert.fieldEquals('TradingUserPosition', entityId, 'value', mintAmount.toString());

      // transfer away 1 ether
      handleTransfer(
        createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther, MockCollToken_OTHER_Address),
      );
      assert.fieldEquals('TradingUserPosition', entityId, 'amount', oneEther.toString());
      assert.fieldEquals('TradingUserPosition', entityId, 'value', oneEther.toString());
      assert.fieldEquals('TradingUserPosition', entityId, 'lastTransferAmount', mintAmount.toString());
      assert.fieldEquals('TradingUserPosition', entityId, 'lastTransferValue', mintAmount.toString());
    });
  });
});
