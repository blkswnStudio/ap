import { Button, Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import FeatureBox from '../../FeatureBox/FeatureBox';
import ExchangeIcon from '../../Icons/ExchangeIcon';
import HeaderCell from '../../Table/HeaderCell';

export default function ClaimStakingRewardsLoader() {
  return (
    <FeatureBox title="Staking Rewards" noPadding border="full" sx={{ position: 'relative', left: '-0.5px' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <TableContainer>
          <Table sx={{ borderRight: '1px solid', borderColor: 'background.emphasis' }}>
            <TableHead>
              <TableRow>
                <HeaderCell title="Pool" />
                <HeaderCell title="Pending Rewards" />
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow hover>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    <Skeleton variant="text" width={50} />
                    <ExchangeIcon />
                    <Skeleton variant="text" width={50} />
                  </div>
                </TableCell>

                <TableCell>
                  <div style={{ display: 'flex', gap: 15 }}>
                    <Skeleton variant="text" width={80} />
                    <Skeleton variant="text" width={50} />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow hover>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    <Skeleton variant="text" width={50} />
                    <ExchangeIcon />
                    <Skeleton variant="text" width={50} />
                  </div>
                </TableCell>

                <TableCell>
                  <div style={{ display: 'flex', gap: 15 }}>
                    <Skeleton variant="text" width={80} />
                    <Skeleton variant="text" width={50} />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow hover>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    <Skeleton variant="text" width={50} />
                    <ExchangeIcon />
                    <Skeleton variant="text" width={50} />
                  </div>
                </TableCell>

                <TableCell>
                  <div style={{ display: 'flex', gap: 15 }}>
                    <Skeleton variant="text" width={80} />
                    <Skeleton variant="text" width={50} />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow hover>
                <TableCell>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                    <Skeleton variant="text" width={50} />
                    <ExchangeIcon />
                    <Skeleton variant="text" width={50} />
                  </div>
                </TableCell>

                <TableCell>
                  <div style={{ display: 'flex', gap: 15 }}>
                    <Skeleton variant="text" width={80} />
                    <Skeleton variant="text" width={50} />
                  </div>
                </TableCell>
              </TableRow>

              <TableRow sx={{ borderTop: '2px solid', borderTopColor: 'table.border' }}>
                <TableCell sx={{ borderBottom: 'none' }}></TableCell>
                <TableCell sx={{ borderBottom: 'none' }}>
                  <div style={{ display: 'flex', gap: 15 }}>
                    = <Skeleton variant="text" width={100} />
                    <Skeleton variant="text" width={50} />
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <div style={{ minWidth: 190, margin: '0 30px' }}>
          <Button variant="outlined" sx={{ marginY: '10px' }} disabled>
            CLAIM
          </Button>
        </div>
      </div>
    </FeatureBox>
  );
}
