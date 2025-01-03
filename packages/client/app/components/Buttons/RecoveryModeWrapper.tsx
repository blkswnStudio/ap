import { useQuery } from '@apollo/client';
import { ButtonProps, Tooltip } from '@mui/material';
import { useSnackbar } from 'notistack';
import { ReactElement, cloneElement } from 'react';
import { useErrorMonitoring } from '../../context/ErrorMonitoringContext';
import { usePriceFeedData } from '../../context/PriceFeedDataProvider';
import { GetSystemInfoQuery, GetSystemInfoQueryVariables } from '../../generated/gql-types';
import { GET_SYSTEMINFO } from '../../queries';

type Props = {
  respectRecoveryMode?: boolean;
  respectMarketClose?: boolean;
  children: ReactElement<ButtonProps>;
};

export default function RecoveryModeMarketCloseWrapper({
  respectRecoveryMode = false,
  respectMarketClose = false,
  children,
}: Props) {
  const { isMarketClosed } = usePriceFeedData();
  const { enqueueSnackbar } = useSnackbar();
  const { Sentry } = useErrorMonitoring();

  const { data: systemInfo } = useQuery<GetSystemInfoQuery, GetSystemInfoQueryVariables>(GET_SYSTEMINFO, {
    onError: (error) => {
      enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
      Sentry.captureException(error);
    },
  });

  if (respectRecoveryMode && systemInfo?.getSystemInfo.recoveryModeActive) {
    return (
      <Tooltip title="Disabled because system is currently in recovery mode." placement="bottom" arrow>
        <span>
          {cloneElement(children, {
            disabled: true,
          })}
        </span>
      </Tooltip>
    );
  } else if (respectMarketClose && isMarketClosed) {
    return (
      <Tooltip title="Disabled because markets are currently closed." placement="bottom" arrow>
        <span>
          {cloneElement(children, {
            disabled: true,
          })}
        </span>
      </Tooltip>
    );
  } else {
    return children;
  }
}
