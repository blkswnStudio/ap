'use client';

import { useState } from 'react';
import LiquidityDepositWithdraw from './LiquidityDepositWithdraw';
import LiquidityPoolsTable from './LiquidityPoolsTable';

const LiquidityPool = () => {
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);

  return (
    <>
      <div style={{ width: 'calc(1350px * 0.3)', position: 'fixed' }}>
        {selectedPoolId && <LiquidityDepositWithdraw selectedPoolId={selectedPoolId} />}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{ width: '70%' }}>
          <LiquidityPoolsTable selectedPoolId={selectedPoolId} setSelectedPoolId={setSelectedPoolId} />
        </div>
      </div>
    </>
  );
};

export default LiquidityPool;
