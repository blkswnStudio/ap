// import { useQuery } from '@apollo/client';
// import Button from '@mui/material/Button';
// import Table from '@mui/material/Table';
// import TableBody from '@mui/material/TableBody';
// import TableCell from '@mui/material/TableCell';
// import TableContainer, { TableContainerProps } from '@mui/material/TableContainer';
// import TableHead from '@mui/material/TableHead';
// import TableRow from '@mui/material/TableRow';
// import Typography from '@mui/material/Typography';
// import { useSelectedToken } from '../../../context/SelectedTokenProvider';
// import {
//   GetBorrowerSwapEventsQuery,
//   GetBorrowerSwapEventsQueryVariables,
//   LongShortDirection,
// } from '../../../generated/gql-types';
// import { GET_BORROWER_POSITIONS } from '../../../queries';
// import { formatUnixTimestamp } from '../../../utils/date';
// import { displayPercentage, percentageChange, roundCurrency, stdFormatter } from '../../../utils/math';
// import DirectionIcon from '../../Icons/DirectionIcon';
// import Label from '../../Label/Label';
// import HeaderCell from '../../Table/HeaderCell';
// import PositionsTableLoader from './PositionsTableLoader';

// function PositionsTable() {
//   const { address } = useEthers();
//   const { JUSDToken } = useSelectedToken();

//   const { data, fetchMore } = useQuery<GetBorrowerSwapEventsQuery, GetBorrowerSwapEventsQueryVariables>(
//     GET_BORROWER_POSITIONS,
//     {
//       variables: {
//         borrower: address,
//         isOpen: true,
//         cursor: null,
//       },
//     },
//   );

//   const handleScroll: TableContainerProps['onScroll'] = (event) => {
//     const scrollableDiv = event.target as HTMLDivElement;
//     if (scrollableDiv.scrollTop + scrollableDiv.clientHeight >= scrollableDiv.scrollHeight) {
//       if (data?.swapEvents.pageInfo.hasNextPage) {
//         fetchMorePositions();
//       }
//     }
//   };

//   const fetchMorePositions = () => {
//     fetchMore({
//       variables: {
//         cursor: data?.swapEvents.pageInfo.endCursor,
//       },
//     });
//   };

//   if (!data) return <PositionsTableLoader />;

//   return (
//     <TableContainer onScroll={handleScroll} style={{ maxHeight: '100%', overflow: 'auto' }}>
//       <Table stickyHeader data-testid="apollon-positions-table">
//         <TableHead>
//           <TableRow>
//             <HeaderCell title="Opening" />
//             <HeaderCell title="Type" />
//             <HeaderCell title="Size" cellProps={{ align: 'right', colSpan: 2 }} />
//             <HeaderCell title="Price" cellProps={{ align: 'right' }} />
//             <HeaderCell title="Price per unit" cellProps={{ align: 'right' }} />
//             <HeaderCell title="Fee" cellProps={{ align: 'right' }} />
//             <HeaderCell title="PNL" cellProps={{ align: 'right', colSpan: 2 }} />
//             <HeaderCell title="" />
//           </TableRow>
//         </TableHead>
//         <TableBody>
//           {data?.swapEvents.positions.map(
//             ({ id, direction, swapFee, timestamp, size, token, totalPriceInStable }) => {
//               const ratioStableCoinNow = token.priceUSDOracle / JUSDToken!.priceUSDOracle;
//               const totalPriceInStableNow = ratioStableCoinNow * size;
//               const pnl = totalPriceInStableNow - totalPriceInStable;

//               return (
//                 <TableRow hover key={id}>
//                   <TableCell>{formatUnixTimestamp(timestamp)}</TableCell>
//                   <TableCell>
//                     {direction === LongShortDirection.Long ? (
//                       <Label variant="success" fixedWidth={false}>
//                         Long
//                       </Label>
//                     ) : (
//                       <Label variant="error" fixedWidth={false}>
//                         Short
//                       </Label>
//                     )}
//                   </TableCell>

//                   <TableCell align="right">
//                     <Typography color="primary.contrastText" fontWeight={400}>
//                       {stdFormatter.format(size)}
//                     </Typography>
//                   </TableCell>
//                   <TableCell sx={{ pl: 0 }} width={50}>
//                     <Label variant="none">{token.symbol}</Label>
//                   </TableCell>

//                   <TableCell align="right">{roundCurrency(totalPriceInStable)} jUSD</TableCell>

//                   <TableCell align="right">{roundCurrency(totalPriceInStable / size)} jUSD</TableCell>

//                   <TableCell align="right">{roundCurrency(swapFee, 5)} jUSD</TableCell>
//                   <TableCell align="right" sx={{ pr: 0 }}>
//                     <Typography sx={{ color: pnl > 0 ? 'success.main' : 'error.main', fontWeight: '400' }}>
//                       {roundCurrency(pnl)} jUSD
//                     </Typography>
//                   </TableCell>
//                   <TableCell width={125}>
//                     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
//                       <Typography sx={{ color: pnl > 0 ? 'success.main' : 'error.main', fontWeight: '400', mr: '5px' }}>
//                         {displayPercentage(percentageChange(totalPriceInStableNow, totalPriceInStable), 'positive')}
//                       </Typography>
//                       <DirectionIcon showIncrease={pnl > 0} />
//                     </div>
//                   </TableCell>
//                   <TableCell align="right">
//                     <Button variant="rounded">Close</Button>
//                   </TableCell>
//                 </TableRow>
//               );
//             },
//           )}
//         </TableBody>
//       </Table>
//     </TableContainer>
//   );
// }

// export default PositionsTable;
