'use client';

import { useQuery } from '@apollo/client';
import ExpandLessSharpIcon from '@mui/icons-material/ExpandLessSharp';
import { Box, Button, Dialog, DialogContent, DialogContentProps, DialogTitle, IconButton } from '@mui/material';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useEthers } from '../../../context/EthersProvider';
import {
  BorrowerHistoryType,
  GetBorrowerStabilityHistoryQuery,
  GetBorrowerStabilityHistoryQueryVariables,
} from '../../../generated/gql-types';
import { GET_BORROWER_STABILITY_HISTORY } from '../../../queries';
import { formatUnixTimestamp } from '../../../utils/date';
import { bigIntStringToFloat, roundCurrency } from '../../../utils/math';
import CrossIcon from '../../Icons/CrossIcon';
import DiamondIcon from '../../Icons/DiamondIcon';
import Label from '../../Label/Label';

const StabilityHistoryDialog = () => {
  const [open, setOpen] = useState(false);

  const { address } = useEthers();

  const { data, fetchMore, refetch } = useQuery<
    GetBorrowerStabilityHistoryQuery,
    GetBorrowerStabilityHistoryQueryVariables
  >(GET_BORROWER_STABILITY_HISTORY, {
    variables: {
      first: 30,
      skip: 0,
      where: {
        borrower: address,
      },
    },
    skip: !address,
  });

  const getComponentForBorrowerHistoryType = (
    history: GetBorrowerStabilityHistoryQuery['borrowerHistories'][number],
  ) => {
    switch (history.type) {
      case BorrowerHistoryType.ClaimedRewards:
        return <StabilityClaimedRewards history={history} />;

      case BorrowerHistoryType.Deposited:
        return <StabilityDeposit history={history} />;

      case BorrowerHistoryType.Withdrawn:
        return <StabilityWithdraw history={history} />;

      default:
        const _: never = history.type;
    }
  };

  const handleScroll: DialogContentProps['onScroll'] = (event) => {
    const scrollableDiv = event.target as HTMLDivElement;
    if (scrollableDiv.scrollTop + scrollableDiv.clientHeight >= scrollableDiv.scrollHeight) {
      if ((data?.borrowerHistories.length ?? 0) % 30 === 0) {
        fetchMorePositions();
      }
    }
  };

  const fetchMorePositions = () => {
    fetchMore({
      variables: {
        where: {
          borrower: address,
        },
        skip: data?.borrowerHistories.length ?? 0,
        first: 30,
      },
    });
  };

  return (
    <>
      <Button
        onClick={() => {
          // Refetch when accessing the component.
          // We can not poll because of pagination and the cache
          // We can not refetch after transaction has been mined because subgraph didnt index yet
          // easiest solution is to just refetch for now.
          refetch();
          setOpen(true);
        }}
        variant="contained"
        disabled={!address || !data || data.borrowerHistories.length === 0}
      >
        History
      </Button>

      {data && (
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          fullWidth
          // @ts-ignore
          componentsProps={{ backdrop: { 'data-testid': 'apollon-stability-history-dialog-backdrop' } }}
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
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <DiamondIcon isDialog />
              <Typography variant="h6" display="inline-block">
                STABILITY PER HISTORY
              </Typography>
            </div>
            <IconButton onClick={() => setOpen(false)} aria-label="close stability history dialog">
              <CrossIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent
            onScroll={handleScroll}
            sx={{
              p: 0,
              backgroundColor: 'background.default',
              border: '1px solid',
              borderColor: 'background.paper',
            }}
          >
            {data.borrowerHistories.map((history, index) => (
              <Box
                data-testid="apollon-stability-history-dialog-history"
                sx={{
                  borderBottom: index === data.borrowerHistories.length - 1 ? 'none' : `1px solid`,
                  borderBottomColor: 'table.border',
                  padding: '20px',
                }}
                key={index}
              >
                {getComponentForBorrowerHistoryType(history)}
              </Box>
            ))}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

type StabilityWidgetProps = {
  history: GetBorrowerStabilityHistoryQuery['borrowerHistories'][number];
};

function StabilityClaimedRewards({ history }: StabilityWidgetProps) {
  const lostTokens = history.values.filter((reward) => bigIntStringToFloat(reward.amount) < 0);
  const gainedTokens = history.values.filter((reward) => bigIntStringToFloat(reward.amount) > 0);

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <Typography variant="titleAlternate" color="primary.contrastText">
          {formatUnixTimestamp(history.timestamp, false)}
        </Typography>

        <Label variant="success" fixedWidth={false}>
          Claimed Collateral
        </Label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 20 }}>
          {lostTokens.map(({ token, amount }) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} key={token.address}>
              <Typography fontWeight={400} noWrap>
                {roundCurrency(bigIntStringToFloat(amount), 5, 5)}
              </Typography>
              <Label variant="none">{token.symbol}</Label>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Box
            sx={{
              backgroundColor: 'info.background',
              border: '1px solid',
              borderColor: 'info.main',
              padding: '10px',
              width: 170,
            }}
          >
            <Typography
              style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
              variant="titleAlternate"
              color="info.main"
              fontWeight={400}
              sx={{ gap: '5px', justifyContent: 'end' }}
            >
              +{' '}
              {roundCurrency(bigIntStringToFloat(history.claimInUSD!) - bigIntStringToFloat(history.lostDepositInUSD!))}{' '}
              $
              <ExpandLessSharpIcon sx={{ color: 'info.main' }} />
            </Typography>
          </Box>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {gainedTokens.map(({ token, amount }) => (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'end' }}
              key={token.address}
            >
              <Typography fontWeight={400}>{roundCurrency(bigIntStringToFloat(amount), 5, 5)}</Typography>
              <Label variant="none">{token.symbol}</Label>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function StabilityDeposit({ history }: StabilityWidgetProps) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <Typography variant="titleAlternate" color="primary.contrastText">
          {formatUnixTimestamp(history.timestamp, false)}
        </Typography>

        <Label variant="none" fixedWidth={false}>
          Deposited token
        </Label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        {history.values.map(({ amount, token }) => (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'end' }}
            key={token.address}
          >
            <Typography fontWeight={400}>{roundCurrency(bigIntStringToFloat(amount), 5, 5)}</Typography>
            <Label variant="none">{token.symbol}</Label>
          </div>
        ))}
      </div>
    </>
  );
}

function StabilityWithdraw({ history }: StabilityWidgetProps) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <Typography variant="titleAlternate" color="primary.contrastText">
          {formatUnixTimestamp(history.timestamp, false)}
        </Typography>

        <Label variant="info" fixedWidth={false}>
          Withdrawn token
        </Label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        {history.values.map(({ amount, token }) => (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', justifyContent: 'end' }}
            key={token.address}
          >
            <Typography fontWeight={400}>{roundCurrency(bigIntStringToFloat(amount), 5, 5)}</Typography>
            <Label variant="none">{token.symbol}</Label>
          </div>
        ))}
      </div>
    </>
  );
}

export default StabilityHistoryDialog;
