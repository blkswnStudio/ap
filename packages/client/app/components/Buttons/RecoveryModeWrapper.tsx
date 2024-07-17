import { useQuery } from '@apollo/client';
import { ButtonProps, Tooltip } from '@mui/material';
import { ReactElement, cloneElement } from 'react';
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

  const { data: systemInfo } = useQuery<GetSystemInfoQuery, GetSystemInfoQueryVariables>(GET_SYSTEMINFO);

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
