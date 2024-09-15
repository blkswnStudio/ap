'use client';

import { useApolloClient, useQuery } from '@apollo/client';
import { useTheme } from '@mui/material';
import { useEffect, useRef } from 'react';
import { useErrorMonitoring } from '../../context/ErrorMonitoringContext';
import { useSelectedToken } from '../../context/SelectedTokenProvider';
import '../../external/charting_library/charting_library';
import {
  DatafeedConfiguration,
  EntityId,
  IChartingLibraryWidget,
  LibrarySymbolInfo,
  ResolutionString,
  SearchSymbolResultItem,
} from '../../external/charting_library/charting_library';
import { UDFCompatibleDatafeed } from '../../external/datafeeds/udf/src/udf-compatible-datafeed';
import {
  GetAllPoolsQuery,
  GetAllPoolsQueryVariables,
  GetTradingViewCandlesQuery,
  GetTradingViewCandlesQueryVariables,
  GetTradingViewLatestCandleQuery,
  GetTradingViewLatestCandleQueryVariables,
} from '../../generated/gql-types';
import { GET_ALL_POOLS, GET_TRADING_VIEW_CANDLES, GET_TRADING_VIEW_LATEST_CANDLE } from '../../queries';
import { bigIntStringToFloat } from '../../utils/math';
import TradingViewHeader from './TradingViewHeader';

// 1min, 10min, 1hour, 6hour, 1day, 1week
// const CandleSizes = [1, 10, 60, 360, 1440, 10080];
const resolutionMapper: Record<string, number> = {
  '1': 1,
  '10': 10,
  '60': 60,
  '360': 360,
  '1D': 1440,
  '1W': 10080,
};

// const devMode = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const devMode = false;
let priceUpdateIntervall: Record<string, NodeJS.Timer> = {};
let latestListenerGuids: string[] = [];
let tradingViewOracleStudies: EntityId[] = [];

