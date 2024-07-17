import fs from 'fs';
import path from 'path';

// Assuming Contracts object is defined somewhere in your script or imported
export const Contracts = {
  DebtToken: {
    STABLE: '0x84ea74d481ee0a5332c457a4d796187f6ba67feb',
    STOCK_1: '0x9e545e3c0baab3e08cdfd552c960a1050f373042',
  },
  ERC20: {
    BTC: '0x9a676e781a523b5d0c0e43731313a708cb607508',
    USDT: '0x959922be3caee4b8cd9a407cc3ac1c251c2007b1',
    GOV: '0x0b306bf915c4d645ff596e518faf3f9669b97016',
  },
  TroveManager: '0x0165878a594ca255338adfa4d48449f69242eb8f',
  StabilityPoolManager: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9',
  SwapOperations: '0xa51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0',
  SwapPairs: {
    BTC: '0x6d09e8227073f36028f87f9ac1863540be036c01',
    USDT: '0x6fc8d5049fa554c86660e9a06664b87b1405015d',
    STOCK_1: '0xa3fe5e2fd94cda575722f376eba4816a7eeaf79c',
  },
  BorrowerOperations: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
  StoragePool: '0xb7f8bc63bbcad18155201308c8f3540b07f84f5e',
  SortedTroves: '0x610178da211fef7d417bc0e6fed39f05609ad788',
  HintHelpers: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
  PriceFeed: '0xa513e6e4b8f2a923d98304ec87f64353c4d5c853',
  RedemptionOperations: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
  CollSurplus: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
};

// Specify the directory where the files will be saved
const outputDirectory = 'app/context/typePolicies';

// Ensure the output directory exists
if (!fs.existsSync(outputDirectory)) {
  fs.mkdirSync(outputDirectory, { recursive: true });
}

