'use client';

import FeatureBox from '../../../FeatureBox/FeatureBox';
import DebtTokenTable from './DebtTokenTable';
import StabilityPoolTable from './StabilityPoolTable';
import SystemCollateralRatioChart from './SystemCollateralRatioChart';
import TotalValueMintedChart from './TotalValueMintedChart';

function StabilityBalance() {
  return (
    <FeatureBox title="Debt" headBorder="bottom" icon="green">
      <div style={{ display: 'flex', width: '100%' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', flexDirection: 'column' }}>
          <div style={{ padding: '20px 10px 0 0' }}>
            <FeatureBox title="Total value minted" border="full" noPadding borderRadius>
              <TotalValueMintedChart />
            </FeatureBox>
          </div>

          <div style={{ padding: '20px 10px 0 0' }}>
            <FeatureBox title="System collateral ratio" border="full" noPadding borderRadius>
              <SystemCollateralRatioChart />
            </FeatureBox>
          </div>
        </div>

        <div style={{ display: 'flex', width: '100%', flexWrap: 'wrap', flexDirection: 'column' }}>
          <div style={{ padding: '20px 0 0 10px' }}>
            <StabilityPoolTable />
          </div>

          <div style={{ padding: '20px 0 0 10px' }}>
            <DebtTokenTable />
          </div>
        </div>
      </div>
    </FeatureBox>
  );
}

export default StabilityBalance;
