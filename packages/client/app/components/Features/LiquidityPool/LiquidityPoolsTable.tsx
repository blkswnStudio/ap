'use client';

import { useQuery } from '@apollo/client';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import Typography from '@mui/material/Typography';
import { useEffect, useMemo } from 'react';
import { isStableCoinAddress } from '../../../../config';
import { useEthers } from '../../../context/EthersProvider';
import { GetBorrowerLiquidityPoolsQuery, GetBorrowerLiquidityPoolsQueryVariables } from '../../../generated/gql-types';
import { GET_BORROWER_LIQUIDITY_POOLS } from '../../../queries';
import { standardDataPollInterval } from '../../../utils/contants';
import {
  bigIntStringToFloat,
  dangerouslyConvertBigIntToNumber,
  displayPercentage,
  percentageChange,
  roundCurrency,
  stdFormatter,
} from '../../../utils/math';
import FeatureBox from '../../FeatureBox/FeatureBox';
import DirectionIcon from '../../Icons/DirectionIcon';
import ExchangeIcon from '../../Icons/ExchangeIcon';
import Label from '../../Label/Label';
import HeaderCell from '../../Table/HeaderCell';
import LiquidityPoolsTableLoader from './LiquidityPoolsTableLoader';

type Props = {
  selectedPoolId: string | null;
  setSelectedPoolId: (poolId: string | null) => void;
};