// Function to generate the template for a given DebtToken
const generateDebtTokenTemplate = (tokenName, tokenAddress) => {
  return `
  import { makeVar } from "@apollo/client";
  import { AddressLike } from "ethers";
  import { Contracts, isStableCoinAddress } from "../../../config";
  import { PriceFeed, TroveManager, DebtToken, StabilityPoolManager } from "../../../generated/types";
  import { getCheckSum } from "../../utils/crypto";
  import { SchemaDataFreshnessManager, ContractDataFreshnessManager } from "../CustomApolloProvider";
  
  const defaultFieldValue = BigInt(0);

  const DebtToken_${tokenName} = {
  [Contracts.DebtToken.${tokenName}]: {
    priceUSDOracle: {
      fetch: async (updatedPrice?: bigint, priceFeedContract?: PriceFeed) => {
        SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].priceUSDOracle.lastFetched = Date.now();

        SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].priceUSDOracle.value(updatedPrice);
      },
      value: makeVar(defaultFieldValue),
      lastFetched: 0,
      timeout: 1000 * 2,
    },
    
    borrowingRate: {
        fetch: async (troveManagerContract: TroveManager) => {
          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].borrowingRate.lastFetched = Date.now();

          const borrowingRate = await troveManagerContract.getBorrowingRate(
            isStableCoinAddress(Contracts.DebtToken.${tokenName}),
          );

          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].borrowingRate.value(borrowingRate);
        },
        value: makeVar(defaultFieldValue),
        lastFetched: 0,
        timeout: 1000 * 2,
        periodic: 1000 * 30,
      },

      decimals: {
        fetch: async (debtTokenContract: DebtToken) => {
          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].decimals.lastFetched = Date.now();

          const decimals = await debtTokenContract.decimals();

          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].decimals.value(Number(decimals) as any);
        },
        value: makeVar(Number(defaultFieldValue) as any),
        lastFetched: 0,
        timeout: 1000 * 3600,
      },

      walletAmount: {
        fetch: async (debtTokenContract: DebtToken, borrower: AddressLike) => {
          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].walletAmount.lastFetched = Date.now();

          const borrowerBalance = await debtTokenContract.balanceOf(borrower);

          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].walletAmount.value(borrowerBalance);
        },
        value: makeVar(defaultFieldValue),
        lastFetched: 0,
        timeout: 1000 * 2,
        periodic: 1000 * 30,
      },

      troveMintedAmount: {
        fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].troveMintedAmount.lastFetched = Date.now();

          if (fetchSource) {
            await ContractDataFreshnessManager.TroveManager.getTroveDebt.fetch(
              fetchSource.troveManagerContract,
              fetchSource.borrower,
            );
          }

          const tokenAmount = ContractDataFreshnessManager.TroveManager.getTroveDebt.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts.DebtToken.${tokenName}),
          )?.amount;
          if (tokenAmount) {
            SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].troveMintedAmount.value(tokenAmount);
          }
        },
        value: makeVar(defaultFieldValue),
        lastFetched: 0,
        timeout: 1000 * 2,
        periodic: 1000 * 30,
      },

      troveDebtAmount: {
        fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].troveDebtAmount.lastFetched = Date.now();

          if (fetchSource) {
            await ContractDataFreshnessManager.TroveManager.getTroveRepayableDebts.fetch(
              fetchSource.troveManagerContract,
              fetchSource.borrower,
            );
          }

          const repayableDebt = ContractDataFreshnessManager.TroveManager.getTroveRepayableDebts.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts.DebtToken.${tokenName}),
          )?.amount;
          if (repayableDebt) {
            SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].troveDebtAmount.value(repayableDebt);
          }
        },
        value: makeVar(defaultFieldValue),
        lastFetched: 0,
        timeout: 1000 * 2,
        periodic: 1000 * 30,
      },

      troveRepableDebtAmount: {
        fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].troveRepableDebtAmount.lastFetched =
            Date.now();

          if (fetchSource) {
            await ContractDataFreshnessManager.TroveManager.getTroveRepayableDebts.fetch(
              fetchSource.troveManagerContract,
              fetchSource.borrower,
            );
          }

          const repayableDebt = ContractDataFreshnessManager.TroveManager.getTroveRepayableDebts.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts.DebtToken.${tokenName}),
          )?.amount;
          if (repayableDebt) {
            SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].troveRepableDebtAmount.value(
              repayableDebt,
            );
          }
        },
        value: makeVar(defaultFieldValue),
        lastFetched: 0,
        timeout: 1000 * 2,
        periodic: 1000 * 30,
      },

      providedStability: {
        fetch: async (fetchSource?: { stabilityPoolManagerContract: StabilityPoolManager; depositor: AddressLike }) => {
          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].providedStability.lastFetched = Date.now();

          if (fetchSource) {
            await ContractDataFreshnessManager.StabilityPoolManager.getDepositorDeposits.fetch(
              fetchSource.stabilityPoolManagerContract,
              fetchSource.depositor,
            );
          }

          const tokenAmount = ContractDataFreshnessManager.StabilityPoolManager.getDepositorDeposits.value.find(
            ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts.DebtToken.${tokenName}),
          )?.amount;
          if (tokenAmount) {
            SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].providedStability.value(tokenAmount);
          }
        },
        value: makeVar(defaultFieldValue),
        lastFetched: 0,
        timeout: 1000 * 2,
        periodic: 1000 * 30,
      },

      compoundedDeposit: {
        fetch: async (fetchSource?: { stabilityPoolManagerContract: StabilityPoolManager; depositor: AddressLike }) => {
          SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].compoundedDeposit.lastFetched = Date.now();

          if (fetchSource) {
            await ContractDataFreshnessManager.StabilityPoolManager.getDepositorCompoundedDeposits.fetch(
              fetchSource.stabilityPoolManagerContract,
              fetchSource.depositor,
            );
          }

          const compoundedDeposit =
            ContractDataFreshnessManager.StabilityPoolManager.getDepositorCompoundedDeposits.value.find(
              ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts.DebtToken.${tokenName}),
            )?.amount;

          if (compoundedDeposit) {
            SchemaDataFreshnessManager.DebtToken[Contracts.DebtToken.${tokenName}].compoundedDeposit.value(
              compoundedDeposit,
            );
          }
        },
        value: makeVar(defaultFieldValue),
        lastFetched: 0,
        timeout: 1000 * 2,
        periodic: 1000 * 30,
      },
  },
}

export default DebtToken_${tokenName};
`;
};

