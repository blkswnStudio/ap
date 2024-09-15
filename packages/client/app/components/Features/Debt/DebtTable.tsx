import { useQuery } from '@apollo/client';
import { Box, useTheme } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { useMemo } from 'react';
import { useEthers } from '../../../context/EthersProvider';
import { GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables } from '../../../generated/gql-types';
import { GET_BORROWER_DEBT_TOKENS } from '../../../queries';
import { dangerouslyConvertBigIntToNumber, roundCurrency, roundNumber } from '../../../utils/math';
import Label from '../../Label/Label';
import HeaderCell from '../../Table/HeaderCell';
import DebtPieVisualization from '../../Visualizations/DebtPieVisualization';
import DebtTableLoader from './DebtTableLoader';
import RepayDebtDialog from './RepayDebtDialog';

const generateColorPalette = (paletteLength: number) => {
  // Initialize an array with the first 3 fixed colors
  const colors = ['#3DD755', '#E04A4A', '#33B6FF'];

  // Add 5 well-matching colors
  const matchingColors = ['#FFA07A', '#8A2BE2', '#5F9EA0', '#D2691E', '#FFD700'];
  colors.push(...matchingColors);

  // Generate random colors for the remaining spots
  while (colors.length < paletteLength) {
    const randomColor = '#' + Math.floor(Math.random() * 16777215).toString(16);
    colors.push(randomColor);
  }

  // Slice the array to the desired length
  return colors.slice(0, paletteLength);
};

function DebtTable() {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const { address } = useEthers();

  const { data } = useQuery<GetBorrowerDebtTokensQuery, GetBorrowerDebtTokensQueryVariables>(GET_BORROWER_DEBT_TOKENS, {
    variables: { borrower: address },
    skip: !address,
  });

  const borrowerDebtTokens = useMemo(() => {
    const colorPalette: string[] = data ? generateColorPalette(data.debtTokenMetas.length) : [];

    return (
      data?.debtTokenMetas
        .filter(({ troveMintedAmount, walletAmount }) => walletAmount! > 0 || troveMintedAmount! > 0)
        .map((token) => ({
          ...token,
          troveMintedUSD: token.troveMintedAmount
            ? roundNumber(dangerouslyConvertBigIntToNumber(token.troveMintedAmount * token.token.priceUSDOracle, 30, 6))
            : 0,
        }))
        .sort((a, b) => b.troveMintedUSD - a.troveMintedUSD)
        // need to assign the color after sorting
        .map((token) => ({
          ...token,
          chartColor: colorPalette.shift() as string,
        })) ?? []
    );
  }, [data]);

  return (
    <div style={{ display: 'flex' }}>
      <Box
        style={{
          width: '40%',
          display: 'flex',
          justifyContent: 'center',
          backgroundColor: isDarkMode ? '#1e1b27' : '#f8f8f8',
        }}
      >
        <DebtPieVisualization
          borrowerDebtTokens={borrowerDebtTokens.filter(({ troveMintedAmount }) => troveMintedAmount > 0)}
        />
      </Box>
      <Box sx={{ width: '100%', borderLeft: '1px solid', borderColor: 'table.border' }}>
        <div style={{ padding: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
            }}
          >
            <RepayDebtDialog />
          </div>
        </div>

        {!data ? (
          <DebtTableLoader />
        ) : (
          <TableContainer data-testid="apollon-collateral-table">
            <Table>
              <TableHead>
                <TableRow>
                  <HeaderCell title="Debt" cellProps={{ align: 'right' }} />
                  <HeaderCell title="Wallet" cellProps={{ align: 'right' }} />
                  <HeaderCell title="Symbol" />
                </TableRow>
              </TableHead>
              <TableBody>
                {borrowerDebtTokens.map(({ token, walletAmount, troveMintedAmount, chartColor }) => (
                  <TableRow hover key={token.address}>
                    <TableCell align="right">
                      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" fill="none">
                          <path
                            fill={chartColor}
                            d="M4 0a6.449 6.449 0 0 0 4 4 6.449 6.449 0 0 0-4 4 6.449 6.449 0 0 0-4-4 6.449 6.449 0 0 0 4-4Z"
                          />
                        </svg>
                        <Typography color="primary.contrastText" fontWeight={400}>
                          {roundCurrency(dangerouslyConvertBigIntToNumber(troveMintedAmount!, 12, 6), 5, 5)}
                        </Typography>
                      </div>
                    </TableCell>
                    <TableCell align="right">
                      {roundCurrency(dangerouslyConvertBigIntToNumber(walletAmount!, 12, 6), 5, 5)}
                    </TableCell>
                    <TableCell>
                      <Label variant="none">{token.symbol}</Label>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </div>
  );
}

export default DebtTable;
