import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import { MenuItem, Select, SelectChangeEvent } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { NETWORKS } from '../../../config';
import { useErrorMonitoring } from '../../context/ErrorMonitoringContext';
import { useEthers } from '../../context/EthersProvider';

function NetworkSwitch() {
  const { Sentry } = useErrorMonitoring();
  const { provider, setCurrentNetwork, currentNetwork } = useEthers();

  const router = useRouter();

  const handleChange = async (event: SelectChangeEvent<(typeof NETWORKS)[number]['chainName']>) => {
    const choosenNetwork = NETWORKS.find((network) => network.chainName === event.target.value)!;
    const { blockExplorerUrls, chainId, chainName, nativeCurrency, rpcUrls } = choosenNetwork;

    if (typeof window.ethereum !== 'undefined') {
      // @ts-ignore
      window.ethereum
        .request({
          method: 'wallet_switchEthereumChain',
          params: [
            {
              // All params must be provided to make it work
              chainId,
            },
          ],
        })

        .then(() => {
          // TODO: Add this back in when no reload is necessary anymore.
          // setCurrentNetwork(choosenNetwork);
          setCurrentNetwork(null);
          window.location.reload();
          // updateProvider(choosenNetwork)
        })
        .catch(() => {
          if (typeof window.ethereum !== 'undefined') {
            // @ts-ignore
            window.ethereum
              .request({
                method: 'wallet_addEthereumChain',
                params: [
                  {
                    // All params must be provided to make it work
                    chainId,
                    rpcUrls,
                    chainName,
                    nativeCurrency,
                    blockExplorerUrls,
                  },
                ],
              })
              .then(() => {
                // TODO: Add this back in when no reload is necessary anymore.
                // setCurrentNetwork(choosenNetwork);
                setCurrentNetwork(null);
                window.location.reload();
                // updateProvider(choosenNetwork)
              })
              .catch((error: any) => {
                Sentry.captureException(error);
              });
          }
        });
    }
  };

  useEffect(() => {
    const handleNetworkChange = (chainId: string) => {
      const currentNetwork = NETWORKS.find((network) => network.chainId === chainId);

      if (currentNetwork) {
        setCurrentNetwork(currentNetwork as any);
        // reload page
        window.location.reload();
        // updateProvider(currentNetwork)
      } else {
        router.push('/network-not-found');
      }
    };

    if (typeof window.ethereum !== 'undefined') {
      // Update Switch on manual network change.
      // @ts-ignore
      window.ethereum.on('chainChanged', handleNetworkChange);

      // Get current network once and set switch initially
      provider
        ?.getNetwork()
        .then((currentNetwork) => {
          const network = NETWORKS.find((network) => network.chainIdNumber === Number(currentNetwork.chainId));
          if (network) {
            setCurrentNetwork(network as any);
          }
        })
        .catch((error) => {
          Sentry.captureException(error);
        });
    }

    // Cleanup the listener when the component unmounts
    return () => {
      if (typeof window.ethereum !== 'undefined') {
        // @ts-ignore
        window.ethereum.removeListener('chainChanged', handleNetworkChange);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Select
      disabled={typeof window.ethereum === 'undefined'}
      value={currentNetwork!.chainName}
      onChange={handleChange}
      variant="outlined"
      IconComponent={ArrowDropDownRoundedIcon}
      sx={{
        height: '32px',
        fontFamily: 'Space Grotesk Variable',
        fontSize: '14.3px',
        fontWeight: '700',
        color: 'text.secondary',

        backgroundColor: 'background.emphasis',
        border: 'background.emphasis',
        '& .MuiOutlinedInput-notchedOutline.MuiOutlinedInput-notchedOutline': {
          borderWidth: 0,
        },
      }}
    >
      {NETWORKS.filter(
        ({ chainName }) => chainName !== 'Localhost' || process.env.NEXT_PUBLIC_ENVIRONMENT === 'development',
      ).map((network) => (
        <MenuItem
          value={network.chainName}
          key={network.chainName}
          sx={{
            fontFamily: 'Space Grotesk Variable',
            fontSize: '14.3px',
            fontWeight: '700',
            color: 'text.secondary',
            height: '32px',
          }}
        >
          {network.chainName}
        </MenuItem>
      ))}
    </Select>
  );
}

export default NetworkSwitch;
