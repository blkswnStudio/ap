import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ContractTransactionResponse, formatUnits } from 'ethers';
import { ethers } from 'hardhat';
import chalk from 'chalk';

export interface GasMetrics {
  gasCostList: bigint[];
  minGas?: bigint;
  maxGas?: bigint;
  meanGas?: bigint;
  medianGas?: bigint;
}

export interface GasMetricTopic {
  topic: string;
  metrics: bigint[][];
}

let gasMetricByTopic: GasMetricTopic[] = [];

export const resetGasMetricByTopic = () => {
  gasMetricByTopic = [];
};

export const appendGasWithTopic = (topic: string, metrics: bigint[][]) => {
  gasMetricByTopic.push({ topic, metrics });
};

export const gasUsed = async (tx: ContractTransactionResponse) => {
  const receipt = await tx.wait();
  return BigInt(receipt?.cumulativeGasUsed ?? 0) * BigInt(receipt?.gasPrice ?? 0);
};

export const getGasMetrics = (gasCostList: bigint[]): GasMetrics => {
  const sortedGasCostList = [...gasCostList].sort();
  const minGas = gasCostList[0];
  const maxGas = gasCostList[gasCostList.length - 1];

  // make sum
  const sum = gasCostList.reduce((p, c) => p + c, 0n);
  if (sum === 0n) {
    return {
      gasCostList: gasCostList,
      minGas: undefined,
      maxGas: undefined,
      meanGas: undefined,
      medianGas: undefined,
    };
  }

  // median is the middle element (for odd list size) or element adjacent-right of middle (for even list size)
  const meanGas = sum / BigInt(gasCostList.length);

  const medianGas = sortedGasCostList[Math.floor(sortedGasCostList.length / 2)];
  return {
    gasCostList,
    minGas,
    maxGas,
    meanGas,
    medianGas,
  };
};

export const logGasMetrics = (gasCostList: bigint[], message: string) => {
  const gasResults = getGasMetrics(gasCostList);
  console.log(
    `\n ${message}
      avg gas: ${formatUnits(gasResults.meanGas!)}\n\n`
  );
};

const formatMetricGas = (gas?: bigint) => {
  return gas !== undefined ? formatUnits(gas!) : '???';
};

export const logGasMetricTopic = () => {
  for (let n = 0; n < gasMetricByTopic.length; n++) {
    const m = gasMetricByTopic[n];
    const g_1 = m.metrics[0].length > 0 ? getGasMetrics(m.metrics[0]) : null;
    const g_10 = m.metrics[1].length > 0 ? getGasMetrics(m.metrics[1]) : null;
    const g_100 = m.metrics[2].length > 0 ? getGasMetrics(m.metrics[2]) : null;
    const g_1000 = m.metrics[3].length > 0 ? getGasMetrics(m.metrics[3]) : null;

    console.log(chalk.blue(`- ${m.topic}:`));
    if (g_1 != null) console.log(`  -    [1]: ${chalk.yellow(formatMetricGas(g_1?.meanGas))}`);
    if (g_10 != null) console.log(`  -   [10]: ${chalk.yellow(formatMetricGas(g_10?.meanGas))}`);
    if (g_100 != null) console.log(`  -  [100]: ${chalk.yellow(formatMetricGas(g_100?.meanGas))}`);
    if (g_1000 != null) console.log(`  - [1000]: ${chalk.yellow(formatMetricGas(g_1000?.meanGas))}`);
  }
};

export const logGasMetricsList = (gasCostList: bigint[][], message: string) => {
  console.log(`\n ${message}`);

  if (gasCostList.length >= 1 && gasCostList[0].length > 0) {
    const gasResults = getGasMetrics(gasCostList[0]);
    console.log(`\n avg gas (1): ${formatUnits(gasResults.meanGas!)}`);
  }

  if (gasCostList.length >= 2 && gasCostList[1].length > 1) {
    const gasResults = getGasMetrics(gasCostList[1]);
    console.log(`\n avg gas (10): ${formatUnits(gasResults.meanGas!)}`);
  }

  if (gasCostList.length >= 3 && gasCostList[2].length > 2) {
    const gasResults = getGasMetrics(gasCostList[2]);
    console.log(`\n avg gas (100): ${formatUnits(gasResults.meanGas!)}`);
  }

  if (gasCostList.length >= 4 && gasCostList[3].length > 3) {
    const gasResults = getGasMetrics(gasCostList[3]);
    console.log(`\n avg gas (1000): ${formatUnits(gasResults.meanGas!)}`);
  }

  console.log(`\n`);
};

