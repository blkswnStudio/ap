import { NETWORKS } from '../../config';
import { SchemaDataFreshnessManager_ATC } from './chainManagers/apollon-testing-chain';
import { SchemaDataFreshnessManager_LOCALHOST } from './chainManagers/localhost';

export const getActiveDataManger = (network: (typeof NETWORKS)[number]) => {
  const chainId = network.chainIdNumber;
  switch (chainId) {
    case 1328:
      return SchemaDataFreshnessManager_ATC;
    case 31337:
      return SchemaDataFreshnessManager_LOCALHOST;
    default:
      const _exhaustiveCheck: never = chainId;
      throw new Error(`Unsupported network ${chainId}`);
  }
};

export const evictCacheTimoutForObject = (
  currentNetwork: (typeof NETWORKS)[number],
  path: string[],
  fields?: string[],
) => {
  const activeManager = getActiveDataManger(currentNetwork);

  let object: any;
  path.forEach((subPath) => {
    // @ts-ignore
    object = object ? object[subPath] : activeManager[subPath];
  });

  if (fields) {
    fields.forEach((field) => {
      object[field].lastFetched = 0;
    });
  } else {
    Object.keys(object).forEach((field) => {
      object[field].lastFetched = 0;
    });
  }
};
