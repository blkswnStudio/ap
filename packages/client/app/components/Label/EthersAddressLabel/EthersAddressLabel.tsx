'use client';

import { Button, Typography } from '@mui/material';
import { useWeb3Modal, useWeb3ModalAccount } from '@web3modal/ethers/react';
import { useEthers } from '../../../context/EthersProvider';

function EthersAddressLabel() {
  const { address } = useEthers();
  const { isConnected } = useWeb3ModalAccount();
  const { open } = useWeb3Modal();

  return isConnected ? (
    <Button
      variant="contained"
      onClick={() => open({ view: 'Account' })}
      sx={{ display: 'flex', alignItems: 'center', gap: '10px', paddingX: 1, width: 150, height: 32 }}
    >
      <img src="assets/svgs/Star24_green.svg" alt="Green colored diamond shape" height="11" typeof="image/svg+xml" />

      <Typography variant="titleAlternate">
        {address.slice(0, 6)}...{address.slice(-4)}
      </Typography>
    </Button>
  ) : (
    <Button
      onClick={() => open({ view: 'Connect' })}
      sx={{ width: 170, height: 32, borderColor: 'primary.contrastText' }}
      size="small"
      variant="outlined"
    >
      Connect Wallet
    </Button>
  );
}

export default EthersAddressLabel;
