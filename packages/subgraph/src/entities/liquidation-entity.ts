import { Address, BigInt } from '@graphprotocol/graph-ts';
import { LiquidationSummary as LiquidationSummaryEvent } from '../../generated/LiquidationOperations/LiquidationOperations';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import { Liquidation, LiquidationAsset, SystemInfo } from '../../generated/schema';

export function handleCreateLiquidation(event: LiquidationSummaryEvent): void {
  const assetList: string[] = [];
  const liq = new Liquidation(event.transaction.hash.toHexString());
  liq.timestamp = event.block.timestamp;
  liq.collUSD = BigInt.fromI32(0);
  liq.debtUSD = BigInt.fromI32(0);
  liq.assets = [];
  liq.save();

  // debts
  for (let n = 0; n < event.params.liquidatedDebt.length; n++) {
    const liqDebt = event.params.liquidatedDebt[n];
    if (!liqDebt.amount.equals(BigInt.fromI32(0))) {
      const asset = handleCreateLiquidationAsset(liq, true, liqDebt.tokenAddress, liqDebt.amount);
      liq.debtUSD = liq.debtUSD.plus(asset.valueUSD);
      assetList.push(asset.id);
    }
  }

  // colls
  for (let n = 0; n < event.params.liquidatedColl.length; n++) {
    const liqColl = event.params.liquidatedColl[n];
    if (!liqColl.amount.equals(BigInt.fromI32(0))) {
      const asset = handleCreateLiquidationAsset(liq, false, liqColl.tokenAddress, liqColl.amount);
      liq.collUSD = liq.collUSD.plus(asset.valueUSD);
      assetList.push(asset.id);
    }
  }

  liq.assets = assetList;
  liq.save();
}

export function handleCreateLiquidationAsset(
  liq: Liquidation,
  isDebt: boolean,
  token: Address,
  amount: BigInt,
): LiquidationAsset {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const priceFeed = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
  const asset = new LiquidationAsset(`${liq.id}-${isDebt.toString()}-${token.toHexString()}`);

  asset.isDebt = isDebt;
  asset.token = token;
  asset.amount = amount;
  asset.valueUSD = priceFeed.getUSDValue2(token, amount);

  asset.save();
  return asset;
}
