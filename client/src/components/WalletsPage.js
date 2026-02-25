import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import bs58 from 'bs58';

export default function WalletsPage() {
  const {
    wallets, balances, addWallet, importWallet, removeWallet,
    addLog, refreshWalletBalances, debugLog, addDebug
  } = useApp();
  
  const [importKey, setImportKey] = useState('');
  const [showSecret, setShowSecret] = useState({});

  const createWallet = async () => {
    addDebug('Create clicked');
    const w = await addWallet();
    if (w) addDebug('Created: ' + w.publicKey.slice(0,6));
  };

  const handleRefresh = () => {
    addDebug('Refresh button clicked');
    refreshWalletBalances();
  };

  const handleImport = async () => {
    try {
      let sk;
      try { sk = bs58.decode(importKey); }
      catch { sk = new Uint8Array(JSON.parse(importKey)); }
      const w = await importWallet(null, sk);
      if (w) setImportKey('');
    } catch (err) {
      addLog('Invalid key', 'error');
    }
  };

  const exportWallet = (i) => {
    const w = wallets[i];
    alert(w.publicKey + '\n\n' + bs58.encode(w.keypair.secretKey));
  };

  const toggleSecret = (i) => {
    setShowSecret({ ...showSecret, [i]: !showSecret[i] });
  };

  const remove = (pk) => {
    if (window.confirm('Remove?')) removeWallet(pk);
  };

  const fmtBal = (pk) => {
    const b = balances[pk];
    if (b === undefined) return '?';
    return b.toFixed(3) + ' SOL';
  };

  return (
    <div style={{ padding: '10px' }}>
      {/* DEBUG PANEL */} - Shows what's happening 
      {process.env.NODE_ENV === 'development' && (
      <div style={{
        background: '#000',
        color: '#0f0',
        padding: '10px',
        marginBottom: '15px',
        fontFamily: 'monospace',
        fontSize: '11px',
        maxHeight: '150px',
        overflow: 'auto',
        border: '1px solid #333'
      }}>
        <strong>DEBUG LOG:</strong>
        {debugLog.map((line, i) => (
          <div key={i} style={{ marginTop: '2px' }}>{line}</div>
        ))}
      </div>
    )}
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
        <div style={{ color: '#00f3ff', marginBottom: '10px', fontSize: '12px' }}>CREATE</div>
        <button onClick={createWallet} style={{ padding: '10px 20px', background: '#00f3ff', border: 'none', borderRadius: '4px' }}>
          Generate Wallet
        </button>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', marginBottom: '15px', borderRadius: '8px' }}>
        <div style={{ color: '#00f3ff', marginBottom: '10px', fontSize: '12px' }}>IMPORT</div>
        <textarea
          value={importKey}
          onChange={e => setImportKey(e.target.value)}
          placeholder="Base58 or JSON key..."
          style={{ width: '100%', height: '60px', marginBottom: '10px' }}
        />
        <button onClick={handleImport} style={{ padding: '8px 16px' }}>Import</button>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px' }}>
        <div style={{ color: '#00f3ff', marginBottom: '10px', fontSize: '12px' }}>
          WALLETS ({wallets.length})
        </div>
        
        <button onClick={handleRefresh} style={{ marginBottom: '15px', padding: '8px 16px' }}>
          Refresh Balances
        </button>

        {wallets.length === 0 ? (
          <p style={{ color: '#666' }}>No wallets</p>
        ) : (
          wallets.map((w, i) => (
            <div key={w.publicKey} style={{
              marginBottom: '15px',
              padding: '12px',
              background: 'rgba(0,243,255,0.05)',
              borderRadius: '8px',
              border: '1px solid rgba(0,243,255,0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <strong>{w.name}</strong>
                <div>
                  <button style={{ fontSize: '10px', marginRight: '5px' }} onClick={() => toggleSecret(i)}>
                    {showSecret[i] ? 'Hide' : 'Show'}
                  </button>
                  <button style={{ fontSize: '10px', marginRight: '5px' }} onClick={() => exportWallet(i)}>
                    Export
                  </button>
                  <button style={{ fontSize: '10px', color: '#f44' }} onClick={() => remove(w.publicKey)}>
                    Remove
                  </button>
                </div>
              </div>
              
              <div style={{ fontSize: '11px', color: '#00f3ff', marginBottom: '8px', wordBreak: 'break-all' }}>
                {w.publicKey}
              </div>
              
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '8px 12px',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '11px', color: '#666' }}>Balance:</span>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f0' }}>
                  {fmtBal(w.publicKey)}
                </span>
              </div>
              
              {showSecret[i] && (
                <div style={{
                  marginTop: '10px',
                  padding: '8px',
                  background: '#330',
                  color: '#ff0',
                  fontSize: '10px',
                  wordBreak: 'break-all'
                }}>
                  {bs58.encode(w.keypair.secretKey)}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
