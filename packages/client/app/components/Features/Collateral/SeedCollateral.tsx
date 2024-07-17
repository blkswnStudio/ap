import { useApolloClient } from '@apollo/client';
import { Button } from '@mui/material';
import { isCollateralTokenAddress, seedCollateralTokensAmount } from '../../../../config';
import { useEthers } from '../../../context/EthersProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { GET_BORROWER_COLLATERAL_TOKENS } from '../../../queries';

function SeedCollateral() {
  const {
    address,
    contracts: { borrowerOperationsContract, collateralTokenContracts },
    currentNetwork,
  } = useEthers();
  const { setSteps } = useTransactionDialog();
  const client = useApolloClient();

  if ((currentNetwork!.featureFlags.seedCollateralEnabled as boolean) === false) return null;

  const handleSeedCollateral = () => {
    setSteps(
      Object.keys(collateralTokenContracts).map((collateralTokenAddress) => ({
        title: `DEV - Seed Collateral Token ${Object.entries(currentNetwork!.contracts.ERC20).find(([_, value]) => value === collateralTokenAddress)?.[0]} into your wallet.`,
        transaction: {
          methodCall: async () => {
            if (isCollateralTokenAddress(collateralTokenAddress)) {
              const collateralTokenContract = collateralTokenContracts[collateralTokenAddress];
              const collateralTokenAmount = seedCollateralTokensAmount[collateralTokenAddress];

              return collateralTokenContract.unprotectedMint(address, collateralTokenAmount).catch((err) => {
                throw new Error(err, { cause: borrowerOperationsContract });
              });
            }

            return null as any;
          },
          waitForResponseOf: [],
          reloadQueriesAferMined: [],
        },
      })),
      () => {
        client.refetchQueries({
          include: [GET_BORROWER_COLLATERAL_TOKENS],
        });
      },
    );
  };

  return (
    <Button
      variant="text"
      sx={{
        p: '6px 8px',
        width: '100%',
      }}
      onClick={handleSeedCollateral}
      disabled={!address}
    >
      Seed Collateral
    </Button>
  );
}

export default SeedCollateral;
