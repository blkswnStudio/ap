import { Address, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { Token } from '../../generated/schema';
import { DebtToken } from '../../generated/templates/DebtTokenTemplate/DebtToken';
import { ERC20 } from '../../generated/templates/ERC20Template/ERC20';
// import { log } from '@graphprotocol/graph-ts';

export function handleCreateToken(
  event: ethereum.Event,
  tokenAddress: Address,
  isDebtToken: boolean,
  oracleId: Bytes,
): void {
  let newToken = new Token(tokenAddress);

  if (isDebtToken) {
    const contract = DebtToken.bind(tokenAddress);

    newToken.address = tokenAddress.toHexString();
    newToken.symbol = contract.symbol();
    newToken.createdAt = event.block.timestamp;
    newToken.decimals = contract.decimals();
  } else {
    const contract = ERC20.bind(tokenAddress);

    newToken.address = tokenAddress.toHexString();
    newToken.symbol = contract.symbol();
    newToken.createdAt = event.block.timestamp;
    newToken.decimals = contract.decimals();
  }

  // Setting it to true when the pool is initialized
  newToken.isPoolToken = false;
  newToken.oracleId = oracleId;

  newToken.save();
}
