import React, { useState } from 'react';
import './App.css';
import { useApp } from './context/AppContext';
import DeployPage from './components/DeployPage';
import WalletsPage from './components/WalletsPage';
import TradingPage from './components/TradingPage';
import ConsolePage from './components/ConsolePage';
import TokenHistoryPage from './pages/TokenHistoryPage';

// ==================== PASSWORD SCREEN ====================
function PasswordScreen() {
  const {
    passwordPrompt,
    passwordError,
    setPasswordError,
    unlockWallets,
    createPassword
  } = useApp();

  const [input, setInput] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const isCreate = passwordPrompt === 'create';

  const handleSubmit = async () => {
    setPasswordError('');

    if (!input) {
      setPasswordError('Please enter a password.');
      return;
    }

    if (isCreate) {
      if (input.length < 8) {
        setPasswordError('Password must be at least 8 characters.');
        return;
      }
      if (input !== confirm) {
        setPasswordError('Passwords do not match.');
        return;
      }
      await createPassword(input);
    } else {
      await unlockWallets(input);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      position: 'relative',
      zIndex: 10
    }}>
      <div className="glass-panel" style={{ maxWidth: '400px', width: '90%' }}>
        <div className="section-label">
          {isCreate ? '// SET APP PASSWORD' : '// UNLOCK WALLETS'}
        </div>

        <p style={{
          color: '#00a8cc',
          fontSize: '12px',
          marginBottom: '24px',
          lineHeight: '1.6'
        }}>
          {isCreate
            ? 'Create a password to encrypt your wallets. You will need this every time you open the app. If you forget it, your wallets cannot be recovered.'
            : 'Enter your password to decrypt and load your wallets.'}
        </p>

        <label>Password</label>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter password..."
            autoFocus
          />
          <button
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#00a8cc',
              cursor: 'pointer',
              fontSize: '11px',
              fontFamily: 'monospace'
            }}
          >
            {showPassword ? 'HIDE' : 'SHOW'}
          </button>
        </div>

        {isCreate && (
          <>
            <label>Confirm Password</label>
            <div style={{ marginBottom: '16px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Confirm password..."
              />
            </div>
          </>
        )}

        {passwordError && (
          <div style={{
            color: '#ff0055',
            fontSize: '12px',
            marginBottom: '16px',
            padding: '8px',
            background: 'rgba(255, 0, 85, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(255, 0, 85, 0.3)'
          }}>
            {passwordError}
          </div>
        )}

        <button className="btn-primary" onClick={handleSubmit}>
          {isCreate ? 'Set Password & Encrypt Wallets' : 'Unlock Wallets'}
        </button>

        {isCreate && (
          <p style={{
            color: '#ffaa00',
            fontSize: '11px',
            marginTop: '16px',
            textAlign: 'center',
            lineHeight: '1.6'
          }}>
            ⚠ Write this password down and store it safely.
            There is no password recovery.
          </p>
        )}
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
function App() {
  const [activeTab, setActiveTab] = useState('deploy');
  const { network, setNetwork, passwordPrompt } = useApp();

  // Show password screen if needed
  if (passwordPrompt === 'create' || passwordPrompt === 'unlock') {
    return (
      <div className="app">
        <div className="bg-grid"></div>
        <div className="container" style={{ justifyContent: 'center' }}>
          <div className="header" style={{ marginBottom: '0' }}>
            <h1>
              <span className="neon-cyan">NEXUS</span>
              <br />
              <span className="neon-violet">LAUNCHPAD</span>
            </h1>
          </div>
          <PasswordScreen />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="bg-grid"></div>

      <div className="container">
        <header className="header">
          <h1>
            <span className="neon-cyan">NEXUS</span>
            <br />
            <span className="neon-violet">LAUNCHPAD</span>
          </h1>
          <p className="subtitle">COMPLETE TOKEN DEPLOYMENT SYSTEM</p>

          <div className="network-selector">
            <label>Network:</label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className={network === 'mainnet-beta' ? 'mainnet' : ''}
            >
              <option value="devnet">Devnet (Test)</option>
              <option value="mainnet-beta">Mainnet (Production)</option>
            </select>
            {network === 'mainnet-beta' && (
              <span className="mainnet-warning">⚠️ Live Network</span>
            )}
          </div>
        </header>

        <nav className="tabs">
          {['deploy', 'wallets', 'trading', 'console', 'history'].map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        <main className="content">
          {activeTab === 'deploy' && <DeployPage />}
          {activeTab === 'wallets' && <WalletsPage />}
          {activeTab === 'trading' && <TradingPage />}
          {activeTab === 'console' && <ConsolePage />}
          {activeTab === 'history' && <TokenHistoryPage />}
        </main>
      </div>
    </div>
  );
}

export default App;

