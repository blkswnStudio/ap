import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  ReactiveVar,
  Reference,
  TypePolicies,
  TypePolicy,
} from '@apollo/client';
import { AddressLike } from 'ethers';
import { PropsWithChildren, useEffect, useMemo } from 'react';
import {
  Contracts_ATC,
  Contracts_Localhost,
  isCollateralTokenAddress,
  isDebtTokenAddress,
  isPoolAddress,
} from '../../config';
import {
  LiquidityFragmentFragment,
  RedemptionOperations,
  SystemInfo,
  TokenFragmentFragment,
} from '../generated/gql-types';
import { LIQUIDITY_FRAGMENT, TOKEN_FRAGMENT } from '../queries';
import { CustomApolloProvider_DevMode } from './CustomApolloProvider_dev';
import { useErrorMonitoring } from './ErrorMonitoringContext';
import { useEthers } from './EthersProvider';
import PriceFeedDataProvider from './PriceFeedDataProvider';
import PriceFeedDataProvider_DevMode from './PriceFeedDataProvider_dev';
import { getActiveDataManger } from './utils';

export function CustomApolloProvider({ children }: PropsWithChildren<{}>) {
  const { Sentry } = useErrorMonitoring();
  const { provider, contracts, currentNetwork, address: borrower } = useEthers();
  const {
    debtTokenContracts,
    troveManagerContract,
    swapPairContracts,
    stabilityPoolManagerContract,
    storagePoolContract,
    collateralTokenContracts,
    priceFeedContract,
    collSurplusContract,
    redemptionOperationsContract,
    stakingOperationsContract,
    hintHelpersContract,
  } = contracts;

  useEffect(() => {
    const timers = new Set<NodeJS.Timer>();
    // Register all periodic updates that have been defined
    if (process.env.NEXT_PUBLIC_CONTRACT_MOCKING !== 'enabled' && borrower) {
      // Recursively go through object and if object contains a "periodic" property abort and set up interval

      Object.entries(activeDataManager).forEach(([contractType, collection]) => {
        Object.entries(collection).forEach(([fieldOrAddress, contract]) => {
          if ((contract as any).hasOwnProperty('periodic')) {
            const interval = setInterval(
              () => {
                const type = contractType;
                const contract = fieldOrAddress;

                if (
                  // @ts-ignore
                  isFieldOutdated(activeDataManager[type], contract)
                ) {
                  switch (type) {
                    case 'StoragePool':
                      switch (contract) {
                        case 'recoveryModeActive':
                        case 'totalCollateralRatio':
                          activeDataManager[type][contract].fetch({ storagePoolContract });
                          break;
                      }

                    case 'RedemptionOperations':
                      switch (contract) {
                        case 'redemptionRateWithDecay':
                          activeDataManager[type][contract].fetch(redemptionOperationsContract);
                          break;
                      }

                    case 'TroveManager':
                      switch (contract) {
                        case 'borrowerIMCR':
                          activeDataManager[type][contract].fetch({ borrower, hintHelpersContract });
                          break;

                        case 'borrowerICR':
                          activeDataManager[type][contract].fetch({ borrower, hintHelpersContract });
                          break;
                      }
                  }
                }
              },
              (contract as any).periodic,
            );
            timers.add(interval);
          } else {
            Object.entries(contract as any).forEach(([field, data]) => {
              if ((data as any).hasOwnProperty('periodic')) {
                const interval = setInterval(
                  () => {
                    const type = contractType;
                    const contract = fieldOrAddress;
                    const policy = field;

                    if (
                      // @ts-ignore
                      isFieldOutdated(activeDataManager[type][contract], policy)
                    ) {
                      switch (type) {
                        case 'DebtToken':
                          switch (policy) {
                            case 'priceUSDOracle':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch(undefined, priceFeedContract);
                              break;
                            case 'borrowingRate':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch(troveManagerContract);
                              break;
                            case 'walletAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch(
                                // @ts-ignore
                                debtTokenContracts[contract],
                                borrower,
                              );
                              break;
                            case 'troveMintedAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch({
                                troveManagerContract,
                                borrower,
                              });
                              break;
                            case 'troveDebtAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch({
                                troveManagerContract,
                                borrower,
                              });
                              break;
                            case 'troveRepableDebtAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch({
                                troveManagerContract,
                                borrower,
                              });
                              break;
                            case 'troveLockedAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch({
                                troveManagerContract,
                                borrower,
                              });
                              break;
                            case 'providedStability':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch({
                                stabilityPoolManagerContract,
                                depositor: borrower,
                              });
                              break;
                            case 'compoundedDeposit':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch({
                                stabilityPoolManagerContract,
                                depositor: borrower,
                              });
                              break;
                          }
                          break;

                        case 'ERC20':
                          switch (policy) {
                            case 'priceUSDOracle':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch(undefined, priceFeedContract);
                              break;
                            case 'borrowingRate':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch(troveManagerContract);
                              break;
                            case 'walletAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch(
                                // @ts-ignore
                                collateralTokenContracts[contract],
                                borrower,
                              );
                              break;
                            case 'troveLockedAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch({
                                troveManagerContract,
                                borrower,
                              });
                              break;
                            case 'stabilityGainedAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch({
                                stabilityPoolManagerContract,
                                depositor: borrower,
                              });
                              break;
                            case 'collSurplusAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch({
                                collSurplusContract,
                                depositor: borrower,
                              });
                              break;
                          }
                          break;

                        case 'SwapPairs':
                          switch (policy) {
                            case 'borrowerAmount':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch(
                                // @ts-ignore
                                contract,
                                stakingOperationsContract,
                                borrower,
                              );
                              break;
                            case 'pendingRewards':
                              // @ts-ignore
                              activeDataManager[type][contract][policy].fetch(
                                // @ts-ignore
                                stakingOperationsContract,
                                borrower,
                              );
                              break;
                            case 'swapFee':
                              Sentry.captureException(
                                `Unhandled pollling of policy ${Sentry.captureException(policy)}`,
                              );
                              console.error('We dont handle updating this for now.');
                              break;
                          }
                          break;
                      }
                    }
                  },
                  (data as any).periodic,
                );
                timers.add(interval);
              }
            });
          }
        });
      });
    }

    return () => {
      timers.forEach((timer) => clearInterval(timer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [borrower]);

  const activeDataManager = useMemo(() => getActiveDataManger(currentNetwork!), [currentNetwork]);

  const cacheConfig = useMemo(
    () =>
      getProductionCacheConfig({
        provider,
        borrower,
        debtTokenContracts,
        collateralTokenContracts,
        troveManagerContract,
        stabilityPoolManagerContract,
        swapPairContracts,
        storagePoolContract,
        collSurplusContract,
        redemptionOperationsContract,
        priceFeedContract,
        stakingOperationsContract,
        hintHelpersContract,
        SchemaDataFreshnessManager: activeDataManager as any,
      }),
    [
      provider,
      borrower,
      debtTokenContracts,
      collateralTokenContracts,
      troveManagerContract,
      stabilityPoolManagerContract,
      swapPairContracts,
      storagePoolContract,
      collSurplusContract,
      redemptionOperationsContract,
      priceFeedContract,
      stakingOperationsContract,
      activeDataManager,
      hintHelpersContract,
    ],
  );

  const client = useMemo(
    () =>
      new ApolloClient({
        uri: currentNetwork!.graphEndpoint,
        //@ts-ignore
        headers: {
          ...(currentNetwork!.authorizationHeader !== '' ? { authorization: currentNetwork!.authorizationHeader } : {}),
        },
        connectToDevTools: process.env.NEXT_PUBLIC_ENVIRONMENT === 'development',
        cache: new InMemoryCache({
          typePolicies: {
            ...cacheConfig.fields,

            Query: {
              fields: {
                ...cacheConfig.Query.fields,

                swapEvents: {
                  // Don't cache separate results based on
                  // any of this field's arguments.
                  keyArgs: [],
                  // Concatenate the incoming list items with
                  // the existing list items.
                  merge(existing = [], incoming) {
                    return [...existing, ...incoming];
                  },
                  read: (existing) => {
                    return existing;
                  },
                },

                borrowerHistories: {
                  // Don't cache separate results based on
                  // any of this field's arguments.
                  keyArgs: [],
                  // Concatenate the incoming list items with
                  // the existing list items.
                  merge(existing = [], incoming) {
                    return [...existing, ...incoming];
                  },
                  read: (existing) => {
                    return existing;
                  },
                },
              },
            },
          },
        }),
      }),
    [currentNetwork, cacheConfig],
  );

  if (process.env.NEXT_PUBLIC_CONTRACT_MOCKING === 'enabled') {
    return <CustomApolloProvider_DevMode>{children}</CustomApolloProvider_DevMode>;
  }

  // TODO: Respect MockPriceFeed env
  return (
    <ApolloProvider client={client}>
      {process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_ENVIRONMENT === 'development' ? (
        <PriceFeedDataProvider_DevMode>{children}</PriceFeedDataProvider_DevMode>
      ) : (
        <PriceFeedDataProvider>{children}</PriceFeedDataProvider>
      )}
    </ApolloProvider>
  );
}

const getProductionCacheConfig = ({
  provider,
  borrower,
  debtTokenContracts,
  collateralTokenContracts,
  troveManagerContract,
  stabilityPoolManagerContract,
  swapPairContracts,
  storagePoolContract,
  collSurplusContract,
  redemptionOperationsContract,
  priceFeedContract,
  stakingOperationsContract,
  hintHelpersContract,
  SchemaDataFreshnessManager,
}: {
  provider: ReturnType<typeof useEthers>['provider'];
  borrower: AddressLike;
  debtTokenContracts: ReturnType<typeof useEthers>['contracts']['debtTokenContracts'];
  collateralTokenContracts: ReturnType<typeof useEthers>['contracts']['collateralTokenContracts'];
  troveManagerContract: ReturnType<typeof useEthers>['contracts']['troveManagerContract'];
  stabilityPoolManagerContract: ReturnType<typeof useEthers>['contracts']['stabilityPoolManagerContract'];
  swapPairContracts: ReturnType<typeof useEthers>['contracts']['swapPairContracts'];
  storagePoolContract: ReturnType<typeof useEthers>['contracts']['storagePoolContract'];
  collSurplusContract: ReturnType<typeof useEthers>['contracts']['collSurplusContract'];
  redemptionOperationsContract: ReturnType<typeof useEthers>['contracts']['redemptionOperationsContract'];
  priceFeedContract: ReturnType<typeof useEthers>['contracts']['priceFeedContract'];
  stakingOperationsContract: ReturnType<typeof useEthers>['contracts']['stakingOperationsContract'];
  hintHelpersContract: ReturnType<typeof useEthers>['contracts']['hintHelpersContract'];
  SchemaDataFreshnessManager: ContractDataFreshnessManagerType<typeof Contracts_Localhost> &
    ContractDataFreshnessManagerType<typeof Contracts_ATC>;
}): { fields: TypePolicies; Query: TypePolicy } => ({
  fields: {
    Token: {
      fields: {
        priceUSDOracle: {
          read(_, { readField }) {
            const address = readField('address') as Readonly<string>;

            if (address) {
              if (isDebtTokenAddress(address)) {
                if (isFieldOutdated(SchemaDataFreshnessManager.DebtToken[address], 'priceUSDOracle')) {
                  SchemaDataFreshnessManager.DebtToken[address].priceUSDOracle.fetch(undefined, priceFeedContract);
                }

                return SchemaDataFreshnessManager.DebtToken[address].priceUSDOracle.value();
              } else if (isCollateralTokenAddress(address)) {
                if (isFieldOutdated(SchemaDataFreshnessManager.ERC20[address], 'priceUSDOracle')) {
                  SchemaDataFreshnessManager.ERC20[address].priceUSDOracle.fetch(undefined, priceFeedContract);
                }
                return SchemaDataFreshnessManager.ERC20[address].priceUSDOracle.value();
              }
            }
          },
        },

        borrowingRate: {
          read(_, { readField }) {
            const address = readField('address') as Readonly<string>;
            if (address) {
              if (isDebtTokenAddress(address)) {
                if (isFieldOutdated(SchemaDataFreshnessManager.DebtToken[address], 'borrowingRate')) {
                  SchemaDataFreshnessManager.DebtToken[address].borrowingRate.fetch(troveManagerContract);
                }
                return SchemaDataFreshnessManager.DebtToken[address].borrowingRate.value();
              } else if (isCollateralTokenAddress(address)) {
                if (isFieldOutdated(SchemaDataFreshnessManager.ERC20[address], 'borrowingRate')) {
                  SchemaDataFreshnessManager.ERC20[address].borrowingRate.fetch(troveManagerContract);
                }
                return SchemaDataFreshnessManager.ERC20[address].borrowingRate.value();
              }
            }
          },
        },
      },
    },

    DebtTokenMeta: {
      fields: {
        walletAmount: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isDebtTokenAddress(tokenData.address)) {
              if (
                isFieldOutdated(SchemaDataFreshnessManager.DebtToken[tokenData.address], 'walletAmount') &&
                borrower
              ) {
                SchemaDataFreshnessManager.DebtToken[tokenData.address].walletAmount.fetch(
                  debtTokenContracts[tokenData.address],
                  borrower,
                );
              }

              return SchemaDataFreshnessManager.DebtToken[tokenData.address].walletAmount.value();
            }
          },
        },

        troveMintedAmount: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isDebtTokenAddress(tokenData.address)) {
              if (
                isFieldOutdated(SchemaDataFreshnessManager.DebtToken[tokenData.address], 'troveMintedAmount') &&
                borrower
              ) {
                SchemaDataFreshnessManager.DebtToken[tokenData.address].troveMintedAmount.fetch({
                  troveManagerContract,
                  borrower,
                });
              }
              return SchemaDataFreshnessManager.DebtToken[tokenData.address].troveMintedAmount.value();
            }
          },
        },

        troveDebtAmount: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isDebtTokenAddress(tokenData.address)) {
              if (
                isFieldOutdated(SchemaDataFreshnessManager.DebtToken[tokenData.address], 'troveDebtAmount') &&
                borrower
              ) {
                SchemaDataFreshnessManager.DebtToken[tokenData.address].troveDebtAmount.fetch({
                  troveManagerContract,
                  borrower,
                });
              }
              return SchemaDataFreshnessManager.DebtToken[tokenData.address].troveDebtAmount.value();
            }
          },
        },

        troveRepableDebtAmount: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isDebtTokenAddress(tokenData.address)) {
              if (
                isFieldOutdated(SchemaDataFreshnessManager.DebtToken[tokenData.address], 'troveRepableDebtAmount') &&
                borrower
              ) {
                SchemaDataFreshnessManager.DebtToken[tokenData.address].troveRepableDebtAmount.fetch({
                  troveManagerContract,
                  borrower,
                });
              }
              return SchemaDataFreshnessManager.DebtToken[tokenData.address].troveRepableDebtAmount.value();
            }
          },
        },

        providedStability: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isDebtTokenAddress(tokenData.address)) {
              if (
                isFieldOutdated(SchemaDataFreshnessManager.DebtToken[tokenData.address], 'providedStability') &&
                borrower
              ) {
                SchemaDataFreshnessManager.DebtToken[tokenData.address].providedStability.fetch({
                  stabilityPoolManagerContract,
                  depositor: borrower,
                });
              }
              return SchemaDataFreshnessManager.DebtToken[tokenData.address].providedStability.value();
            }
          },
        },

        compoundedDeposit: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isDebtTokenAddress(tokenData.address)) {
              if (
                isFieldOutdated(SchemaDataFreshnessManager.DebtToken[tokenData.address], 'compoundedDeposit') &&
                borrower
              ) {
                SchemaDataFreshnessManager.DebtToken[tokenData.address].compoundedDeposit.fetch({
                  stabilityPoolManagerContract,
                  depositor: borrower,
                });
              }

              return SchemaDataFreshnessManager.DebtToken[tokenData.address].compoundedDeposit.value();
            }
          },
        },
      },
    },

    CollateralTokenMeta: {
      fields: {
        walletAmount: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isCollateralTokenAddress(tokenData.address)) {
              if (isFieldOutdated(SchemaDataFreshnessManager.ERC20[tokenData.address], 'walletAmount') && borrower) {
                SchemaDataFreshnessManager.ERC20[tokenData.address].walletAmount.fetch(
                  collateralTokenContracts[tokenData.address],
                  borrower,
                );
              }

              return SchemaDataFreshnessManager.ERC20[tokenData.address].walletAmount.value();
            }
          },
        },

        troveLockedAmount: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isCollateralTokenAddress(tokenData.address)) {
              if (
                isFieldOutdated(SchemaDataFreshnessManager.ERC20[tokenData.address], 'troveLockedAmount') &&
                borrower
              ) {
                SchemaDataFreshnessManager.ERC20[tokenData.address].troveLockedAmount.fetch({
                  troveManagerContract,
                  borrower,
                });
              }

              return SchemaDataFreshnessManager.ERC20[tokenData.address].troveLockedAmount.value();
            }
          },
        },

        stabilityGainedAmount: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isCollateralTokenAddress(tokenData.address)) {
              if (
                isFieldOutdated(SchemaDataFreshnessManager.ERC20[tokenData.address], 'stabilityGainedAmount') &&
                borrower
              ) {
                SchemaDataFreshnessManager.ERC20[tokenData.address].stabilityGainedAmount.fetch({
                  stabilityPoolManagerContract,
                  depositor: borrower,
                });
              }

              return SchemaDataFreshnessManager.ERC20[tokenData.address].stabilityGainedAmount.value();
            }
          },
        },

        collSurplusAmount: {
          read(_, { readField, cache }) {
            const token = readField('token') as Readonly<Reference>;

            const tokenData = cache.readFragment<TokenFragmentFragment>({
              id: token.__ref,
              fragment: TOKEN_FRAGMENT,
            });

            if (tokenData?.address && isCollateralTokenAddress(tokenData.address)) {
              if (
                isFieldOutdated(SchemaDataFreshnessManager.ERC20[tokenData.address], 'collSurplusAmount') &&
                borrower
              ) {
                SchemaDataFreshnessManager.ERC20[tokenData.address].collSurplusAmount.fetch({
                  collSurplusContract,
                  depositor: borrower,
                });
              }

              return SchemaDataFreshnessManager.ERC20[tokenData.address].collSurplusAmount.value();
            }
          },
        },
      },
    },

    Pool: {
      fields: {
        swapFee: {
          read(_, { readField, cache }) {
            const poolAddress = readField('address') as Readonly<string>;
            const poolLiquidity = readField('liquidity') as Readonly<Reference>[];

            if (poolAddress && isPoolAddress(poolAddress)) {
              if (poolLiquidity.length === 2) {
                const tokenLiq0 = cache.readFragment<LiquidityFragmentFragment>({
                  id: poolLiquidity[0].__ref,
                  fragment: LIQUIDITY_FRAGMENT,
                });
                const tokenLiq1 = cache.readFragment<LiquidityFragmentFragment>({
                  id: poolLiquidity[1].__ref,
                  fragment: LIQUIDITY_FRAGMENT,
                });

                if (
                  isFieldOutdated(SchemaDataFreshnessManager.SwapPairs[poolAddress], 'swapFee') &&
                  tokenLiq0?.totalAmount &&
                  tokenLiq1?.totalAmount
                ) {
                  SchemaDataFreshnessManager.SwapPairs[poolAddress].swapFee.fetch(
                    swapPairContracts[poolAddress],
                    BigInt(tokenLiq0.totalAmount),
                    BigInt(tokenLiq1.totalAmount),
                  );
                }
              }
              return SchemaDataFreshnessManager.SwapPairs[poolAddress].swapFee.value();
            }
          },
        },

        pendingRewards: {
          read(_, { readField }) {
            const poolAddress = readField('address') as Readonly<string>;

            if (poolAddress && isPoolAddress(poolAddress)) {
              if (isFieldOutdated(SchemaDataFreshnessManager.SwapPairs[poolAddress], 'pendingRewards') && borrower) {
                SchemaDataFreshnessManager.SwapPairs[poolAddress].pendingRewards.fetch(
                  stakingOperationsContract,
                  borrower,
                );
              }

              return SchemaDataFreshnessManager.SwapPairs[poolAddress].pendingRewards.value();
            }
          },
        },

        borrowerAmount: {
          read(_, { readField }) {
            const poolAddress = readField('address') as Readonly<string>;

            if (poolAddress && isPoolAddress(poolAddress)) {
              if (isFieldOutdated(SchemaDataFreshnessManager.SwapPairs[poolAddress], 'borrowerAmount') && borrower) {
                SchemaDataFreshnessManager.SwapPairs[poolAddress].borrowerAmount.fetch(
                  poolAddress,
                  stakingOperationsContract,
                  borrower,
                );
              }

              return SchemaDataFreshnessManager.SwapPairs[poolAddress].borrowerAmount.value();
            }
          },
        },
      },
    },
  },

  Query: {
    fields: {
      getSystemInfo: {
        read: () => {
          if (isFieldOutdated(SchemaDataFreshnessManager.StoragePool as any, 'totalCollateralRatio')) {
            SchemaDataFreshnessManager.StoragePool.totalCollateralRatio.fetch({ storagePoolContract });
          }
          if (isFieldOutdated(SchemaDataFreshnessManager.StoragePool as any, 'recoveryModeActive')) {
            SchemaDataFreshnessManager.StoragePool.recoveryModeActive.fetch({ storagePoolContract });
          }
          if (borrower && isFieldOutdated(SchemaDataFreshnessManager.TroveManager as any, 'borrowerIMCR')) {
            SchemaDataFreshnessManager.TroveManager.borrowerIMCR.fetch({ borrower, hintHelpersContract });
          }
          if (borrower && isFieldOutdated(SchemaDataFreshnessManager.TroveManager as any, 'borrowerICR')) {
            SchemaDataFreshnessManager.TroveManager.borrowerICR.fetch({ borrower, hintHelpersContract });
          }
          if (borrower && isFieldOutdated(SchemaDataFreshnessManager.TroveManager as any, 'borrowingInterestRate')) {
            SchemaDataFreshnessManager.TroveManager.borrowingInterestRate.fetch(troveManagerContract);
          }

          return {
            __typename: 'SystemInfo',
            id: 'SystemInfo',
            totalCollateralRatio: SchemaDataFreshnessManager.StoragePool.totalCollateralRatio.value(),
            borrowerICR: SchemaDataFreshnessManager.TroveManager.borrowerICR.value(),
            borrowerIMCR: SchemaDataFreshnessManager.TroveManager.borrowerIMCR.value(),
            recoveryModeActive: SchemaDataFreshnessManager.StoragePool.recoveryModeActive.value() as unknown as boolean,
            borrowingInterestRate: SchemaDataFreshnessManager.TroveManager.borrowingInterestRate.value(),
          } as SystemInfo;
        },
      },

      getRedemtionOperations: {
        read: () => {
          if (isFieldOutdated(SchemaDataFreshnessManager.RedemptionOperations, 'redemptionRateWithDecay')) {
            SchemaDataFreshnessManager.RedemptionOperations.redemptionRateWithDecay.fetch(redemptionOperationsContract);
          }

          return {
            __typename: 'RedemptionOperations',
            id: 'RedemptionOperations',
            redemptionRateWithDecay: SchemaDataFreshnessManager.RedemptionOperations.redemptionRateWithDecay.value(),
          } as RedemptionOperations;
        },
      },
    },
  },
});

export type ContractData<T> = Record<
  string,
  {
    fetch: Function;
    value: ReactiveVar<T>;
    lastFetched: number;
    timeout: number;
    periodic?: number;
  }
>;

// Type that mirros the Contracts object with literal access to the contract addresses
export type ContractDataFreshnessManagerType<T> = {
  [P in keyof T]: T[P] extends Record<string, string>
    ? { [Address in T[P][keyof T[P]]]: ContractData<bigint> }
    : T[P] extends Record<string, object>
      ? ContractData<T[P]['value']>
      : ContractData<bigint>;
};

export type ResolvedType<T> = T extends Promise<infer R> ? R : T;
export type ContractValue<T> = {
  fetch: Function;
  value: ResolvedType<T>;
  lastFetched: number;
  timeout: number;
};

export type TokenAmount = {
  tokenAddress: string;
  amount: bigint;
};

// FIXME: I am too stupid to make this typesafe for now. I must pass the exact Contract Data literally.
export function isFieldOutdated(contract: ContractData<any>, field: string) {
  return contract[field].lastFetched < Date.now() - contract[field].timeout;
}
