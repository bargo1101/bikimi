import React from 'react';
import { useApp } from '../context/AppContext';

export default function TokenHistoryPage() {
  const { tokenHistory } = useApp();

  if (!tokenHistory || tokenHistory.length === 0) {
    return <div>No tokens launched yet.</div>;
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Launched Tokens</h2>

      {tokenHistory
        .slice()
        .reverse()
        .map((token, index) => (
          <div
            key={index}
            style={{
              border: '1px solid #444',
              borderRadius: 8,
              padding: 12,
              marginBottom: 12
            }}
          >
            <div><strong>{token.name}</strong> ({token.symbol})</div>
            <div>Mint: {token.mint}</div>
            <div>Supply: {token.supply}</div>
            <div>
              Launched: {new Date(token.deployedAt).toLocaleString()}
            </div>
            {token.image && (
              <img
                src={token.image}
                alt={token.name}
                style={{ width: 80, marginTop: 8 }}
              />
            )}
          </div>
        ))}
    </div>
  );
}
