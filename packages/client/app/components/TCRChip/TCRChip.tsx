import { useQuery } from '@apollo/client';
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  Typography,
  alpha,
  useTheme,
} from '@mui/material';
import { useState } from 'react';
import { usePriceFeedData } from '../../context/PriceFeedDataProvider';
import { GetSystemInfoQuery, GetSystemInfoQueryVariables } from '../../generated/gql-types';
import { GET_SYSTEMINFO } from '../../queries';
import { dangerouslyConvertBigIntToNumber, displayPercentage } from '../../utils/math';
import CrossIcon from '../Icons/CrossIcon';
import DiamondIcon from '../Icons/DiamondIcon';
import { CollateralRatioChart } from '../Visualizations/CollateralRatioVisualization';

function TCRChip() {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const { data } = useQuery<GetSystemInfoQuery, GetSystemInfoQueryVariables>(GET_SYSTEMINFO);

  const { isMarketClosed } = usePriceFeedData();

  if (!data)
    return (
      <Button
        disabled
        variant="contained"
        sx={{
          width: 'auto',
          border: 'none',
          backgroundColor: theme.palette.background.emphasis,
          color: theme.palette.primary.main,
          height: '32px',
        }}
      >
        ---% | ---
      </Button>
    );

  const isRecoveryModeActive = data.getSystemInfo.recoveryModeActive;
  const recoveryModeActiveOrClosedMarket = isRecoveryModeActive || isMarketClosed;

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="contained"
        sx={{
          width: 'auto',
          border: 'none',
          backgroundColor: recoveryModeActiveOrClosedMarket
            ? theme.palette.error.background
            : theme.palette.background.emphasis,
          color: recoveryModeActiveOrClosedMarket ? theme.palette.error.main : theme.palette.primary.main,
          height: '32px',

          ':hover': {
            border: 'none',
            backgroundColor: recoveryModeActiveOrClosedMarket ? alpha(theme.palette.error.background, 0.1) : undefined,
            color: recoveryModeActiveOrClosedMarket ? alpha(theme.palette.error.main, 0.7) : undefined,
          },
        }}
      >
        {`${displayPercentage(
          dangerouslyConvertBigIntToNumber(data.getSystemInfo.totalCollateralRatio, 9, 9, Infinity),
          'omit',
          0,
        )} ${isMarketClosed ? 'CLOSED' : 'OPEN'}`}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => {
          setIsOpen(false);
        }}
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'background.default',
            border: '1px solid',
            borderColor: 'background.paper',
            borderBottom: 'none',
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <DiamondIcon isDialog />
            <Typography variant="h6" display="inline-block">
              Total Collateral Ratio
            </Typography>
          </div>
          <IconButton onClick={() => setIsOpen(false)} aria-label="close recovery mode dialog">
            <CrossIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent
          sx={{
            borderBottomLeftRadius: '4px',
            borderBottomRightRadius: '4px',
            backgroundColor: 'background.default',
            border: '1px solid',
            borderColor: 'background.paper',
            fontWeight: 400,
          }}
        >
          <List>
            <ListItem sx={{ pl: 0, pr: 0 }}>
              Current TCR:
              <Typography
                sx={{
                  textDecoration: 'underline',
                  color: isRecoveryModeActive ? theme.palette.error.main : theme.palette.success.main,
                  ml: 'auto',
                }}
                textAlign="right"
              >
                {displayPercentage(
                  dangerouslyConvertBigIntToNumber(data.getSystemInfo.totalCollateralRatio, 9, 9, Infinity),
                )}
              </Typography>
            </ListItem>
            <ListItem sx={{ pl: 0, pr: 0 }}>
              Recovery mode:
              <Typography
                sx={{
                  textDecoration: 'underline',
                  color: isRecoveryModeActive ? theme.palette.error.main : theme.palette.success.main,
                  ml: 'auto',
                }}
              >
                {isRecoveryModeActive ? 'ON' : 'OFF'}
              </Typography>
            </ListItem>
            <ListItem sx={{ pl: 0, pr: 0 }}>
              Market:
              <Typography
                sx={{
                  textDecoration: 'underline',
                  color: isMarketClosed ? theme.palette.error.main : theme.palette.success.main,
                  ml: 'auto',
                }}
              >
                {isMarketClosed ? 'CLOSED' : 'OPEN'}
              </Typography>
            </ListItem>
            <ListItem sx={{ pl: 0, pr: 0 }}>
              Borrowing interests:
              <Typography
                sx={{
                  textDecoration: 'underline',
                  ml: 'auto',
                }}
              >
                {displayPercentage(dangerouslyConvertBigIntToNumber(data.getSystemInfo.borrowingInterestRate, 12, 6))}
              </Typography>
            </ListItem>
          </List>

          <Typography sx={{ pt: 1 }} fontWeight={400} variant="body2">
            The protocol enters the recovery mode if the TCR falls below 130%, which disables any new token minting and
            collateral withdrawal.
          </Typography>
          <Typography sx={{ pt: 1, pb: 3 }} fontWeight={400} variant="body2">
            We obtain our stock predictions from the NASDAQ stock exchange, which operates Monday to Friday, 9:30 AM to
            4:00 PM Eastern Standard Time (EST). Token minting is not available when the markets are closed.
          </Typography>

          <CollateralRatioChart
            addedCollateral={[]}
            colorAlpha={
              ((dangerouslyConvertBigIntToNumber(data.getSystemInfo.totalCollateralRatio, 9, 9, 3) - 1) / 2) * 0.8
            }
            criticalPosition={0.3 / 2}
            oldPosition={(dangerouslyConvertBigIntToNumber(data.getSystemInfo.totalCollateralRatio, 9, 9, 3) - 1) / 2}
            scaleMin={1}
            scaleMax={3}
            addedDebtUSD={0}
            newPosition={0}
            newRatio={0}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default TCRChip;