const generateCollTokenTemplate = (tokenName, tokenAddress) => {
  return `
  import { makeVar } from "@apollo/client";
  import { AddressLike } from "ethers";
  import { Contracts, isStableCoinAddress } from "../../../config";
  import { PriceFeed, TroveManager, ERC20, StabilityPoolManager, CollSurplusPool } from "../../../generated/types";
  import { getCheckSum } from "../../utils/crypto";
  import { SchemaDataFreshnessManager, ContractDataFreshnessManager } from "../CustomApolloProvider";
  
  const defaultFieldValue = BigInt(0);

  const ERC20_${tokenName} = {
    [Contracts.ERC20.${tokenName}]: {
        priceUSDOracle: {
          fetch: async (updatedPrice?: bigint, priceFeedContract?: PriceFeed) => {
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].priceUSDOracle.lastFetched = Date.now();
  
            const tokenPrice = (await priceFeedContract.getPrice(Contracts.ERC20.${tokenName})).price;
  
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].priceUSDOracle.value(tokenPrice);
          },
          value: makeVar(defaultFieldValue),
          lastFetched: 0,
          timeout: 1000 * 2,
          periodic: 1000 * 30,
        },
  
        borrowingRate: {
          fetch: async (troveManagerContract: TroveManager) => {
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].borrowingRate.lastFetched = Date.now();
  
            const borrowingRate = await troveManagerContract.getBorrowingRate(isStableCoinAddress(Contracts.ERC20.${tokenName}));
  
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].borrowingRate.value(borrowingRate);
          },
          value: makeVar(defaultFieldValue),
          lastFetched: 0,
          timeout: 1000 * 2,
          periodic: 1000 * 30,
        },
  
        decimals: {
          fetch: async (collTokenContract: ERC20) => {
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].decimals.lastFetched = Date.now();
  
            const decimals = await collTokenContract.decimals();
  
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].decimals.value(Number(decimals) as any);
          },
          value: makeVar(Number(defaultFieldValue) as any),
          lastFetched: 0,
          timeout: 1000 * 3600,
        },
  
        walletAmount: {
          fetch: async (collTokenContract: ERC20, depositor: AddressLike) => {
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].walletAmount.lastFetched = Date.now();
  
            const walletAmount = await collTokenContract.balanceOf(depositor);
  
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].walletAmount.value(walletAmount);
          },
          value: makeVar(defaultFieldValue),
          lastFetched: 0,
          timeout: 1000 * 2,
          periodic: 1000 * 30,
        },
  
        troveLockedAmount: {
          fetch: async (fetchSource?: { troveManagerContract: TroveManager; borrower: AddressLike }) => {
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].troveLockedAmount.lastFetched = Date.now();
  
            if (fetchSource) {
              await ContractDataFreshnessManager.TroveManager.getTroveWithdrawableColls.fetch(
                fetchSource.troveManagerContract,
                fetchSource.borrower,
              );
            }
  
            const tokenAmount = ContractDataFreshnessManager.TroveManager.getTroveWithdrawableColls.value.find(
              ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts.ERC20.${tokenName}),
            )?.amount;
            if (tokenAmount) {
              SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].troveLockedAmount.value(tokenAmount);
            }
          },
          value: makeVar(defaultFieldValue),
          lastFetched: 0,
          timeout: 1000 * 2,
          periodic: 1000 * 30,
        },
  
        stabilityGainedAmount: {
          fetch: async (fetchSource?: { stabilityPoolManagerContract: StabilityPoolManager; depositor: AddressLike }) => {
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].stabilityGainedAmount.lastFetched = Date.now();
  
            if (fetchSource) {
              await ContractDataFreshnessManager.StabilityPoolManager.getDepositorCollGains.fetch(
                fetchSource.stabilityPoolManagerContract,
                fetchSource.depositor,
              );
            }
  
            const tokenAmount = ContractDataFreshnessManager.StabilityPoolManager.getDepositorCollGains.value.find(
              ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts.ERC20.${tokenName}),
            )?.amount;
            if (tokenAmount) {
              SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].stabilityGainedAmount.value(tokenAmount);
            }
          },
          value: makeVar(defaultFieldValue),
          lastFetched: 0,
          timeout: 1000 * 2,
          periodic: 1000 * 30,
        },
  
        collSurplusAmount: {
          fetch: async (fetchSource?: { collSurplusContract: CollSurplusPool; depositor: AddressLike }) => {
            SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].collSurplusAmount.lastFetched = Date.now();
  
            if (fetchSource) {
              await ContractDataFreshnessManager.CollSurplusPool.getCollateral.fetch(
                fetchSource.collSurplusContract,
                fetchSource.depositor,
              );
            }
  
            const tokenAmount = ContractDataFreshnessManager.CollSurplusPool.getCollateral.value.find(
              ({ tokenAddress }) => getCheckSum(tokenAddress) === getCheckSum(Contracts.ERC20.${tokenName}),
            )?.amount;
            if (tokenAmount) {
              SchemaDataFreshnessManager.ERC20[Contracts.ERC20.${tokenName}].collSurplusAmount.value(tokenAmount);
            }
          },
          value: makeVar(defaultFieldValue),
          lastFetched: 0,
          timeout: 1000 * 2,
          periodic: 1000 * 30,
        },
      },
}

export default ERC20_${tokenName};
`;
};

