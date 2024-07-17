import { SchemaDataFreshnessManager_ATC } from './apollon-testing-chain';
import { SchemaDataFreshnessManager_LOCALHOST } from './localhost';

export type SchemaDataFreshnessManagers = typeof SchemaDataFreshnessManager_LOCALHOST &
  typeof SchemaDataFreshnessManager_ATC;
