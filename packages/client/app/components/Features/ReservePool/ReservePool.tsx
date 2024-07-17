import FeatureBox from '../../FeatureBox/FeatureBox';
import ReservePoolValueChart from './ReservePoolValueChart';
import TreasuryTable from './TreasuryTable';

function ReservePool() {
  return (
    <FeatureBox title="Reserve Pool" headBorder="bottom" icon="green">
      <div style={{ display: 'flex' }}>
        <div style={{ padding: '20px 10px 0 0' }}>
          <FeatureBox title="Reserve Pool value" border="full" noPadding borderRadius>
            <ReservePoolValueChart />
          </FeatureBox>
        </div>
        <div style={{ width: '100%', padding: '20px 0 0 10px' }}>
          <TreasuryTable />
        </div>
      </div>
    </FeatureBox>
  );
}

export default ReservePool;