const generateSwapPairTemplate = (pairName, tokenAddress) => {
  return `
  import { makeVar } from "@apollo/client";
  import { AddressLike } from "ethers";
  import { Contracts } from "../../../config";
  import { SwapPair } from "../../../generated/types";
  import { SchemaDataFreshnessManager } from "../CustomApolloProvider";
  
  const defaultFieldValue = BigInt(0);

  const SwapPairs_${pairName} = {
    [Contracts.SwapPairs.${pairName}]: {
        borrowerAmount: {
          fetch: async (swapPairContract: SwapPair, borrower: AddressLike) => {
            SchemaDataFreshnessManager.SwapPairs[Contracts.SwapPairs.${pairName}].borrowerAmount.lastFetched = Date.now();
  
            const userPoolBalance = await stakingOperationsContract.balanceOf(swapPair, borrower);
  
            SchemaDataFreshnessManager.SwapPairs[Contracts.SwapPairs.${pairName}].borrowerAmount.value(userPoolBalance);
          },
          value: makeVar(defaultFieldValue),
          lastFetched: 0,
          timeout: 1000 * 2,
          periodic: 1000 * 30,
        },
        swapFee: {
          fetch: async (swapPairContract: SwapPair, reserve0: bigint, reserve1: bigint) => {
            SchemaDataFreshnessManager.SwapPairs[Contracts.SwapPairs.${pairName}].swapFee.lastFetched = Date.now();
  
            const swapFee = await swapPairContract.getSwapFee(reserve0, reserve1);
  
            SchemaDataFreshnessManager.SwapPairs[Contracts.SwapPairs.${pairName}].swapFee.value(swapFee);
          },
          value: makeVar(defaultFieldValue),
          lastFetched: 0,
          timeout: 1000 * 2
        },
      },
}

export default SwapPairs_${pairName};
`;
};

