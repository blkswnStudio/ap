'use client';

import { useQuery } from '@apollo/client';
import { Box, IconButton, Typography } from '@mui/material';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { parseUnits } from 'ethers';
import { useEffect, useMemo, useState } from 'react';
import { isStableCoinAddress } from '../../../../config';
import { SelectedToken, useSelectedToken } from '../../../context/SelectedTokenProvider';
import {
  GetAllPoolsQuery,
  GetAllPoolsQueryVariables,
  GetPastTokenPricesQuery,
  GetPastTokenPricesQueryVariables,
} from '../../../generated/gql-types';
import { GET_ALL_POOLS, GET_TOKEN_PRICES_24h_AGO } from '../../../queries';
import { WIDGET_HEIGHTS, standardDataPollInterval } from '../../../utils/contants';
import { getCheckSum } from '../../../utils/crypto';
import {
  convertToEtherPrecission,
  dangerouslyConvertBigIntToNumber,
  displayPercentage,
  divBigIntsToFloat,
  percentageChange,
  roundCurrency,
} from '../../../utils/math';
import FeatureBox from '../../FeatureBox/FeatureBox';
import DirectionIcon from '../../Icons/DirectionIcon';
import PinnedIcon from '../../Icons/PinnedIcon';
import HeaderCell from '../../Table/HeaderCell';
import AssetsLoader from './AssetsLoader';

export const FAVORITE_ASSETS_LOCALSTORAGE_KEY = 'favoriteAssets';