function TradingViewComponent() {
  const { Sentry } = useErrorMonitoring();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const client = useApolloClient();
  const apolloClient = useApolloClient();

  const currentChart = useRef<IChartingLibraryWidget>();

  const { selectedToken } = useSelectedToken();

  const { data: pools } = useQuery<GetAllPoolsQuery, GetAllPoolsQueryVariables>(GET_ALL_POOLS);

  const getSelectedTokenFromQueryData = (symbol: string) => {
    // Remove prefix "Oracle " if it exists
    symbol = symbol.replace('Oracle ', '');

    return (
      pools?.pools.find((pool) => pool.liquidity[1].token.symbol === symbol)?.liquidity[1].token ??
      pools?.pools.find((pool) => pool.liquidity[0].token.symbol === symbol)?.liquidity[0].token
    );
  };

  const getSymbolsFromQueryData = (search: string): SearchSymbolResultItem[] => {
    const matches =
      pools?.pools.filter(
        ({ liquidity }) =>
          liquidity[0].token.symbol.toLowerCase().includes(search) ||
          liquidity[1].token.symbol.toLowerCase().includes(search),
      ) ?? [];
    return matches.map(({ liquidity }) => ({
      full_name: liquidity[1].token.symbol,
      symbol: liquidity[1].token.symbol,
      description: '',
      type: 'stock',
      exchange: '',
    }));
  };

  useEffect(() => {
    if (currentChart.current && selectedToken && !devMode) {
      const castTimeout = () => {
        // get current interval of chart
        const interval = currentChart.current!.activeChart().resolution();
        currentChart.current!.setSymbol(selectedToken.symbol, interval, () => {});
        // Remove previous oracles
        tradingViewOracleStudies.forEach((study) => {
          currentChart.current!.activeChart().removeEntity(study, { disableUndo: true });
          tradingViewOracleStudies.splice(tradingViewOracleStudies.indexOf(study), 1);
        });
        // Add oracle programmatically
        currentChart
          .current!.activeChart()
          .createStudy('Compare', false, false, { source: 'open', symbol: `Oracle ${selectedToken.symbol}` })
          .then((study) => {
            tradingViewOracleStudies.push(study!);

            // If only the respective oracle is displayed then show a absolute scala
            const priceScale = currentChart.current!.activeChart().getPanes()[0].getRightPriceScales()[0];
            if (
              currentChart
                .current!.activeChart()
                .getAllStudies()
                .filter((study) => study.name === 'Compare' || study.name === 'Overlay')
                .every((studyId) => tradingViewOracleStudies.includes(studyId.id))
            ) {
              priceScale.setMode(0);
            } else {
              priceScale.setMode(2);
            }
          });
      };

      // Active chart is not available immediately, on initial load delay
      if (currentChart.current!.activeChart()) {
        castTimeout();
      } else {
        currentChart.current!.onChartReady(castTimeout);
      }
    }
  }, [selectedToken]);

  useEffect(() => {
    if (window.TradingView && selectedToken && !currentChart.current && pools) {
      // seems to fix this._iFrame.contentWindow; is undefined
      setTimeout(() => {
        // @ts-ignore
        const chart = new TradingView.widget({
          container: 'apollon-trading-view',
          locale: 'en',
          library_path: 'charting_library/',

          datafeed: devMode
            ? new UDFCompatibleDatafeed('https://demo-feed-data.tradingview.com')
            : {
                getQuotes(symbols, onDataCallback, onErrorCallback) {
                  console.log('Quotes', symbols);
                },
                searchSymbols(userInput, exchange, symbolType, onResult) {
                  console.log('selectedToken INNER: ', selectedToken);
                  onResult(getSymbolsFromQueryData(userInput.toLowerCase()));
                },

                subscribeBars(
                  symbolInfo,
                  resolution: ResolutionString,
                  onTick,
                  listenerGuid,
                  onResetCacheNeededCallback,
                ) {
                  const token = getSelectedTokenFromQueryData(symbolInfo.name)!;
                  apolloClient
                    .query<GetTradingViewLatestCandleQuery, GetTradingViewLatestCandleQueryVariables>({
                      query: GET_TRADING_VIEW_LATEST_CANDLE,
                      variables: {
                        id: `TokenCandleSingleton-${token.address}-${resolutionMapper[resolution]}`,
                      },
                      fetchPolicy: 'network-only',
                    })
                    .then(({ data }) => {
                      if (data.tokenCandleSingleton) {
                        const {
                          tokenCandleSingleton: {
                            close,
                            high,
                            low,
                            open,
                            timestamp,
                            volume,
                            closeOracle,
                            highOracle,
                            lowOracle,
                            openOracle,
                          },
                        } = data;
                        symbolInfo.name.startsWith('Oracle')
                          ? onTick({
                              time: Number(timestamp) * 1000,
                              open: bigIntStringToFloat(openOracle),
                              high: bigIntStringToFloat(highOracle),
                              low: bigIntStringToFloat(lowOracle),
                              close: bigIntStringToFloat(closeOracle),
                              volume: bigIntStringToFloat(volume),
                            })
                          : onTick({
                              time: Number(timestamp) * 1000,
                              open: bigIntStringToFloat(open),
                              high: bigIntStringToFloat(high),
                              low: bigIntStringToFloat(low),
                              close: bigIntStringToFloat(close),
                              volume: bigIntStringToFloat(volume),
                            });
                      }
                    });

                  latestListenerGuids.push(listenerGuid);
                  priceUpdateIntervall[listenerGuid] = setInterval(() => {
                    apolloClient
                      .query<GetTradingViewLatestCandleQuery, GetTradingViewLatestCandleQueryVariables>({
                        query: GET_TRADING_VIEW_LATEST_CANDLE,
                        variables: {
                          id: `TokenCandleSingleton-${token.address}-${resolutionMapper[resolution]}`,
                        },
                        fetchPolicy: 'network-only',
                      })
                      .then(({ data }) => {
                        if (data.tokenCandleSingleton && latestListenerGuids.includes(listenerGuid)) {
                          const {
                            tokenCandleSingleton: {
                              close,
                              high,
                              low,
                              open,
                              timestamp,
                              volume,
                              closeOracle,
                              highOracle,
                              lowOracle,
                              openOracle,
                            },
                          } = data;
                          symbolInfo.name.startsWith('Oracle')
                            ? onTick({
                                time: Number(timestamp) * 1000,
                                open: bigIntStringToFloat(openOracle),
                                high: bigIntStringToFloat(highOracle),
                                low: bigIntStringToFloat(lowOracle),
                                close: bigIntStringToFloat(closeOracle),
                                volume: bigIntStringToFloat(volume),
                              })
                            : onTick({
                                time: Number(timestamp) * 1000,
                                open: bigIntStringToFloat(open),
                                high: bigIntStringToFloat(high),
                                low: bigIntStringToFloat(low),
                                close: bigIntStringToFloat(close),
                                volume: bigIntStringToFloat(volume),
                              });
                        }
                      });
                  }, 5000);
                },
                unsubscribeBars(listenerGuid) {
                  latestListenerGuids.splice(latestListenerGuids.indexOf(listenerGuid), 1);
                  clearInterval(priceUpdateIntervall[listenerGuid]);
                },
                subscribeQuotes(symbols, fastSymbols, onRealtimeCallback, listenerGUID) {
                  console.log('Subscribe Quotes', symbols, fastSymbols, listenerGUID);
                },
                unsubscribeQuotes(listenerGUID) {
                  console.log('Unsubscribe Quotes', listenerGUID);
                },

                onReady(callback) {
                  const config: DatafeedConfiguration = {
                    currency_codes: ['USD'],
                    symbols_types: [],
                    supported_resolutions: ['1', '10', '60', '360', '1D', '1W'] as ResolutionString[],
                    supports_marks: false,
                    supports_timescale_marks: false,
                    supports_time: false,
                  };
                  setTimeout(() => {
                    callback(config);
                  }, 0);
                },
                resolveSymbol: async (symbol, onSymbolResolvedCallback, onResolveErrorCallback, extension) => {
                  setTimeout(() => {
                    try {
                      const symbolInfo: LibrarySymbolInfo = {
                        ticker: symbol,
                        name: symbol,
                        full_name: symbol,
                        description: '',
                        type: '',
                        session: '24x7',
                        timezone: 'Etc/UTC',
                        exchange: '',
                        minmov: 1,
                        pricescale: 100,
                        has_intraday: true,
                        visible_plots_set: 'ohlcv',
                        has_weekly_and_monthly: true,
                        supported_resolutions: ['1', '10', '60', '360', '1D', '1W'] as ResolutionString[],
                        volume_precision: 2,
                        data_status: 'streaming',
                        format: 'price',
                        listed_exchange: '',
                      };
                      onSymbolResolvedCallback(symbolInfo);
                    } catch (err: any) {
                      onResolveErrorCallback(err.message);
                    }
                  }, 0);
                },

                getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
                  const token = getSelectedTokenFromQueryData(symbolInfo.name)!;
                  client
                    .query<GetTradingViewCandlesQuery, GetTradingViewCandlesQueryVariables>({
                      query: GET_TRADING_VIEW_CANDLES,
                      variables: {
                        first: periodParams.countBack,
                        where: {
                          // @ts-ignore
                          candleSize: resolutionMapper[resolution],
                          timestamp_lte: periodParams.to,
                          token_: {
                            id: token.id,
                          },
                        },
                      },
                    })
                    .then((res) => {
                      const bars = symbolInfo.name.startsWith('Oracle')
                        ? res.data.tokenCandles.map(
                            ({ timestamp, closeOracle, highOracle, lowOracle, openOracle, volume }) => ({
                              close: bigIntStringToFloat(closeOracle),
                              high: bigIntStringToFloat(highOracle),
                              low: bigIntStringToFloat(lowOracle),
                              open: bigIntStringToFloat(openOracle),
                              time: Number(timestamp) * 1000,
                              volume: bigIntStringToFloat(volume),
                            }),
                          )
                        : res.data.tokenCandles.map(({ timestamp, close, high, low, open, volume }) => ({
                            close: bigIntStringToFloat(close),
                            high: bigIntStringToFloat(high),
                            low: bigIntStringToFloat(low),
                            open: bigIntStringToFloat(open),
                            time: Number(timestamp) * 1000,
                            volume: bigIntStringToFloat(volume),
                          }));

                      onHistoryCallback(bars, { noData: bars.length === 0 });
                    })
                    .catch((err) => {
                      Sentry.captureException(err);
                      console.error(err);
                      onErrorCallback("Couldn't fetch current data. Please try again later.");
                    });
                },

                // Only updates the most recent bar. Not needed yet.
                // subscribeBars() also needs unsubscribeBars()
              },

          // General config
          symbol: devMode ? 'AAPL' : selectedToken.symbol,
          autosize: true,

          debug: devMode,
          theme: isDarkMode ? 'dark' : 'light',
          // TODO: Maybe implement later for diffing
          disabled_features: ['header_symbol_search'],

          // Must set font and toolbar styles
          custom_css_url: '/charting_library/tradingview-custom.css',
          // Override in user settings because it looks terrible
          settings_overrides: isDarkMode
            ? {
                'paneProperties.backgroundType': 'solid',
                'paneProperties.background': '#1E1B27',
                'paneProperties.vertGridProperties.color': '#282531',
                'paneProperties.horzGridProperties.color': '#282531',
              }
            : {
                'paneProperties.backgroundType': 'solid',
                'paneProperties.background': '#f8f8f8',
                'paneProperties.vertGridProperties.color': '#ECECEC',
                'paneProperties.horzGridProperties.color': '#ECECEC',
              },
          // Not sure if this does anything
          overrides: {
            'linetoolexecution.fontFamily': 'Space Grotesk Variable',
            'linetoolorder.bodyFontFamily': 'Space Grotesk Variable',
            'linetoolposition.bodyFontFamily': 'Space Grotesk Variable',
            'linetoolorder.quantityFontFamily': 'Space Grotesk Variable',
            'linetoolposition.quantityFontFamily': 'Space Grotesk Variable',
          },
        });

        chart.onChartReady(() => {
          currentChart.current = chart;

          // Add oracle programmatically
          currentChart
            .current!.activeChart()
            .createStudy('Compare', false, false, { source: 'open', symbol: `Oracle ${selectedToken.symbol}` })
            .then((study) => {
              tradingViewOracleStudies.push(study!);
              // show a absolute scala
              const priceScale = currentChart.current!.activeChart().getPanes()[0].getRightPriceScales()[0];
              priceScale.setMode(0);
            });
        });
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, selectedToken, pools]);

  useEffect(() => {
    if (currentChart.current) {
      currentChart.current.changeTheme(isDarkMode ? 'dark' : 'light');
      currentChart.current.applyOverrides(
        isDarkMode
          ? {
              'paneProperties.backgroundType': 'solid',
              'paneProperties.background': '#1E1B27',
              'paneProperties.vertGridProperties.color': '#282531',
              'paneProperties.horzGridProperties.color': '#282531',
            }
          : {
              'paneProperties.backgroundType': 'solid',
              'paneProperties.background': '#f8f8f8',
              'paneProperties.vertGridProperties.color': '#ECECEC',
              'paneProperties.horzGridProperties.color': '#ECECEC',
            },
      );
    }
  }, [isDarkMode]);

  // cleanup
  useEffect(() => {
    return () => {
      if (currentChart.current) {
        currentChart.current.remove();
      }
    };
  }, []);

  return (
    <>
      <TradingViewHeader />
      <div
        // Must have the height fixed in order to resize properly. We adapt via a CSS custom property.
        // Whole screen - navigation - TV header - current table size - resize handler
        style={{ height: 'calc(100vh - 48px - 74px - var(--apollon-drag-queen-height, 330px) - 25px)', width: '100%' }}
      >
        <div style={{ height: '100%' }} id="apollon-trading-view"></div>
      </div>
    </>
  );
}

export default TradingViewComponent;