// Iterate over each DebtToken and generate a template file
Object.entries(Contracts.DebtToken).forEach(([tokenName, tokenAddress]) => {
  const template = generateDebtTokenTemplate(tokenName, tokenAddress);
  const filePath = path.join(outputDirectory, `DebtToken_${tokenName}.policy.ts`);

  fs.writeFileSync(filePath, template, 'utf-8');
  console.log(`Template for ${tokenName} saved to ${filePath}`);
});
// Iterate over each CollToken and generate a template file
Object.entries(Contracts.ERC20).forEach(([tokenName, tokenAddress]) => {
  const template = generateCollTokenTemplate(tokenName, tokenAddress);
  const filePath = path.join(outputDirectory, `ERC20_${tokenName}.policy.ts`);

  fs.writeFileSync(filePath, template, 'utf-8');
  console.log(`Template for ${tokenName} saved to ${filePath}`);
});
// Iterate over each SwapPair and generate a template file
Object.entries(Contracts.SwapPairs).forEach(([tokenName, tokenAddress]) => {
  const template = generateSwapPairTemplate(tokenName, tokenAddress);
  const filePath = path.join(outputDirectory, `SwapPairs_${tokenName}.policy.ts`);

  fs.writeFileSync(filePath, template, 'utf-8');
  console.log(`Template for ${tokenName} saved to ${filePath}`);
});

// Directory where the policy files will be saved
const policyDirectory = './typePolicies/';
// TODO: This is the important part. Specify the network name here
const targetFilePath = 'app/context/chainManagers/localhost.ts';

// Step 1: Generate Import Statements
const generateImportStatements = () => {
  let importStatements = '// GENERATED IMPORT CODE START - DO NOT EDIT THIS SECTION MANUALLY\n';
  Object.keys(Contracts.DebtToken).forEach((key) => {
    const policyName = `DebtToken_${key}`;
    importStatements += `import ${policyName} from '${policyDirectory}${policyName}.policy';\n`;
  });
  Object.keys(Contracts.ERC20).forEach((key) => {
    const policyName = `ERC20_${key}`;
    importStatements += `import ${policyName} from '${policyDirectory}${policyName}.policy';\n`;
  });
  Object.keys(Contracts.SwapPairs).forEach((key) => {
    const policyName = `SwapPairs_${key}`;
    importStatements += `import ${policyName} from '${policyDirectory}${policyName}.policy';\n`;
  });
  importStatements += '// GENERATED IMPORT CODE END\n';
  return importStatements;
};

// Step 2: Generate Code Block to Insert
const generateCodeBlock = () => {
  let codeBlock = '  // GENERATED CODE START - DO NOT EDIT THIS SECTION MANUALLY\n';
  Object.keys(Contracts)
    .filter((key) => key === 'DebtToken' || key === 'ERC20' || key === 'SwapPairs')
    .forEach((key) => {
      codeBlock += `  ${key}: {\n`;
      Object.keys(Contracts[key]).forEach((token) => {
        const policyName = `${key}_${token}`;
        codeBlock += `    ...${policyName},\n`;
      });
      codeBlock += '  },\n\n';
    });
  codeBlock += '  // GENERATED CODE END\n';
  return codeBlock;
};

// Step 3: Read, Modify, and Write the File
const updateTargetFile = (imports, codeBlock) => {
  const fileContent = fs.readFileSync(targetFilePath, 'utf-8');
  const replacedImports = fileContent.replace(
    /\/\/ GENERATED IMPORT CODE START[\s\S]*?\/\/ GENERATED IMPORT CODE END/g,
    imports,
  );
  const replacedCodeBlock = replacedImports.replace(
    /\/\/ GENERATED CODE START[\s\S]*?\/\/ GENERATED CODE END/g,
    codeBlock,
  );
  fs.writeFileSync(targetFilePath, replacedCodeBlock, 'utf-8');
};

const runUpdateProcess = () => {
  const imports = generateImportStatements();
  const codeBlock = generateCodeBlock();
  updateTargetFile(imports, codeBlock);
};

runUpdateProcess();
