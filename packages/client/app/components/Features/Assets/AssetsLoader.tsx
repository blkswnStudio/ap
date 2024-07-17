import { IconButton, Skeleton, Typography } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import HeaderCell from '../../Table/HeaderCell';

function AssetsLoader() {
  return (
    <TableContainer sx={{ maxHeight: 170, overflowY: 'hidden' }}>
      <Table stickyHeader size="small">
        <TableHead sx={{ borderBottom: '1px solid', borderBottomColor: 'background.paper' }}>
          <TableRow>
            <HeaderCell title="Type" cellProps={{ sx: { p: 0.5, pl: 2 } }} />
            <HeaderCell title="$" cellProps={{ align: 'right', sx: { p: 0.5 } }} />
            <HeaderCell
              title="SF %"
              cellProps={{ align: 'right', sx: { p: 0.5 } }}
              // TODO: Add Tooltip text
              tooltipProps={{ title: 'TODO: Add Description', arrow: true, placement: 'right' }}
            />
            <HeaderCell title="%" cellProps={{ align: 'right', sx: { p: 0.5 } }} />
            <HeaderCell title="" cellProps={{ sx: { p: 0.5, pr: 2 } }} />
          </TableRow>
        </TableHead>
        <TableBody data-testid="apollon-assets-loader">
          {Array(5)
            .fill(null)
            .map((_, index) => (
              <TableRow key={index} hover sx={{ '& .MuiTableCell-root': { borderBottom: 'none' } }}>
                <TableCell sx={{ p: 0.5, pl: 2 }}>
                  <Typography fontWeight={400}>
                    <Skeleton variant="text" />
                  </Typography>
                </TableCell>
                <TableCell sx={{ p: 0.5 }} align="right">
                  <Typography fontWeight={400}>
                    <Skeleton variant="text" />
                  </Typography>
                </TableCell>
                <TableCell sx={{ p: 0.5 }} align="right" width={65}>
                  <Typography fontWeight={400}>
                    <Skeleton variant="text" />
                  </Typography>
                </TableCell>
                <TableCell sx={{ p: 0.5 }} align="right" width={85}>
                  <Skeleton variant="text" />
                </TableCell>
                <TableCell sx={{ p: 0.5, pr: 2 }} align="right" width={50}>
                  <IconButton sx={{ height: 20, width: 20 }} size="small" disableRipple>
                    <img
                      src="assets/svgs/Pinned_inactive.svg"
                      alt="a grey pin icon with a transparent body"
                      height="17"
                      width="15.6"
                      typeof="image/svg+xml"
                    />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default AssetsLoader;
