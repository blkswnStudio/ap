'use client';

import { Button } from '@mui/material';
import { Contract, JsonRpcSigner, Network } from 'ethers';
import { BrowserProvider, Eip1193Provider, JsonRpcProvider } from 'ethers/providers';
import Link from 'next/link';
import { useSnackbar } from 'notistack';
import { createContext, useContext, useEffect, useState } from 'react';
import { NETWORKS, defaultNetwork } from '../../config';
import {
  BorrowerOperations,
  CollSurplusPool,
  DebtToken,
  HintHelpers,
  MockERC20,
  PriceFeed,
  RedemptionOperations,
  SortedTroves,
  StabilityPoolManager,
  StakingOperations,
  StoragePool,
  SwapOperations,
  SwapPair,
  TroveManager,
} from '../../generated/types';
import { useErrorMonitoring } from './ErrorMonitoringContext';
import borrowerOperationsAbi from './abis/BorrowerOperations.json';
import collSurplusAbi from './abis/CollSurplusPool.json';
import debtTokenAbi from './abis/DebtToken.json';
import hintHelpersAbi from './abis/HintHelpers.json';
import ERC20Abi from './abis/MockERC20.json';
import priceFeedAbi from './abis/PriceFeed.json';
import redemptionOperationsAbi from './abis/RedemptionOperations.json';
import sortedTrovesAbi from './abis/SortedTroves.json';
import stabilityPoolManagerAbi from './abis/StabilityPoolManager.json';
import stakingOperationsAbi from './abis/StakingOperations.json';
import storagePoolAbi from './abis/StoragePool.json';
import swapOperationsAbi from './abis/SwapOperations.json';
import swapPairAbi from './abis/SwapPair.json';
import troveManagerAbi from './abis/TroveManager.json';

declare global {
  interface Window {
    ethereum?: BrowserProvider & Eip1193Provider;
  }
}

type AllDebtTokenContracts = {
  [Key in (typeof NETWORKS)[number]['contracts']['DebtToken'][keyof (typeof NETWORKS)[number]['contracts']['DebtToken']]]: DebtToken;
};
type AllCollateralTokenContracts = {
  [Key in (typeof NETWORKS)[0]['contracts']['ERC20'][keyof (typeof NETWORKS)[0]['contracts']['ERC20']]]: MockERC20;
};
type AllSwapPairContracts = {
  [Key in (typeof NETWORKS)[number]['contracts']['SwapPairs'][keyof (typeof NETWORKS)[number]['contracts']['SwapPairs']]]: SwapPair;
};

export const EthersContext = createContext<{
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  currentNetwork: typeof defaultNetwork | null;
  address: string;
  contracts: {
    debtTokenContracts: AllDebtTokenContracts;
    collateralTokenContracts: AllCollateralTokenContracts;
    troveManagerContract: TroveManager;
    stabilityPoolManagerContract: StabilityPoolManager;
    swapOperationsContract: SwapOperations;
    swapPairContracts: AllSwapPairContracts;
    borrowerOperationsContract: BorrowerOperations;
    storagePoolContract: StoragePool;
    sortedTrovesContract: SortedTroves;
    hintHelpersContract: HintHelpers;
    priceFeedContract: PriceFeed;
    redemptionOperationsContract: RedemptionOperations;
    collSurplusContract: CollSurplusPool;
    stakingOperationsContract: StakingOperations;
  };
  connectWallet: () => void;
  setCurrentNetwork: (network: (typeof NETWORKS)[0] | null) => void;
}>({
  provider: null,
  signer: null,
  currentNetwork: null,
  address: '',
  contracts: {
    debtTokenContracts: undefined,
    collateralTokenContracts: undefined,
    troveManagerContract: undefined,
    stabilityPoolManagerContract: undefined,
    swapOperationsContract: undefined,
    swapPairContracts: undefined,
    borrowerOperationsContract: undefined,
    storagePoolContract: undefined,
    sortedTrovesContract: undefined,
    hintHelpersContract: undefined,
    priceFeedContract: undefined,
    redemptionOperationsContract: undefined,
    collSurplusContract: undefined,
    stakingOperationsContract: undefined,
  } as any,
  connectWallet: () => {},
  setCurrentNetwork: () => {},
});