export const logGas = (gas: bigint, message: string) => {
  console.log(
    `\n ${message} \n
      gas used: ${gas} \n`
  );
};

export interface MakeDescribeFunctions {
  appendGas: (tx: ContractTransactionResponse) => void;
  setTopic: (topic: string) => void;
}

export interface MakeDescribeAction {
  (accs: SignerWithAddress[], funcs: MakeDescribeFunctions): void;
}

export enum MakeDescriptionRuns {
  Execute_1,
  Execute_10,
  Execute_100,
  Execute_1000,
}

export const makeDescribe = (
  message: string,
  action: MakeDescribeAction,
  runs: MakeDescriptionRuns[] = [MakeDescriptionRuns.Execute_10]
) => {
  describe(message, () => {
    let signers: SignerWithAddress[];
    let signers_1: SignerWithAddress[];
    let signers_10: SignerWithAddress[];
    let signers_100: SignerWithAddress[];
    let signers_1000: SignerWithAddress[];
    let gasCostListCur: bigint[] | null;
    let gasCostList_1: bigint[];
    let gasCostList_10: bigint[];
    let gasCostList_100: bigint[];
    let gasCostList_1000: bigint[];
    let gasTopic: string | null;

    before(async () => {
      signers = await ethers.getSigners();
      gasCostListCur = null;
      gasCostList_1 = [];
      gasCostList_10 = [];
      gasCostList_100 = [];
      gasCostList_1000 = [];
      gasTopic = null;

      // get signers with offset for owner + 1 extra account
      signers_1 = signers.slice(2, 3);
      signers_10 = signers.slice(2, 12);
      signers_100 = signers.slice(2, 102);
      signers_1000 = signers.slice(2, 1002);
    });

    const appendGas = async (tx: ContractTransactionResponse) => {
      gasCostListCur!.push(await gasUsed(tx));
    };

    const setTopic = (topic: string) => {
      gasTopic = topic;
    };

    const funcs = (): MakeDescribeFunctions => {
      return {
        appendGas,
        setTopic,
      };
    };

    if (runs.includes(MakeDescriptionRuns.Execute_1)) {
      it('1', async () => {
        gasCostListCur = gasCostList_1;
        await action(signers_1, funcs());
      });
    }

    if (runs.includes(MakeDescriptionRuns.Execute_10)) {
      it('10', async () => {
        gasCostListCur = gasCostList_10;
        await action(signers_10, funcs());
      });
    }

    if (runs.includes(MakeDescriptionRuns.Execute_100)) {
      it('100', async () => {
        gasCostListCur = gasCostList_100;
        await action(signers_100, funcs());
      });
    }

    if (runs.includes(MakeDescriptionRuns.Execute_1000)) {
      it('1000', async () => {
        gasCostListCur = gasCostList_1000;
        await action(signers_1000, funcs());
      });
    }

    afterEach(() => {
      if (runs.length === 1)
        if (gasTopic === null) logGasMetrics(gasCostListCur!, `Costs:`);
        else {
          const gasList = [
            runs.includes(MakeDescriptionRuns.Execute_1) ? gasCostListCur! : [],
            runs.includes(MakeDescriptionRuns.Execute_10) ? gasCostListCur! : [],
            runs.includes(MakeDescriptionRuns.Execute_100) ? gasCostListCur! : [],
            runs.includes(MakeDescriptionRuns.Execute_1000) ? gasCostListCur! : [],
          ];
          appendGasWithTopic(gasTopic!, gasList);
        }
    });

    after(() => {
      if (runs.length > 1)
        if (gasTopic === null)
          logGasMetricsList([gasCostList_1, gasCostList_10, gasCostList_100, gasCostList_1000], `Costs:`);
        else appendGasWithTopic(gasTopic!, [gasCostList_1, gasCostList_10, gasCostList_100, gasCostList_1000]);
    });
  });
};
