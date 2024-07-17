import { Skeleton } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import HeaderCell from '../../Table/HeaderCell';

function HistoryTableLoader() {
  return (
    <TableContainer style={{ maxHeight: '100%', overflow: 'auto' }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <HeaderCell title="Opening" />
            <HeaderCell title="Type" />
            <HeaderCell title="Size" cellProps={{ align: 'right' }} />
            <HeaderCell title="" />
            <HeaderCell title="Price" cellProps={{ align: 'right' }} />
            <HeaderCell title="Price per unit" cellProps={{ align: 'right' }} />
            <HeaderCell title="Fee" cellProps={{ align: 'right' }} />
            <HeaderCell title="PNL" cellProps={{ align: 'center' }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {Array(9)
            .fill(null)
            .map((_, index) => (
              <TableRow hover key={index}>
                <TableCell>
                  <Skeleton variant="text" />
                </TableCell>
                <TableCell>
                  <Skeleton variant="text" width={50} />
                </TableCell>

                <TableCell align="right">
                  <Typography>
                    <Skeleton variant="text" />
                  </Typography>
                </TableCell>
                <TableCell sx={{ pl: 0 }}>
                  <Skeleton variant="text" width={50} />
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

                <TableCell width={300}>
                  <Skeleton variant="text" />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default HistoryTableLoader;