export default function EthersProvider({ children }: { children: React.ReactNode }) {
  const { Sentry } = useErrorMonitoring();
  const { enqueueSnackbar } = useSnackbar();
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [currentNetwork, setCurrentNetwork] = useState<(typeof NETWORKS)[0] | null>(null);
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [address, setAddress] = useState<string>('');
  const [debtTokenContracts, setDebtTokenContracts] = useState<AllDebtTokenContracts>();
  const [collateralTokenContracts, setCollateralTokenContracts] = useState<AllCollateralTokenContracts>();
  const [troveManagerContract, setTroveManagerContract] = useState<TroveManager>();
  const [stabilityPoolManagerContract, setStabilityPoolManagerContract] = useState<StabilityPoolManager>();
  const [swapOperationsContract, setSwapOperationsContract] = useState<SwapOperations>();
  const [swapPairContracts, setSwapPairContracts] = useState<AllSwapPairContracts>();
  const [borrowerOperationsContract, setBorrowerOperationsContract] = useState<BorrowerOperations>();
  const [storagePoolContract, setStoragePoolContract] = useState<StoragePool>();
  const [sortedTrovesContract, setSortedTrovesContract] = useState<SortedTroves>();
  const [hintHelpersContract, setHintHelpersContract] = useState<HintHelpers>();
  const [priceFeedContract, setPriceFeedContract] = useState<PriceFeed>();
  const [redemptionOperationsContract, setRedemptionOperationsContract] = useState<RedemptionOperations>();
  const [collSurplusContract, setCollSurplusContract] = useState<CollSurplusPool>();
  const [stakingOperationsContract, setStakingOperationsContract] = useState<StakingOperations>();

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum !== 'undefined' && currentNetwork) {
        // Opens Meta Mask
        const newSigner = await provider!.getSigner();
        setSigner(newSigner);

        const debtTokenContractStable = new Contract(currentNetwork.contracts.DebtToken.STABLE, debtTokenAbi, provider);
        const debtTokenContractStableWithSigner = debtTokenContractStable.connect(newSigner) as DebtToken;
        const debtTokenContractSTOCK_1 = new Contract(
          currentNetwork.contracts.DebtToken.STOCK_1,
          debtTokenAbi,
          provider,
        );
        const debtTokenContractSTOCK_1WithSigner = debtTokenContractSTOCK_1.connect(newSigner) as DebtToken;
        const debtTokenContractSTOCK_2 = new Contract(
          currentNetwork.contracts.DebtToken.STOCK_2,
          debtTokenAbi,
          provider,
        );
        const debtTokenContractSTOCK_2WithSigner = debtTokenContractSTOCK_2.connect(newSigner) as DebtToken;
        setDebtTokenContracts({
          [currentNetwork.contracts.DebtToken.STABLE]: debtTokenContractStableWithSigner,
          [currentNetwork.contracts.DebtToken.STOCK_1]: debtTokenContractSTOCK_1WithSigner,
          [currentNetwork.contracts.DebtToken.STOCK_2]: debtTokenContractSTOCK_2WithSigner,
        } as any);
        const collateralTokenContractUSDT = new Contract(currentNetwork.contracts.ERC20.USDT, ERC20Abi, provider);
        const collateralTokenContractWithSignerUSDT = collateralTokenContractUSDT.connect(newSigner) as MockERC20;
        const collateralTokenContractBTC = new Contract(currentNetwork.contracts.ERC20.BTC, ERC20Abi, provider);
        const collateralTokenContractWithSignerBTC = collateralTokenContractBTC.connect(newSigner) as MockERC20;
        const collateralTokenContractDFI = new Contract(currentNetwork.contracts.ERC20.GOV, ERC20Abi, provider);
        const collateralTokenContractWithSignerDFI = collateralTokenContractDFI.connect(newSigner) as MockERC20;
        setCollateralTokenContracts({
          [currentNetwork.contracts.ERC20.USDT]: collateralTokenContractWithSignerUSDT,
          [currentNetwork.contracts.ERC20.BTC]: collateralTokenContractWithSignerBTC,
          [currentNetwork.contracts.ERC20.GOV]: collateralTokenContractWithSignerDFI,
        } as any);

        const troveManagerContract = new Contract(
          currentNetwork.contracts.TroveManager,
          troveManagerAbi,
          provider,
        ) as unknown as TroveManager;
        const troveManagerContractWithSigner = troveManagerContract.connect(newSigner);
        setTroveManagerContract(troveManagerContractWithSigner);

        const stabilityPoolManagerContract = new Contract(
          currentNetwork.contracts.StabilityPoolManager,
          stabilityPoolManagerAbi,
          provider,
        ) as unknown as StabilityPoolManager;
        const stabilityPoolManagerContractWithSigner = stabilityPoolManagerContract.connect(newSigner);
        setStabilityPoolManagerContract(stabilityPoolManagerContractWithSigner);

        const swapOperationsContract = new Contract(
          currentNetwork.contracts.SwapOperations,
          swapOperationsAbi,
          provider,
        ) as unknown as SwapOperations;
        const swapOperationsContractWithSigner = swapOperationsContract.connect(newSigner);
        setSwapOperationsContract(swapOperationsContractWithSigner);

        const swapPairContractBTC = new Contract(currentNetwork.contracts.SwapPairs.BTC, swapPairAbi, provider);
        const swapPairContractBTCWithSigner = swapPairContractBTC.connect(newSigner) as SwapPair;
        const swapPairContractUSDT = new Contract(currentNetwork.contracts.SwapPairs.USDT, swapPairAbi, provider);
        const swapPairContractUSDTWithSigner = swapPairContractUSDT.connect(newSigner) as SwapPair;
        const swapPairContractGOV = new Contract(currentNetwork.contracts.SwapPairs.GOV, swapPairAbi, provider);
        const swapPairContractGOVWithSigner = swapPairContractGOV.connect(newSigner) as SwapPair;

        const swapPairContractSTOCK = new Contract(currentNetwork.contracts.SwapPairs.STOCK_1, swapPairAbi, provider);
        const swapPairContractSTOCKWithSigner = swapPairContractSTOCK.connect(newSigner) as SwapPair;
        const swapPairContractSTOCK2 = new Contract(currentNetwork.contracts.SwapPairs.STOCK_2, swapPairAbi, provider);
        const swapPairContractSTOCK2WithSigner = swapPairContractSTOCK2.connect(newSigner) as SwapPair;
        setSwapPairContracts({
          [currentNetwork.contracts.SwapPairs.BTC]: swapPairContractBTCWithSigner,
          [currentNetwork.contracts.SwapPairs.USDT]: swapPairContractUSDTWithSigner,
          [currentNetwork.contracts.SwapPairs.GOV]: swapPairContractGOVWithSigner,
          [currentNetwork.contracts.SwapPairs.STOCK_1]: swapPairContractSTOCKWithSigner,
          [currentNetwork.contracts.SwapPairs.STOCK_2]: swapPairContractSTOCK2WithSigner,
        } as any);

        const borrowerOperationsContract = new Contract(
          currentNetwork.contracts.BorrowerOperations,
          borrowerOperationsAbi,
          provider,
        );
        const borrowerOperationsContractWithSigner = borrowerOperationsContract.connect(
          newSigner,
        ) as BorrowerOperations;
        setBorrowerOperationsContract(borrowerOperationsContractWithSigner);

        const storagePoolContract = new Contract(currentNetwork.contracts.StoragePool, storagePoolAbi, provider);
        const storagePoolContractWithSigner = storagePoolContract.connect(newSigner) as StoragePool;
        setStoragePoolContract(storagePoolContractWithSigner);

        const sortedTrovesContract = new Contract(currentNetwork.contracts.SortedTroves, sortedTrovesAbi, provider);
        const sortedTrovesContractWithSigner = sortedTrovesContract.connect(newSigner) as SortedTroves;
        setSortedTrovesContract(sortedTrovesContractWithSigner);

        const hintHelpersContract = new Contract(currentNetwork.contracts.HintHelpers, hintHelpersAbi, provider);
        const hintHelpersContractWithSigner = hintHelpersContract.connect(newSigner) as HintHelpers;
        setHintHelpersContract(hintHelpersContractWithSigner);

        const priceFeedContract = new Contract(currentNetwork.contracts.PriceFeed, priceFeedAbi, provider);
        const priceFeedContractWithSigner = priceFeedContract.connect(newSigner) as PriceFeed;
        setPriceFeedContract(priceFeedContractWithSigner);

        const redemptionOperationsContract = new Contract(
          currentNetwork.contracts.RedemptionOperations,
          redemptionOperationsAbi,
          provider,
        );
        const redemptionOperationsContractWithSigner = redemptionOperationsContract.connect(
          newSigner,
        ) as RedemptionOperations;
        setRedemptionOperationsContract(redemptionOperationsContractWithSigner);

        const collSurplusContract = new Contract(currentNetwork.contracts.CollSurplus, collSurplusAbi, provider);
        const collSurplusContractWithSigner = collSurplusContract.connect(newSigner) as CollSurplusPool;
        setCollSurplusContract(collSurplusContractWithSigner);

        const stakingOperationsContract = new Contract(
          currentNetwork.contracts.StakingOperations,
          stakingOperationsAbi,
          provider,
        );
        const stakingOperationsContractWithSigner = stakingOperationsContract.connect(newSigner) as StakingOperations;
        setStakingOperationsContract(stakingOperationsContractWithSigner);

        try {
          // Request account access
          const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts',
          });
          setAddress(accounts[0]);
          Sentry.setUser({
            id: accounts[0],
          });
        } catch (error) {
          Sentry.captureException(error);
          console.error('eth_requestAccounts error: ', error);
          enqueueSnackbar('You rejected necessary permissions. Please try again.', { variant: 'error' });
        }
      } else {
        // Handle if user doesnt have MM installed
        enqueueSnackbar(
          'MetaMask extension is not installed. The extension is required to interact with the application. Please install and reload the page.',
          {
            variant: 'error',
            action: (
              <Button
                LinkComponent={Link}
                href="https://metamask.io/"
                variant="contained"
                target="_blank"
                rel="noreferrer"
              >
                Install
              </Button>
            ),
            autoHideDuration: 20000,
          },
        );
      }
    } catch (error) {
      Sentry.captureException(error);
      console.error('connectWallet error: ', error);
      enqueueSnackbar('You closed the authentication window. Please try loging in again.', { variant: 'error' });
    }
  };

  function updateProvider(network: (typeof NETWORKS)[number]) {
    if (typeof window.ethereum !== 'undefined') {
      // const newProvider = new BrowserProvider(network.rpcUrls[0], {
      //   name: network.chainName,
      //   chainId: network.chainIdNumber,
      // });
      const mmNetwork = new Network(network.chainName, network.chainId);
      const newProvider = new BrowserProvider(window.ethereum, mmNetwork);

      setProvider(newProvider);
    }
  }

  // Initialize the correct provider
  useEffect(() => {
    if (typeof window.ethereum !== 'undefined' && provider === null) {
      window.ethereum
        .request({ method: 'eth_chainId' })
        .then((chainIdHex) => {
          const initNetwork = NETWORKS.find((network) => network.chainId === chainIdHex);
          if (initNetwork) {
            setCurrentNetwork(initNetwork as any);
            updateProvider(initNetwork);
          }
          // Could not find network in the list => add it
          else {
            const { blockExplorerUrls, chainId, chainName, nativeCurrency, rpcUrls } = defaultNetwork;

            window
              .ethereum!.request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    // All params must be provided to make it work
                    chainId,
                    rpcUrls,
                    chainName,
                    nativeCurrency,
                    blockExplorerUrls,
                  },
                ],
              })
              .then(() => {
                window.location.reload();
                // updateProvider(choosenNetwork)
              })
              .catch((error) => {
                console.error('wallet_addEthereumChain error: ', error);
              });
          }
        })
        .catch((error) => {
          Sentry.captureException(error);
        });
    } else if (typeof window.ethereum === 'undefined') {
      Sentry.captureException('MetaMask extension is not installed. Please install and try again.');
      enqueueSnackbar(
        'MetaMask extension is not installed. The extension is required to interact with the application. Please install and reload the page.',
        {
          variant: 'error',
          action: (
            <Button
              LinkComponent={Link}
              href="https://metamask.io/"
              variant="contained"
              target="_blank"
              rel="noreferrer"
            >
              Install
            </Button>
          ),
          autoHideDuration: 20000,
        },
      );

      // Load the default network over the RPC provider and disable basic wallet interaction.
      const network = new Network(defaultNetwork.chainName, defaultNetwork.chainId);

      const fallbackProvider = new JsonRpcProvider(defaultNetwork.rpcUrls[0], network);
      setCurrentNetwork(defaultNetwork);
      setProvider(fallbackProvider as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined' && provider) {
      // Log in automaticall if we know the user already.
      window.ethereum
        .request({ method: 'eth_accounts' })
        .then((accounts) => {
          if (accounts.length > 0) {
            connectWallet();
          }
        })
        .catch((error) => {
          Sentry.captureException(error);
        });

      window.ethereum.on('accountsChanged', connectWallet);
    }

    // Cleanup the listener when the component unmounts
    return () => {
      if (typeof window.ethereum !== 'undefined') {
        window.ethereum.removeListener('accountsChanged', connectWallet);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  // This use effect initializes the contracts to do initial read operations.
  useEffect(() => {
    if (provider && currentNetwork) {
      try {
        const debtTokenContractSTABLE = new Contract(
          currentNetwork.contracts.DebtToken.STABLE,
          debtTokenAbi,
          provider,
        ) as unknown as DebtToken;
        const debtTokenContractSTOCK_1 = new Contract(
          currentNetwork.contracts.DebtToken.STOCK_1,
          debtTokenAbi,
          provider,
        ) as unknown as DebtToken;
        const debtTokenContractSTOCK_2 = new Contract(
          currentNetwork.contracts.DebtToken.STOCK_2,
          debtTokenAbi,
          provider,
        ) as unknown as DebtToken;
        setDebtTokenContracts({
          [currentNetwork.contracts.DebtToken.STABLE]: debtTokenContractSTABLE,
          [currentNetwork.contracts.DebtToken.STOCK_1]: debtTokenContractSTOCK_1,
          [currentNetwork.contracts.DebtToken.STOCK_2]: debtTokenContractSTOCK_2,
        } as any);

        const collateralTokenContractUSDT = new Contract(
          currentNetwork.contracts.ERC20.USDT,
          ERC20Abi,
          provider,
        ) as unknown as MockERC20;
        const collateralTokenContractBTC = new Contract(
          currentNetwork.contracts.ERC20.BTC,
          ERC20Abi,
          provider,
        ) as unknown as MockERC20;
        const collateralTokenContractGOV = new Contract(
          currentNetwork.contracts.ERC20.GOV,
          ERC20Abi,
          provider,
        ) as unknown as MockERC20;
        const collateralTokenContractSTABLE = new Contract(
          currentNetwork.contracts.ERC20.STABLE,
          ERC20Abi,
          provider,
        ) as unknown as MockERC20;
        const collateralTokenContractSTOCK_1 = new Contract(
          currentNetwork.contracts.ERC20.STOCK_1,
          ERC20Abi,
          provider,
        ) as unknown as MockERC20;
        const collateralTokenContractSTOCK_2 = new Contract(
          currentNetwork.contracts.ERC20.STOCK_2,
          ERC20Abi,
          provider,
        ) as unknown as MockERC20;
        setCollateralTokenContracts({
          [currentNetwork.contracts.ERC20.USDT]: collateralTokenContractUSDT,
          [currentNetwork.contracts.ERC20.BTC]: collateralTokenContractBTC,
          [currentNetwork.contracts.ERC20.GOV]: collateralTokenContractGOV,
          [currentNetwork.contracts.ERC20.STABLE]: collateralTokenContractSTABLE,
          [currentNetwork.contracts.ERC20.STOCK_1]: collateralTokenContractSTOCK_1,
          [currentNetwork.contracts.ERC20.STOCK_2]: collateralTokenContractSTOCK_2,
        } as any);

        const troveManagerContract = new Contract(
          currentNetwork.contracts.TroveManager,
          troveManagerAbi,
          provider,
        ) as unknown as TroveManager;
        setTroveManagerContract(troveManagerContract);

        const stabilityPoolManagerContract = new Contract(
          currentNetwork.contracts.StabilityPoolManager,
          stabilityPoolManagerAbi,
          provider,
        ) as unknown as StabilityPoolManager;
        setStabilityPoolManagerContract(stabilityPoolManagerContract);

        const swapOperationsContract = new Contract(
          currentNetwork.contracts.SwapOperations,
          swapOperationsAbi,
          provider,
        ) as unknown as SwapOperations;
        setSwapOperationsContract(swapOperationsContract);

        const swapPairContractBTC = new Contract(
          currentNetwork.contracts.SwapPairs.BTC,
          swapPairAbi,
          provider,
        ) as unknown as SwapPair;
        const swapPairContractUSDT = new Contract(
          currentNetwork.contracts.SwapPairs.USDT,
          swapPairAbi,
          provider,
        ) as unknown as SwapPair;
        const swapPairContractGOV = new Contract(
          currentNetwork.contracts.SwapPairs.GOV,
          swapPairAbi,
          provider,
        ) as unknown as SwapPair;

        const swapPairContractSTOCK = new Contract(
          currentNetwork.contracts.SwapPairs.STOCK_1,
          swapPairAbi,
          provider,
        ) as unknown as SwapPair;
        const swapPairContractSTOCK_2 = new Contract(
          currentNetwork.contracts.SwapPairs.STOCK_2,
          swapPairAbi,
          provider,
        ) as unknown as SwapPair;
        setSwapPairContracts({
          [currentNetwork.contracts.SwapPairs.BTC]: swapPairContractBTC,
          [currentNetwork.contracts.SwapPairs.USDT]: swapPairContractUSDT,
          [currentNetwork.contracts.SwapPairs.GOV]: swapPairContractGOV,
          [currentNetwork.contracts.SwapPairs.STOCK_1]: swapPairContractSTOCK,
          [currentNetwork.contracts.SwapPairs.STOCK_2]: swapPairContractSTOCK_2,
        } as any);

        const borrowerOperationsContract = new Contract(
          currentNetwork.contracts.BorrowerOperations,
          borrowerOperationsAbi,
          provider,
        ) as unknown as BorrowerOperations;
        setBorrowerOperationsContract(borrowerOperationsContract);

        const storagePoolContract = new Contract(
          currentNetwork.contracts.StoragePool,
          storagePoolAbi,
          provider,
        ) as unknown as StoragePool;
        setStoragePoolContract(storagePoolContract);

        const sortedTrovesContract = new Contract(
          currentNetwork.contracts.SortedTroves,
          sortedTrovesAbi,
          provider,
        ) as unknown as SortedTroves;
        setSortedTrovesContract(sortedTrovesContract);

        const hintHelpersContract = new Contract(
          currentNetwork.contracts.HintHelpers,
          hintHelpersAbi,
          provider,
        ) as unknown as HintHelpers;
        setHintHelpersContract(hintHelpersContract);

        const priceFeedContract = new Contract(
          currentNetwork.contracts.PriceFeed,
          priceFeedAbi,
          provider,
        ) as unknown as PriceFeed;
        setPriceFeedContract(priceFeedContract);

        const redemptionOperationsContract = new Contract(
          currentNetwork.contracts.RedemptionOperations,
          redemptionOperationsAbi,
          provider,
        ) as unknown as RedemptionOperations;
        setRedemptionOperationsContract(redemptionOperationsContract);

        const collSurplusContract = new Contract(
          currentNetwork.contracts.CollSurplus,
          collSurplusAbi,
          provider,
        ) as unknown as CollSurplusPool;
        setCollSurplusContract(collSurplusContract);

        const stakingOperationsContract = new Contract(
          currentNetwork.contracts.StakingOperations,
          stakingOperationsAbi,
          provider,
        ) as unknown as StakingOperations;
        setStakingOperationsContract(stakingOperationsContract);
      } catch (error) {
        Sentry.captureException(error);
        console.error(error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, currentNetwork]);

  if (
    // TODO: Handle where MM is not installed
    !provider ||
    !currentNetwork ||
    !debtTokenContracts ||
    !collateralTokenContracts ||
    !troveManagerContract ||
    !stabilityPoolManagerContract ||
    !swapOperationsContract ||
    !swapPairContracts ||
    !borrowerOperationsContract ||
    !storagePoolContract ||
    !sortedTrovesContract ||
    !hintHelpersContract ||
    !priceFeedContract ||
    !redemptionOperationsContract ||
    !collSurplusContract ||
    !stakingOperationsContract
  )
    return null;

  return (
    <EthersContext.Provider
      value={{
        provider,
        signer,
        currentNetwork: currentNetwork as typeof defaultNetwork,
        address,
        connectWallet,
        setCurrentNetwork,
        contracts: {
          debtTokenContracts,
          collateralTokenContracts,
          troveManagerContract,
          stabilityPoolManagerContract,
          swapOperationsContract,
          swapPairContracts,
          borrowerOperationsContract,
          storagePoolContract,
          sortedTrovesContract,
          hintHelpersContract,
          priceFeedContract,
          redemptionOperationsContract,
          collSurplusContract,
          stakingOperationsContract,
        },
      }}
    >
      {children}
    </EthersContext.Provider>
  );
}

export function useEthers(): {
  provider: BrowserProvider | null;
  signer: JsonRpcSigner | null;
  currentNetwork: typeof defaultNetwork | null;
  address: string;
  contracts: {
    debtTokenContracts: AllDebtTokenContracts;
    collateralTokenContracts: AllCollateralTokenContracts;
    troveManagerContract: TroveManager;
    stabilityPoolManagerContract: StabilityPoolManager;
    swapOperationsContract: SwapOperations;
    swapPairContracts: AllSwapPairContracts;
    borrowerOperationsContract: BorrowerOperations;
    storagePoolContract: StoragePool;
    sortedTrovesContract: SortedTroves;
    hintHelpersContract: HintHelpers;
    priceFeedContract: PriceFeed;
    redemptionOperationsContract: RedemptionOperations;
    collSurplusContract: CollSurplusPool;
    stakingOperationsContract: StakingOperations;
  };
  connectWallet: () => void;
  setCurrentNetwork: (network: (typeof NETWORKS)[0] | null) => void;
} {
  const context = useContext(EthersContext);
  if (context === undefined) {
    throw new Error('useEthers must be used within an EthersProvider');
  }
  return context;
}
