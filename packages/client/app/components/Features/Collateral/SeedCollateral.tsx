import { useApolloClient } from '@apollo/client';
import { Alert, AlertTitle, Button } from '@mui/material';
import { isCollateralTokenAddress, seedCollateralTokensAmount } from '../../../../config';
import { useEthers } from '../../../context/EthersProvider';
import { useTransactionDialog } from '../../../context/TransactionDialogProvider';
import { GET_BORROWER_COLLATERAL_TOKENS } from '../../../queries';

type Props = {
  isAlert?: boolean;
};

function SeedCollateral({ isAlert = false }: Props) {
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
          reloadQueriesAfterMined: [],
        },
      })),
      () => {
        client.refetchQueries({
          include: [GET_BORROWER_COLLATERAL_TOKENS],
        });
      },
    );
  };

  return isAlert ? (
    <Alert
      variant="outlined"
      severity="info"
      sx={{ width: 'calc(100% - 32px)', fontSize: '20px', mx: 2 }}
      action={
        <Button
          sx={{
            width: '100%',
          }}
          variant="outlined"
          onClick={handleSeedCollateral}
          disabled={!address}
        >
          Seed Collateral
        </Button>
      }
    >
      <AlertTitle>Development: Seed Collateral</AlertTitle>
      Seeding collateral will mint new collateral tokens into your wallet. This feature is only available on testnet.
    </Alert>
  ) : (
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