function LiquidityPoolsTable({ selectedPoolId, setSelectedPoolId }: Props) {
  const { address } = useEthers();

  const {
    data: borrowerPoolsData,
    loading,
    refetch,
  } = useQuery<GetBorrowerLiquidityPoolsQuery, GetBorrowerLiquidityPoolsQueryVariables>(GET_BORROWER_LIQUIDITY_POOLS, {
    variables: { borrower: address },
    pollInterval: standardDataPollInterval,
  });

  const allPoolsSorted: GetBorrowerLiquidityPoolsQuery['pools'] = useMemo(() => {
    const poolsCopy = [...(borrowerPoolsData?.pools ?? [])];

    const calculateLiquidityUSD = (
      borrowerAmount: bigint,
      totalSupply: string,
      liquidity: GetBorrowerLiquidityPoolsQuery['pools'][number]['liquidity'],
    ) => {
      return (
        (dangerouslyConvertBigIntToNumber(borrowerAmount) / bigIntStringToFloat(totalSupply)) *
        liquidity.reduce(
          (acc, { totalAmount, token }) =>
            acc +
            bigIntStringToFloat(totalAmount, token.decimals) *
              dangerouslyConvertBigIntToNumber(token.priceUSDOracle, 9, 9),
          0,
        )
      );
    };

    const calculateTotalLiquidityUSD = (liquidity: GetBorrowerLiquidityPoolsQuery['pools'][number]['liquidity']) => {
      return liquidity.reduce(
        (acc, { totalAmount, token }) =>
          acc +
          bigIntStringToFloat(totalAmount, token.decimals) *
            dangerouslyConvertBigIntToNumber(token.priceUSDOracle, 9, 9),
        0,
      );
    };

    return poolsCopy
      .sort((a, b) => {
        const userLiquidityA = calculateLiquidityUSD(a.borrowerAmount, a.totalSupply, a.liquidity);
        const userLiquidityB = calculateLiquidityUSD(b.borrowerAmount, b.totalSupply, b.liquidity);
        const totalLiquidityA = calculateTotalLiquidityUSD(a.liquidity);
        const totalLiquidityB = calculateTotalLiquidityUSD(b.liquidity);

        // First, sort by user liquidity in USD
        if (userLiquidityA !== userLiquidityB) {
          return userLiquidityB - userLiquidityA; // Descending order
        }

        // Then, sort by total liquidity in USD if user liquidity is equal
        return totalLiquidityB - totalLiquidityA; // Descending order
      })
      .map((pool) => ({
        ...pool,
        liquidity: isStableCoinAddress(pool.liquidity[0].token.address)
          ? pool.liquidity
          : [pool.liquidity[1], pool.liquidity[0]],
      }));
  }, [borrowerPoolsData]);

  useEffect(() => {
    // Select first pool by default
    if (allPoolsSorted.length > 0 && selectedPoolId === null) {
      setSelectedPoolId(allPoolsSorted[0].id);
    }
  }, [allPoolsSorted, setSelectedPoolId, selectedPoolId]);

  if (!borrowerPoolsData && loading) return <LiquidityPoolsTableLoader />;

  return (
    <FeatureBox title="Pools" noPadding headBorder="full" sx={{ position: 'relative', left: '-1px' }}>
      <TableContainer
        sx={{
          borderRight: '1px solid',
          borderLeft: '1px solid',
          borderColor: 'background.paper',
          // // screen - toolbar - feature box - padding top - padding bottom
          // maxHeight: 'calc(100vh - 64px - 54px - 20px - 20px)',
          // overflowY: 'scroll',
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
              <HeaderCell title="30d Volume" cellProps={{ align: 'right', colSpan: 2 }} />
            </TableRow>
          </TableHead>

          <TableBody>
            {allPoolsSorted.map((pool) => {
              const {
                id,
                liquidity,
                volume30dUSD,
                volume30dUSD30dAgo,
                liquidityDepositAPY,
                borrowerAmount,
                totalSupply,
              } = pool;
              const [tokenA, tokenB] = liquidity;
              const volumeChange = percentageChange(
                bigIntStringToFloat(volume30dUSD.value),
                bigIntStringToFloat(volume30dUSD30dAgo.value),
              );

              return (
                <TableRow
                  key={id}
                  data-testid="apollon-liquidity-pool-table-row"
                  hover={selectedPoolId !== id}
                  selected={selectedPoolId === id}
                  sx={{
                    ':hover': {
                      cursor: selectedPoolId !== id ? 'pointer' : 'default',
                    },
                  }}
                  onClick={() => {
                    setSelectedPoolId(pool.id);
                    refetch();
                  }}
                >
                  <TableCell
                    align="right"
                    sx={{
                      borderLeft: selectedPoolId === id ? '2px solid #33B6FF' : 'none',
                      pl: selectedPoolId === id ? 0 : 2,
                    }}
                  >
                    <Typography fontWeight={400} data-testid="apollon-liquidity-pool-table-row-borrower-amount-token-a">
                      {roundCurrency(
                        dangerouslyConvertBigIntToNumber(
                          (borrowerAmount * BigInt(tokenA.totalAmount)) / BigInt(totalSupply),
                          tokenA.token.decimals - 6,
                          6,
                        ),
                        5,
                        5,
                      )}
                      <br />
                      <span
                        style={{
                          color: '#827F8B',
                          fontSize: '11.7px',
                        }}
                      >
                        {roundCurrency(bigIntStringToFloat(tokenA.totalAmount, tokenA.token.decimals), 5, 5)}
                      </span>
                    </Typography>
                  </TableCell>

                  <TableCell sx={{ pl: 0, width: '50px', maxWidth: '200px' }} align="right">
                    <Label variant="none">{tokenA.token.symbol}</Label>
                  </TableCell>

                  <TableCell align="center" width={200}>
                    <ExchangeIcon />
                  </TableCell>

                  <TableCell sx={{ pr: 0, width: '50px', maxWidth: '200px' }} align="right">
                    <Typography fontWeight={400} data-testid="apollon-liquidity-pool-table-row-borrower-amount-token-b">
                      {roundCurrency(
                        dangerouslyConvertBigIntToNumber(
                          (borrowerAmount * BigInt(tokenB.totalAmount)) / BigInt(totalSupply),
                          tokenB.token.decimals - 6,
                          6,
                        ),
                        5,
                        5,
                      )}
                      <br />
                      <span
                        style={{
                          color: '#827F8B',
                          fontSize: '11.7px',
                        }}
                      >
                        {roundCurrency(bigIntStringToFloat(tokenB.totalAmount, tokenB.token.decimals), 5, 5)}
                      </span>
                    </Typography>
                  </TableCell>

                  <TableCell>
                    <Label variant="none">{tokenB.token.symbol}</Label>
                  </TableCell>
                  <TableCell align="right">{displayPercentage(bigIntStringToFloat(liquidityDepositAPY))}</TableCell>

                  <TableCell align="right" sx={{ pr: 0, pl: 1, width: '50px', maxWidth: '200px' }}>
                    <Typography variant="caption" noWrap>
                      {stdFormatter.format(bigIntStringToFloat(volume30dUSD.value))} $
                    </Typography>
                  </TableCell>
                  <TableCell align="right" width={125}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <Typography
                        sx={{
                          color: volumeChange > 0 ? 'success.main' : 'error.main',
                          mr: 0.5,
                        }}
                        fontWeight={400}
                      >
                        {displayPercentage(volumeChange, 'positive')}
                      </Typography>
                      <DirectionIcon showIncrease={volumeChange > 0} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </FeatureBox>
  );
}

export default LiquidityPoolsTable;