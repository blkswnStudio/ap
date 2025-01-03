export const WIDGET_HEIGHTS = {
  'apollon-assets-widget': 22,
  'apollon-farm-widget': 60,
  'apollon-swap-widget': 38,
};

export const standardDataPollInterval = 1000 * 30; // for queries with subgraph data
export const manualSubgraphSyncTimeout = 1000 * 3; // hardcode waiting time for syncing the subgraph, then refetch data
