import { TroveCreated as TroveCreatedEvent } from '../generated/BorrowerOperations/BorrowerOperations';
import { handleCreateUpdateCollateralTokenMeta } from './entities/collateral-token-meta-entity';

export function handleTroveCreated(event: TroveCreatedEvent): void {
  for (let i = 0; i < event.params._colls.length; i++) {
    handleCreateUpdateCollateralTokenMeta(event, event.params._colls[i].tokenAddress);
  }
}