function Assets() {
  const [favoritedAssets, setFavoritedAssets] = useState<string[]>([]);

  // FIXME: Cant access LS in useState initializer because of page pre-rendering.
  useEffect(() => {
    setFavoritedAssets(JSON.parse(window.localStorage.getItem(FAVORITE_ASSETS_LOCALSTORAGE_KEY) ?? '[]'));
  }, []);

  const { selectedToken, setSelectedToken, JUSDToken } = useSelectedToken();

  // TODO: Implement a filter for only JUSD to subgraph
  const { data } = useQuery<GetAllPoolsQuery, GetAllPoolsQueryVariables>(GET_ALL_POOLS, {
    pollInterval: 5000,
  });
  const { data: pastTokenPrices } = useQuery<GetPastTokenPricesQuery, GetPastTokenPricesQueryVariables>(
    GET_TOKEN_PRICES_24h_AGO,
    {
      pollInterval: standardDataPollInterval,
    },
  );

  const tokens = useMemo<SelectedToken[]>(() => {
    const jUSDPools =
      data?.pools.filter(({ liquidity }) => {
        const [tokenA, tokenB] = liquidity;

        return isStableCoinAddress(tokenA.token.address) || isStableCoinAddress(tokenB.token.address);
      }) ?? [];

    // get token address from local storage and set isFavorite if it is present
    return jUSDPools
      .map<SelectedToken>(({ id, address, liquidity, swapFee, volume30dUSD }) => {
        const [tokenA, tokenB] = liquidity;
        const token = isStableCoinAddress(tokenA.token.address) ? tokenB.token : tokenA.token;

        const pastToken = pastTokenPrices?.tokenCandles.find(
          ({ token: pastToken }) => token.address === pastToken.address,
        );
        const pastPrice = pastToken?.close ? BigInt(pastToken?.close) : BigInt(0);

        return {
          ...token,
          priceUSD24hAgo: pastPrice,
          swapFee,
          // calculate change over last 24h
          change:
            pastPrice > 0
              ? (dangerouslyConvertBigIntToNumber(token.priceUSDOracle, 9, 9) -
                  dangerouslyConvertBigIntToNumber(pastPrice, 9, 9)) /
                dangerouslyConvertBigIntToNumber(pastPrice, 9, 9)
              : 0,
          isFavorite: favoritedAssets.find((address) => token.address === address) !== undefined ? true : false,
          volume30dUSD: BigInt(volume30dUSD.value),
          pool: {
            id,
            address,
            liquidityPair: isStableCoinAddress(tokenA.token.address)
              ? [BigInt(tokenA.totalAmount), BigInt(tokenB.totalAmount)]
              : [BigInt(tokenB.totalAmount), BigInt(tokenA.totalAmount)],
            totalValueUSD: isStableCoinAddress(tokenA.token.address)
              ? (BigInt(tokenA.totalAmount) * tokenA.token.priceUSDOracle +
                  convertToEtherPrecission(BigInt(tokenB.totalAmount), tokenB.token.decimals) *
                    tokenB.token.priceUSDOracle) /
                parseUnits('1', 18)
              : (convertToEtherPrecission(BigInt(tokenA.totalAmount), tokenA.token.decimals) *
                  tokenA.token.priceUSDOracle +
                  BigInt(tokenB.totalAmount) * tokenB.token.priceUSDOracle) /
                parseUnits('1', 18),
          },
        };
      })
      .sort((a, b) => {
        if (a.isFavorite && !b.isFavorite) {
          return -1; // a is favorite, b is not, a comes first
        } else if (!a.isFavorite && b.isFavorite) {
          return 1; // b is favorite, a is not, b comes first
        } else {
          // If both have the same isFavorite status, sort by totalValueUSD (descending)
          return b.pool.totalValueUSD - a.pool.totalValueUSD > 0 ? 1 : -1;
        }
      });
  }, [data, favoritedAssets, pastTokenPrices]);

  const toggleFavorite = (address: string) => {
    const favoritedAssetsFromLS: string[] = JSON.parse(
      window.localStorage.getItem(FAVORITE_ASSETS_LOCALSTORAGE_KEY) ?? '[]',
    );
    const assetIncluded = favoritedAssetsFromLS.includes(address);

    if (assetIncluded) {
      const tokenInListIndex = favoritedAssetsFromLS.findIndex((addressInLS) => addressInLS === address);
      favoritedAssetsFromLS.splice(tokenInListIndex, 1);
      window.localStorage.setItem(FAVORITE_ASSETS_LOCALSTORAGE_KEY, JSON.stringify(favoritedAssetsFromLS));
      setFavoritedAssets(favoritedAssetsFromLS);
    } else {
      favoritedAssetsFromLS.push(address);
      window.localStorage.setItem(FAVORITE_ASSETS_LOCALSTORAGE_KEY, JSON.stringify(favoritedAssetsFromLS));
      setFavoritedAssets(favoritedAssetsFromLS);
    }
  };

  useEffect(() => {
    if (tokens.length && !selectedToken && JUSDToken) {
      // Parse the hash to get the token address
      const hash = window.location.hash.substring(1); // Remove the '#' symbol
      const hashParams = new URLSearchParams(hash);
      const tokenAddressFromHash = hashParams.get('token');

      // Select the token based on the hash or default to the first token
      const preselectedToken = tokenAddressFromHash
        ? tokens.find(({ address }) => getCheckSum(address) === getCheckSum(tokenAddressFromHash)) ?? tokens[0]
        : tokens[0];

      if (
        preselectedToken.borrowingRate <= 0 ||
        preselectedToken.decimals <= 0 ||
        // TODO: There is no priceFeed yet, comment this back in later
        // preselectedToken.priceUSDOracle <= 0 ||
        preselectedToken.swapFee <= 0
      ) {
        return;
      }
      setSelectedToken(preselectedToken);
    } else if (tokens.length && selectedToken) {
      const updatedToken =
        tokens.find(({ address }) => getCheckSum(address) === getCheckSum(selectedToken.address)) ?? tokens[0];
      setSelectedToken(updatedToken);
    }
  }, [tokens, setSelectedToken, selectedToken, JUSDToken]);

  const handleSelectToken = (token: SelectedToken) => {
    setSelectedToken(token);

    // Modify the URL hash to include the token address
    window.location.hash = `token=${token.address}`;
  };
  return (
    <FeatureBox
      title="Assets"
      noPadding
      border="bottom"
      isDraggable={{
        y: '0',
        gsHeight: WIDGET_HEIGHTS['apollon-assets-widget'].toString(),
        gsWidth: '1',
        id: 'apollon-assets-widget',
      }}
    >
      {tokens.length === 0 || !JUSDToken ? (
        <AssetsLoader />
      ) : (
        <TableContainer sx={{ maxHeight: 170, overflowY: 'scroll' }}>
          <Table stickyHeader size="small">
            <TableHead sx={{ borderBottom: '1px solid', borderBottomColor: 'background.paper' }}>
              <TableRow>
                <HeaderCell title="Type" cellProps={{ sx: { p: 0.5, pl: 2 } }} />
                <HeaderCell title={JUSDToken.symbol} cellProps={{ align: 'right', sx: { p: 0.5 } }} />
                <HeaderCell
                  title="PR %"
                  cellProps={{ align: 'right', sx: { p: 0.5 } }}
                  tooltipProps={{
                    title: 'Premium between oracle and DEX price.',
                    arrow: true,
                    placement: 'right',
                  }}
                />
                <HeaderCell
                  title="24h"
                  cellProps={{ align: 'right', sx: { p: 0.5 } }}
                  tooltipProps={{
                    title: '24h price movement in %.',
                    arrow: true,
                    placement: 'right',
                  }}
                />
                <HeaderCell title="" cellProps={{ sx: { p: 0.5, pr: 2 } }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {tokens.map((token) => {
                const {
                  id,
                  address,
                  isFavorite,
                  symbol,
                  change,
                  priceUSDOracle,
                  pool: { liquidityPair },
                } = token;

                const pricePremium =
                  percentageChange(
                    dangerouslyConvertBigIntToNumber(priceUSDOracle, 9, 9),
                    divBigIntsToFloat(liquidityPair[0], convertToEtherPrecission(liquidityPair[1], token.decimals), 5),
                  ) * -1;

                return (
                  <TableRow
                    key={id}
                    data-testid="apollon-assets-row"
                    hover
                    onClick={() => handleSelectToken(token)}
                    sx={{ cursor: 'pointer', '& .MuiTableCell-root': { borderBottom: 'none' } }}
                    selected={selectedToken?.address === address}
                  >
                    <TableCell sx={{ p: 0.5, pl: 2 }}>
                      <Typography fontWeight={400}>{symbol}</Typography>
                    </TableCell>
                    <TableCell sx={{ p: 0.5 }} align="right">
                      <Typography fontWeight={400}>
                        {roundCurrency(
                          divBigIntsToFloat(
                            liquidityPair[0],
                            convertToEtherPrecission(liquidityPair[1], token.decimals),
                            5,
                          ),
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ p: 0.5 }} align="right" width={60}>
                      <Typography fontWeight={400} sx={{ color: pricePremium <= 0 ? 'success.main' : 'error.main' }}>
                        {displayPercentage(pricePremium, 'omit')}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ p: 0.5 }} align="right" width={80}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignContent: 'center',
                          justifyContent: 'flex-end',
                          gap: 0.5,
                          color: change > 0 ? 'success.main' : 'error.main',
                        }}
                      >
                        {displayPercentage(change, 'omit')} <DirectionIcon showIncrease={change > 0} fontSize="small" />
                      </Box>
                    </TableCell>
                    <TableCell sx={{ p: 0.5, pr: 2, minWidth: '30px' }} align="right" width={50}>
                      <IconButton
                        data-testid="apollon-assets-favorite"
                        sx={{ height: 20, width: 20 }}
                        size="small"
                        onClick={() => toggleFavorite(address)}
                        disableRipple
                      >
                        <PinnedIcon isFavorite={isFavorite} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </FeatureBox>
  );
}

export default Assets;
