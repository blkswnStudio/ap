import { Skeleton } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import HeaderCell from '../../Table/HeaderCell';

function CollateralTableLoader() {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <HeaderCell title="Trove" cellProps={{ align: 'right' }} />
            <HeaderCell title="Wallet" cellProps={{ align: 'right' }} />
            <HeaderCell title="Symbol" />
          </TableRow>
        </TableHead>
        <TableBody>
          {Array(5)
            .fill(null)
            .map((_, index) => (
              <TableRow key={index}>
                <TableCell align="right" width={500}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" fill="none">
                      <path
                        fill="#FFF"
                        d="M4 0a6.449 6.449 0 0 0 4 4 6.449 6.449 0 0 0-4 4 6.449 6.449 0 0 0-4-4 6.449 6.449 0 0 0 4-4Z"
                      />
                    </svg>
                    <Skeleton variant="text" width={200} />
                  </div>
                </TableCell>
                <TableCell align="right">
                  <Skeleton variant="text" />
                </TableCell>
                <TableCell>
                  <Skeleton variant="text" width={50} />
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default CollateralTableLoader;
