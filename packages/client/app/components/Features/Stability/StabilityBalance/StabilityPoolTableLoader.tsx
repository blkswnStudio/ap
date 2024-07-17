import { Button, Skeleton } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import FeatureBox from '../../../FeatureBox/FeatureBox';
import HeaderCell from '../../../Table/HeaderCell';

function StabilityPoolTableLoader() {
  return (
    <FeatureBox title="Stability Pool" noPadding border="full" borderRadius>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <TableContainer>
          <Table sx={{ borderRight: '1px solid', borderColor: 'background.emphasis' }}>
            <TableHead>
              <TableRow>
                <HeaderCell title="Lost Stability" />

                <HeaderCell title="Gained collateral" />
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Skeleton variant="text" />
                </TableCell>

                <TableCell>
                  <Skeleton variant="text" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  <Skeleton variant="text" />
                </TableCell>

                <TableCell>
                  <Skeleton variant="text" />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ borderBottom: 'none' }}>
                  <Skeleton variant="text" />
                </TableCell>
                <TableCell sx={{ borderBottom: 'none' }}>
                  <Skeleton variant="text" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <div style={{ minWidth: 190, margin: '0 30px' }}>
          <Button variant="contained">History</Button>

          <div style={{ marginTop: '10px' }}>
            <Button variant="outlined">UPDATE</Button>
          </div>

          <Button variant="outlined" sx={{ marginTop: '10px' }}>
            CLAIM
          </Button>
        </div>
      </div>
    </FeatureBox>
  );
}

export default StabilityPoolTableLoader;
