import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { PriceFeedUpdate as PriceFeedUpdateEvent } from '../generated/Pyth/IPyth';
import { Oracle, Token } from '../generated/schema';
import { updateStaking_additionalReward } from './entities/staking-entity';
import { handleUpdateTokenCandle_lowOracle_highOracle } from './entities/token-candle-entity';
// import { log } from '@graphprotocol/graph-ts';

export function handlePriceFeedUpdate(event: PriceFeedUpdateEvent): void {
  const oracle = Oracle.load(event.params.id);

  // Oracle must be defined, otherwise ignore event.
  if (oracle != null) {
    const tokenAddress = Address.fromBytes(oracle.token);
    const token = Token.load(tokenAddress);

    if (token == null) {
      return;
    }

    if (token.isPoolToken) {
      // Stocks + Resources are 5 decimals, Crypto is 8 decimals.
      const priceWithEtherPrecision = event.params.price.times(
        isOracleIdCryptoAsset(event.params.id) ? BigInt.fromI64(10000000000) : BigInt.fromI64(10000000000000),
      );

      handleUpdateTokenCandle_lowOracle_highOracle(event, tokenAddress, priceWithEtherPrecision);
    }

    // https://api.goldsky.com/api/public/project_clyov5gbzku2e01yob93efovj/subgraphs/jAssets/v1.2.0/gn
    // HARDCODED WSEI AND FRAX
    if (
      event.params.id.toHexString() == '0x53614f1cb0c031d4af66c04cb9c756234adad0e1cee85303795091499a4084eb' ||
      event.params.id.toHexString() == '0xc3d5d8d6d17081b3d0bbca6e2fa3a6704bb9a9561d9f9e1dc52db47629f862ad'
    ) {
      // mapping exists so handle update
      // if (token.equals(Address.fromBytes(systemInfo.govToken))) {
      // GOV token, so special additional handling
      // FIXME: Not called in my opinion => MUST BE MOVED TO JV POOL EVENT
      // updateStaking_rewardUSD(event);
      // }

      // FIXME: COMMENT BACK IN ON PROD
      updateStaking_additionalReward(event, tokenAddress);
    }
  }
}

/**
 * FIXME: Do not hardcode in the future
 */
const isOracleIdCryptoAsset = (oracleId: Bytes): boolean => {
  // TRUMP
  // "0x879551021853eec7a7dc827578e8e69da7e4fa8148339aa0d3d5296405be4b1a"
  // STOCKS
  // "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593"
  // "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1"
  // "0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe"
  // "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688"
  // "0xe1e80251e5f5184f2195008382538e847fafc36f751896889dd3d1b1f6111f09"

  return oracleId.toHexString() == '0x879551021853eec7a7dc827578e8e69da7e4fa8148339aa0d3d5296405be4b1a';
};
