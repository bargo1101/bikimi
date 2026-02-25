import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { executeTrade } from '../utils/jupiter';

export default function TradingPage() {
  const { wallets, deployedToken, addLog, connection, network } = useApp();
  const [isTrading, setIsTrading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [config, setConfig] = useState({
    tokenMint: '',
    walletIndex: '0',
    amount: '0.01',
    interval: '30',
    buyRatio: '0.7',
    slippage: '1'
  });

  // Fix: use ref instead of window.tradingInterval
  const tradingIntervalRef = useRef(null);

  // Auto-fill deployed token
  useEffect(() => {
    if (deployedToken) {
      setConfig(prev => ({ ...prev, tokenMint: deployedToken.mint }));
    }
  }, [deployedToken]);

  // Fix: cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (tradingIntervalRef.current) {
        clearInterval(tradingIntervalRef.current);
        tradingIntervalRef.current = null;
      }
    };
  }, []);

  // Warn user if on mainnet
  const isMainnet = network === 'mainnet-beta';

  const startTrading = async () => {
    if (!config.tokenMint || !wallets[config.walletIndex]) {
      alert('Select a token and wallet');
      return;
    }

    // Extra warning for mainnet
    if (isMainnet) {
      const confirmed = window.confirm(
        '⚠ WARNING: You are on MAINNET. Real SOL will be used for trades. Continue?'
      );
      if (!confirmed) return;
    }

    setIsTrading(true);
    addLog('🤖 Trading bot started', 'trade');

    const intervalMs = parseInt(config.interval) * 1000;

    tradingIntervalRef.current = setInterval(async () => {
      try {
        const isBuy = Math.random() < parseFloat(config.buyRatio);
        const amount = parseFloat(config.amount);

        await executeTrade({
          ...config,
          isBuy,
          amount,
          wallet: wallets[config.walletIndex],
          network,
          connection,
          onLog: (msg) => {
            addLog(msg, 'trade');
            setLogs(prev => [{
              time: new Date().toLocaleTimeString(),
              type: isBuy ? 'buy' : 'sell',
              msg: `${isBuy ? 'BUY' : 'SELL'} ${amount} SOL`
            }, ...prev].slice(0, 50));
          }
        });
      } catch (err) {
        addLog(`Trade error: ${err.message}`, 'error');
      }
    }, intervalMs);
  };

  const stopTrading = () => {
    if (tradingIntervalRef.current) {
      clearInterval(tradingIntervalRef.current);
      tradingIntervalRef.current = null;
    }
    setIsTrading(false);
    addLog('🛑 Trading bot stopped', 'trade');
  };

  return (
    <div className="glass-panel">
      <div className="section-label">{/* MARKET MAKER BOT */} </div>

      {/* Jupiter devnet warning */} 
      {!isMainnet && (
        <div style={{
          background: 'rgba(255, 170, 0, 0.1)',
          border: '1px solid rgba(255, 170, 0, 0.3)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
          color: '#ffaa00',
          fontSize: '12px'
        }}>
          ⚠ Jupiter does not support Devnet. Switch to Mainnet to use the trading bot.
        </div>
      )}

      <div className="grid-2">
        <div>
          <label>Token Mint Address</label>
          <input
            type="text"
            value={config.tokenMint}
            onChange={e => setConfig({ ...config, tokenMint: e.target.value })}
            placeholder="Enter mint address..."
          />
        </div>
        <div>
          <label>Trading Wallet</label>
          <select
            value={config.walletIndex}
            onChange={e => setConfig({ ...config, walletIndex: e.target.value })}
          >
            {wallets.map((w, i) => (
              <option key={i} value={i}>{w.name} - {w.publicKey.slice(0, 16)}...</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '16px' }}>
        <div>
          <label>Trade Amount (SOL)</label>
          <input
            type="number"
            value={config.amount}
            onChange={e => setConfig({ ...config, amount: e.target.value })}
            step="0.001"
            min="0.001"
          />
        </div>
        <div>
          <label>Interval (seconds)</label>
          <input
            type="number"
            value={config.interval}
            onChange={e => setConfig({ ...config, interval: e.target.value })}
            min="5"
          />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: '16px' }}>
        <div>
          <label>Buy Ratio</label>
          <select
            value={config.buyRatio}
            onChange={e => setConfig({ ...config, buyRatio: e.target.value })}
          >
            <option value="0.5">50/50</option>
            <option value="0.6">60% Buy</option>
            <option value="0.7">70% Buy</option>
            <option value="0.8">80% Buy</option>
          </select>
        </div>
        <div>
          <label>Slippage (%)</label>
          <input
            type="number"
            value={config.slippage}
            onChange={e => setConfig({ ...config, slippage: e.target.value })}
            min="0.1"
            max="5"
            step="0.1"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '24px' }}>
        <button
          className="btn-primary"
          onClick={startTrading}
          disabled={isTrading || !isMainnet}
        >
          {isTrading ? 'Running...' : 'Start Trading'}
        </button>
        <button
          className="btn-danger"
          onClick={stopTrading}
          disabled={!isTrading}
        >
          Stop Trading
        </button>
      </div>

      <div className="console" style={{ marginTop: '24px', height: '200px' }}>
        {logs.length === 0 ? (
          <div style={{ color: '#0099cc' }}>Trading bot ready...</div>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className="console-line"
              style={{
                borderLeft: `2px solid ${log.type === 'buy' ? '#00ff88' : '#ff0055'}`,
                paddingLeft: '8px',
                marginBottom: '4px'
              }}
            >
              [{log.time}] {log.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
