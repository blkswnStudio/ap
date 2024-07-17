'use client';

import { useApolloClient, useQuery } from '@apollo/client';
import { useTheme } from '@mui/material';
import { useEffect, useRef } from 'react';
import { useErrorMonitoring } from '../../context/ErrorMonitoringContext';
import { useSelectedToken } from '../../context/SelectedTokenProvider';
import '../../external/charting_library/charting_library';
import {
  DatafeedConfiguration,
  IChartingLibraryWidget,
  LibrarySymbolInfo,
  ResolutionString,
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

// const devMode = process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';
const devMode = false;
let priceUpdateIntervall: NodeJS.Timer;

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
    return (
      pools?.pools.find((pool) => pool.liquidity[1].token.symbol === symbol)?.liquidity[1].token ??
      pools?.pools.find((pool) => pool.liquidity[0].token.symbol === symbol)?.liquidity[0].token
    );
  };

  useEffect(() => {
    if (currentChart.current && selectedToken && !devMode) {
      currentChart.current.setSymbol(selectedToken.symbol, '1' as ResolutionString, () => {});
    }
  }, [selectedToken]);

  useEffect(() => {
    if (window.TradingView && selectedToken && !currentChart.current && pools) {
      // seems to fix this._iFrame.contentWindow; is undefined
      setTimeout(() => {
        // @ts-ignore
        currentChart.current = new TradingView.widget({
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
                  console.log('Search Symbols', userInput, exchange, symbolType);
                },
                subscribeBars(symbolInfo, resolution, onTick, listenerGuid, onResetCacheNeededCallback) {
                  const token = getSelectedTokenFromQueryData(symbolInfo.name)!;
                  apolloClient
                    .query<GetTradingViewLatestCandleQuery, GetTradingViewLatestCandleQueryVariables>({
                      query: GET_TRADING_VIEW_LATEST_CANDLE,
                      variables: {
                        id: `TokenCandleSingleton-${token.address}-${resolution}`,
                      },
                      fetchPolicy: 'network-only',
                    })
                    .then(({ data }) => {
                      if (data.tokenCandleSingleton) {
                        const {
                          tokenCandleSingleton: { close, high, low, open, timestamp, volume },
                        } = data;
                        onTick({
                          time: Number(timestamp) * 1000,
                          open: bigIntStringToFloat(open),
                          high: bigIntStringToFloat(high),
                          low: bigIntStringToFloat(low),
                          close: bigIntStringToFloat(close),
                          volume: bigIntStringToFloat(volume),
                        });
                      }
                    });

                  priceUpdateIntervall = setInterval(() => {
                    apolloClient
                      .query<GetTradingViewLatestCandleQuery, GetTradingViewLatestCandleQueryVariables>({
                        query: GET_TRADING_VIEW_LATEST_CANDLE,
                        variables: {
                          id: `TokenCandleSingleton-${token.address}-${resolution}`,
                        },
                        fetchPolicy: 'network-only',
                      })
                      .then(({ data }) => {
                        if (data.tokenCandleSingleton) {
                          const {
                            tokenCandleSingleton: { close, high, low, open, timestamp, volume },
                          } = data;
                          onTick({
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
                  clearInterval(priceUpdateIntervall);
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
                // Not enabled yet
                // searchSymbols()

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
                  // 1min, 10min, 1hour, 6hour, 1day, 1week
                  // const CandleSizes = [1, 10, 60, 360, 1440, 10080];
                  const resolutionMapper = {
                    '1': 1,
                    '10': 10,
                    '60': 60,
                    '360': 360,
                    '1D': 1440,
                    '1W': 10080,
                  };

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
                      const bars = res.data.tokenCandles.map(({ close, high, low, open, timestamp, volume }) => ({
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
          disabled_features: ['header_symbol_search', 'header_compare'],

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
