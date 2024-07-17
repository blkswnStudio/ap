import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { BytesLike, parseUnits } from 'ethers';
import { MockPyth } from '../typechain';
import { getLatestBlockTimestamp } from './testHelper';
import { Contracts } from './deployTestBase';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';

export interface PythPriceData {
  token: string;
  id: BytesLike;
  price: number;
}

const priceData: PythPriceData[] = [];

export const initPrice = (token: string, price: number, pythId?: string | undefined) => {
  if (!priceData.find(d => d.token === token))
    priceData.push({
      token,
      id:
        pythId !== undefined
          ? pythId
          : '0x' +
            BigInt(priceData.length + 1)
              .toString(8)
              .padStart(64, '0'),
      price,
    });
  else setPrice(token, price);
};

export const setPrice = (token: string, price: number) => {
  const d = priceData.find(p => p.token === token);
  if (d) d.price = price;
};

export const getPriceId = (token: string) => priceData.find(p => p.token === token)?.id as string;

export const generatePriceUpdateData = async (pyth: MockPyth, timeOffset: number = 0, offsetToken?: string) => {
  let ret: BytesLike[] = [];
  const now = await getLatestBlockTimestamp();
  for (let n = 0; n < priceData.length; n++) {
    let time = now;
    if (timeOffset) {
      if (offsetToken) {
        if (priceData[n].token === offsetToken) time += timeOffset;
      } else time += timeOffset;
    }

    const d = priceData[n];
    const p = parseUnits(d.price.toFixed(6), 6);
    const u = await pyth.createPriceFeedUpdateData(d.id, p, 10n * p, -6, p, 10n * p, time, time);
    ret.push(u);
  }
  return ret;
};

export interface OracleUpdateDataAndFee {
  data: BytesLike[];
  fee: bigint;
  payableData: {
    value: bigint;
    gasLimit: bigint;
  };
}

export const generatePriceUpdateDataWithFee = async (
  contracts: Contracts,
  timeOffset: number = 0,
  offsetToken?: string
): Promise<OracleUpdateDataAndFee> => {
  const ret: BytesLike[] = await generatePriceUpdateData(contracts.pyth, timeOffset, offsetToken);
  const fee = await contracts.priceFeed.getPythUpdateFee(ret);
  return {
    data: ret,
    fee: fee,
    payableData: { value: fee, gasLimit: 15000000n },
  };
};

export const generatePriceUpdateDataWithFeeViaHermes = async (
  contracts: Contracts,
  _oracleIds: string[]
): Promise<OracleUpdateDataAndFee> => {
  const oracleIds =
    _oracleIds ??
    (priceData
      .map(p => p.id)
      .filter(
        id => id !== undefined && id !== '0x0000000000000000000000000000000000000000000000000000000000000000'
      ) as string[]);

  const connection = new EvmPriceServiceConnection('https://hermes.pyth.network');
  const priceUpdateData = await connection.getPriceFeedsUpdateData(oracleIds);

  const fee = await contracts.priceFeed.getPythUpdateFee(priceUpdateData);
  return {
    data: priceUpdateData,
    fee: fee,
    payableData: { value: fee, gasLimit: 15000000n },
  };
};

export const initOracle = async (contracts: Contracts) => {
  const ud_1 = await generatePriceUpdateData(contracts.pyth, -30);
  const ud_2 = await generatePriceUpdateData(contracts.pyth, -15);

  // update 1 & 2 (for previous)
  await updatePythOracle(contracts, ud_1);
  await updatePythOracle(contracts, ud_2);
};

export const updateOracle = async (contracts: Contracts) => {
  await time.increase(5); // increase time by 5 seconds
  const ud = await generatePriceUpdateData(contracts.pyth);

  // update
  await updatePythOracle(contracts, ud);
};

const updatePythOracle = async (contracts: Contracts, data: BytesLike[]) => {
  const [owner] = await ethers.getSigners();
  //console.log(`Gas: ${await ethers.provider.getBalance(owner)}`);

  // get fee
  const fee = await contracts.priceFeed.getPythUpdateFee(data);

  // update
  await contracts.priceFeed.connect(owner).updatePythPrices(data, { value: fee, gasLimit: 10000000n }); //gas limit, because sometimes it fails otherwise
};
