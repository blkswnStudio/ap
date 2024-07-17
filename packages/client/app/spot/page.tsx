import 'gridstack/dist/gridstack.css';

import Box from '@mui/material/Box';
import Assets from '../components/Features/Assets/Assets';
import BalanceTable from '../components/Features/BalanceTable/BalanceTable';
import Farm from '../components/Features/Farm/Farm';
import Swap from '../components/Features/Swap/Swap';
import ResizeableDiv from '../components/GridStack/ResizeableDiv';
import SpotWidgetGridStack from '../components/GridStack/SpotWidgetGridStack';
import TradingViewComponent from '../components/TradingView/TradingView';

function Spot() {
  return (
    <div
      style={{
        height: 'calc(100vh - 52px)',
        display: 'flex',
      }}
    >
      <Box
        sx={{
          borderRight: '1px solid',
          borderRightColor: 'background.paper',
          overflowY: 'scroll',
          // After that it looks broken and is way too small anyway
          minWidth: '400px',
          width: '20vw',
        }}
      >
        <SpotWidgetGridStack>
          <Assets />
          <Swap />
          <Farm />
        </SpotWidgetGridStack>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          width: '80vw',
        }}
      >
        <TradingViewComponent />
        <Box>
          <ResizeableDiv>
            <BalanceTable />
          </ResizeableDiv>
        </Box>
      </Box>
    </div>
  );
}

export default Spot;
