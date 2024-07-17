import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Typography, useTheme } from '@mui/material';
import { Cell, Pie, PieChart } from 'recharts';
import { GetBorrowerDebtTokensQuery } from '../../generated/gql-types';
import { roundCurrency } from '../../utils/math';

type Props = {
  borrowerDebtTokens: (GetBorrowerDebtTokensQuery['debtTokenMetas'][number] & {
    chartColor?: string;
    troveMintedUSD: number;
  })[];
};

// eslint-disable-next-line react/display-name
const createRenderCustomizedLabel = (isDarkMode: boolean) => (svgPropsAndData: any) => {
  // has all the spread data and some props from the library
  const { x, y, cx, troveMintedUSD, chartColor, token } = svgPropsAndData;
  const isRight = x > cx;

  return (
    <g id="group1">
      {/* <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" x={isRight ? x + 15 : x - 60} y={y - 15}>
        <path
          fill={chartColor}
          d="M4 0a6.449 6.449 0 0 0 4 4 6.449 6.449 0 0 0-4 4 6.449 6.449 0 0 0-4-4 6.449 6.449 0 0 0 4-4Z"
        />
      </svg> */}
      <text
        fill={isDarkMode ? '#504D59' : '#939393'}
        x={isRight ? x + 15 : x - 10}
        y={y - 10}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
      >
        {token.symbol}
      </text>
      <text
        fill={chartColor}
        x={isRight ? x + 15 : x - 10}
        y={y + 10}
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
      >
        {roundCurrency(troveMintedUSD)}$
      </text>
    </g>
  );
};

function DebtPieVisualization({ borrowerDebtTokens }: Props) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  if (borrowerDebtTokens.length === 0)
    return (
      <div style={{ width: 430, height: 280, display: 'grid', placeItems: 'center' }}>
        <div
          style={{
            border: `2px solid ${isDarkMode ? '#3C3945' : '#CBCBCB'}`,
            backgroundColor: isDarkMode ? '#282531' : '#ECECEC',
            borderRadius: 5,
            padding: '3px 10px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <InfoOutlinedIcon sx={{ marginRight: '3px' }} color="primary" fontSize="small" />
          <Typography variant="titleAlternate">No Data to Show</Typography>
        </div>
      </div>
    );

  const renderCustomizedLabel = createRenderCustomizedLabel(isDarkMode);

  const sumTroveMintedUSD = borrowerDebtTokens.reduce((acc, { troveMintedUSD }) => acc + troveMintedUSD, 0);
  // group everything below 5% into 'Others'
  const visualizationDataGrouped = borrowerDebtTokens
    .map((token) => ({ ...token, percentage: token.troveMintedUSD / sumTroveMintedUSD }))
    .reduce(
      (acc, token) => {
        if (token.percentage < 0.15) {
          acc.others.troveMintedAmount += token.troveMintedAmount;
          acc.others.troveMintedUSD += token.troveMintedUSD;
          if (acc.others.chartColor === '') {
            acc.others.chartColor = token.chartColor!;
          }
        } else {
          acc.tokens.push(token);
        }

        return acc;
      },
      {
        tokens: [] as typeof borrowerDebtTokens,
        others: { troveMintedUSD: 0, troveMintedAmount: 0n, chartColor: '', token: { symbol: 'Other' } },
      },
    );

  return (
    <PieChart width={430} height={280} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
      <Pie
        isAnimationActive={false}
        data={
          visualizationDataGrouped.others.troveMintedUSD > 0
            ? [...visualizationDataGrouped.tokens, visualizationDataGrouped.others]
            : visualizationDataGrouped.tokens
        }
        dataKey="troveMintedUSD"
        nameKey="token.symbol"
        innerRadius={90}
        outerRadius={92}
        paddingAngle={1}
        label={renderCustomizedLabel}
        labelLine={{ stroke: isDarkMode ? '#504D59' : '#939393', strokeWidth: 2 }}
      >
        {borrowerDebtTokens.map(({ token, chartColor }) => (
          <Cell stroke="transparent" key={token.address} fill={chartColor} />
        ))}
      </Pie>
    </PieChart>
  );
}

export default DebtPieVisualization;
