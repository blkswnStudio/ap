import { Skeleton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import FeatureBox from '../../FeatureBox/FeatureBox';
import ExchangeIcon from '../../Icons/ExchangeIcon';
import HeaderCell from '../../Table/HeaderCell';

function LiquidityPoolsTableLoader() {
  return (
    <FeatureBox title="Pools" noPadding headBorder="full">
      <TableContainer
        sx={{
          borderRight: '1px solid',
          borderLeft: '1px solid',
          borderColor: 'background.paper',
        }}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <HeaderCell title="Asset" cellProps={{ width: 1 }} />
              <HeaderCell title="" />
              <HeaderCell title="" />
              <HeaderCell title="" cellProps={{ align: 'right' }} />
              <HeaderCell title="" />
              <HeaderCell title="APY" cellProps={{ align: 'right' }} />
              <HeaderCell title="" />
              <HeaderCell title="24h Volume" />
            </TableRow>
          </TableHead>

          <TableBody>
            {Array(10)
              .fill(null)
              .map((_, index) => (
                <TableRow key={index}>
                  <TableCell
                    width={150}
                    align="right"
                    sx={{
                      borderLeft: index === 0 ? '2px solid #33B6FF' : 'none',
                    }}
                  >
                    <Skeleton variant="text" />

                    <span
                      style={{
                        fontSize: '11.7px',
                      }}
                    >
                      <Skeleton variant="text" />
                    </span>
                  </TableCell>

                  <TableCell sx={{ pl: 0 }} width={50}>
                    <Skeleton variant="text" />
                  </TableCell>

                  <TableCell align="center">
                    <ExchangeIcon />
                  </TableCell>

                  <TableCell align="right" width={150}>
                    <Skeleton variant="text" />

                    <span
                      style={{
                        fontSize: '11.7px',
                      }}
                    >
                      <Skeleton variant="text" />
                    </span>
                  </TableCell>

                  <TableCell sx={{ pl: 0 }} width={50}>
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell align="right" width={70}>
                    <Skeleton variant="text" />
                  </TableCell>

                  <TableCell align="right" sx={{ pr: 0, pl: 0 }} width={50}>
                    <Skeleton variant="text" />
                  </TableCell>
                  <TableCell align="left" width={130}>
                    <Skeleton variant="text" />
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
    </FeatureBox>
  );
}

export default LiquidityPoolsTableLoader;
