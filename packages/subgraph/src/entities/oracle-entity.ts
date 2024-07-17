import { Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { Oracle } from '../../generated/schema';
// import { log } from '@graphprotocol/graph-ts';

export function handleCreateOracle(event: ethereum.Event, oracleId: Bytes, tokenAddress: Address): void {
  let newOracle = new Oracle(oracleId);

  newOracle.token = tokenAddress;

  newOracle.save();
}
