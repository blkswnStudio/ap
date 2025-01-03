import { LiquidationSummary as LiquidationSummaryEvent } from '../generated/LiquidationOperations/LiquidationOperations';
import { handleCreateLiquidation } from './entities/liquidation-entity';
// import { log } from '@graphprotocol/graph-ts';

export function handleLiquidationSummary(event: LiquidationSummaryEvent): void {
  handleCreateLiquidation(event);
}
