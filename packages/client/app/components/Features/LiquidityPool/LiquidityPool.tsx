'use client';

import { useState } from 'react';
import ClaimStakingRewards from './ClaimStakingRewards';
import LiquidityDepositWithdraw from './LiquidityDepositWithdraw';
import LiquidityPoolsTable from './LiquidityPoolsTable';

const LiquidityPool = () => {
  const [selectedPoolAddress, setSelectedPoolAddress] = useState<string | null>(null);

  return (
    <>
      <div style={{ width: 'calc(1350px * 0.3)', position: 'fixed' }}>
        {selectedPoolAddress && <LiquidityDepositWithdraw selectedPoolAddress={selectedPoolAddress} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '70%' }}>
          <LiquidityPoolsTable
            selectedPoolAddress={selectedPoolAddress}
            setSelectedPoolAddress={setSelectedPoolAddress}
          />

          <ClaimStakingRewards />
        </div>
      </div>
    </>
  );
};

export default LiquidityPool;
