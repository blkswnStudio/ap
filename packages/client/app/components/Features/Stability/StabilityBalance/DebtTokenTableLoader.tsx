import { Button, Skeleton } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import FeatureBox from '../../../FeatureBox/FeatureBox';
import HeaderCell from '../../../Table/HeaderCell';

function DebtTokenTableLoader() {
  return (
    <FeatureBox title="Debt Token" noPadding border="full" borderRadius>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <HeaderCell title="Personal" cellProps={{ align: 'right' }} />
              <HeaderCell title="" />
              <HeaderCell title="" cellProps={{ sx: { borderRight: '1px solid', borderColor: 'background.paper' } }} />
              <HeaderCell title="" />

              <HeaderCell title="" />
              <HeaderCell title="Protocol Level" cellProps={{ align: 'right' }} />
            </TableRow>
          </TableHead>
          <TableHead>
            <TableRow>
              <HeaderCell title="Minted" cellProps={{ align: 'right' }} />
              <HeaderCell title="Stability" cellProps={{ align: 'right' }} />
              <HeaderCell
                title="Token"
                cellProps={{ sx: { borderRight: '1px solid', borderColor: 'background.paper' } }}
              />

              <HeaderCell title="Supply" cellProps={{ align: 'right' }} />
              <HeaderCell title="Stability" cellProps={{ align: 'right' }} />
              <HeaderCell title="Rewards" cellProps={{ align: 'right' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {Array(8)
              .fill(null)
              .map((_, index) => (
                <TableRow key={index}>
                  <TableCell align="right">
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell align="right">
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell sx={{ borderRight: '1px solid', borderColor: 'table.border' }} align="right">
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell align="right">
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell align="right">
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell align="right">
                    <Skeleton variant="text" />
                  </TableCell>
                </TableRow>
              ))}

            <TableRow>
              <TableCell
                colSpan={3}
                sx={{ borderBottom: 'none', borderRight: '1px solid', borderColor: 'table.border', padding: '2px' }}
              >
                <Button
                  variant="text"
                  sx={{
                    width: '100%',
                    p: '6px 8px',
                  }}
                  disabled
                >
                  Repay
                </Button>
              </TableCell>
              <TableCell style={{ borderBottom: 'none', padding: '2px' }} colSpan={4} align="center">
                <Button
                  variant="text"
                  sx={{
                    p: '6px 8px',
                    width: '100%',
                  }}
                  disabled
                >
                  Redeem
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </FeatureBox>
  );
}

export default DebtTokenTableLoader;
