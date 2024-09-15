import CollateralBalance from '../../../components/Features/Collateral/CollateralBalance/CollateralBalance';
import CollSurplus from '../../../components/Features/Collateral/CollSurplus';
import ReservePool from '../../../components/Features/ReservePool/ReservePool';
import StabilityBalance from '../../../components/Features/Stability/StabilityBalance/StabilityBalance';
import PageLayout from '../../../components/Layout/PageLayout';

function Balance() {
  return (
    <PageLayout>
      <CollSurplus />
      <CollateralBalance />
      <StabilityBalance />
      <ReservePool />
    </PageLayout>
  );
}

export default Balance;
