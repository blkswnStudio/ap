import { useQuery } from '@apollo/client';
import { Box, Tooltip, Typography } from '@mui/material';
import { useSelectedToken } from '../../context/SelectedTokenProvider';
import { GetSelectedTokenQuery, GetSelectedTokenQueryVariables } from '../../generated/gql-types';
import { GET_SELECTED_TOKEN } from '../../queries';
import { dangerouslyConvertBigIntToNumber, displayPercentage, percentageChange, roundCurrency } from '../../utils/math';

function TradingViewHeader() {
  const { selectedToken, tokenRatio, JUSDToken } = useSelectedToken();

  const { data } = useQuery<GetSelectedTokenQuery, GetSelectedTokenQueryVariables>(GET_SELECTED_TOKEN, {
    variables: {
      address: selectedToken?.address as string,
    },
    skip: !selectedToken,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        height: 74,
        marginLeft: 20,
        gap: 5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <Typography variant="h6">{selectedToken ? selectedToken.symbol : '-'}</Typography>
        <img
          src="assets/svgs/Star24_green.svg"
          alt="Green colored diamond shape"
          height="11"
          typeof="image/svg+xml"
          style={{ marginLeft: 10, marginRight: 10 }}
        />
        <Typography variant="subtitle1" fontFamily="Space Grotesk Variable">
          24h Volume
          <Box sx={{ color: 'text.primary', display: 'inline', ml: '8px' }}>
            {selectedToken ? roundCurrency(dangerouslyConvertBigIntToNumber(selectedToken.volume30dUSD, 9, 9)) : '-'}
          </Box>{' '}
          $
        </Typography>
        <Typography variant="subtitle1" fontFamily="Space Grotesk Variable">
          Pool
          <Box sx={{ color: 'text.primary', display: 'inline', ml: '8px' }}>
            {JUSDToken && selectedToken ? roundCurrency(dangerouslyConvertBigIntToNumber(tokenRatio, 9, 9)) : ' -'}
          </Box>{' '}
          $
        </Typography>
        <Typography variant="subtitle1" fontFamily="Space Grotesk Variable">
          Oracle
          <Box sx={{ color: 'text.primary', display: 'inline', ml: '8px' }}>
            {data?.token.priceUSDOracle !== undefined
              ? roundCurrency(dangerouslyConvertBigIntToNumber(data.token.priceUSDOracle, 9, 9))
              : ' -'}
          </Box>{' '}
          $
        </Typography>

        <Typography variant="subtitle1" fontFamily="Space Grotesk Variable">
          <Tooltip
            title="Premium between the oracle and DEX price."
            placement="right"
            sx={{ backgroundColor: 'background.emphasis' }}
            arrow
          >
            <Box sx={{ textDecorationLine: 'underline', textDecorationStyle: 'dashed', display: 'inline' }}>
              Premium
            </Box>
          </Tooltip>
          <Box sx={{ color: 'text.primary', display: 'inline', ml: '8px' }}>
            {data?.token.priceUSDOracle !== undefined && JUSDToken && selectedToken
              ? displayPercentage(
                  percentageChange(
                    dangerouslyConvertBigIntToNumber(tokenRatio, 9, 9) -
                      dangerouslyConvertBigIntToNumber(data.token.priceUSDOracle, 9, 9),
                    dangerouslyConvertBigIntToNumber(data.token.priceUSDOracle, 9, 9),
                  ),
                  'omit',
                )
              : ' -'}
          </Box>{' '}
          %
        </Typography>
        {/* <Typography variant="subtitle1" fontFamily="Space Grotesk Variable">
          Swap Fee
          <Box sx={{ color: 'text.primary', display: 'inline', ml: '8px' }}>
            {selectedToken
              ? displayPercentage(dangerouslyConvertBigIntToNumber(selectedToken.swapFee, 12, 6), 'omit')
              : ' -'}
          </Box>{' '}
          %
        </Typography> */}
      </div>
    </div>
  );
}

export default TradingViewHeader;
