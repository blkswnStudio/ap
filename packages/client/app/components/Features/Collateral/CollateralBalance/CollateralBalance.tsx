'use client';

import FeatureBox from '../../../FeatureBox/FeatureBox';
import SeedCollateral from '../SeedCollateral';
import CollateralBalanceChart from './CollateralBalanceChart';
import CollateralTokenTable from './CollateralTokenTable';

const CollateralBalance = () => {
  return (
    <>
      <SeedCollateral isAlert />

      <FeatureBox title="Collateral" headBorder="bottom" icon="green">
        <div style={{ display: 'flex' }}>
          <div style={{ padding: '20px 10px 0 0' }}>
            <FeatureBox title="Total value locked" border="full" noPadding borderRadius>
              <CollateralBalanceChart />
            </FeatureBox>
          </div>
          <div style={{ width: '100%', padding: '20px 0 0 10px' }}>
            <CollateralTokenTable />
          </div>
        </div>
      </FeatureBox>
    </>
  );
};

export default CollateralBalance;
