'use client';

import { Button, Typography } from '@mui/material';
import { useEthers } from '../../../context/EthersProvider';

function EthersAddressLabel() {
  const { address, connectWallet } = useEthers();

  return address ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: '18px' }}>
      <img src="assets/svgs/Star24_green.svg" alt="Green colored diamond shape" height="11" typeof="image/svg+xml" />

      <Typography variant="titleAlternate">
        {address.slice(0, 6)}...{address.slice(-4)}
      </Typography>
    </div>
  ) : (
    <Button
      onClick={connectWallet}
      sx={{ width: 170, height: 32, borderColor: 'primary.contrastText' }}
      size="small"
      variant="outlined"
    >
      Connect Wallet
    </Button>
  );
}

export default EthersAddressLabel;
