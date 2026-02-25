import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo
} from 'react';
import { Connection, Keypair } from '@solana/web3.js';
import localforage from 'localforage';
import { encryptSecretKey, decryptSecretKey, hasStoredWallets } from '../utils/crypto';

const AppContext = createContext(null);

localforage.config({
  name: 'nexus-app',
  storeName: 'wallets',
  description: 'Nexus wallet storage'
});

export function AppProvider({ children }) {
  const [network, setNetwork] = useState('mainnet-beta');
  const [wallets, setWallets] = useState([]);
  const [balances, setBalances] = useState({});
  const [deployedToken, setDeployedToken] = useState(null);
  const [logs, setLogs] = useState([]);
  const [tokenHistory, setTokenHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [debugLog, setDebugLog] = useState([]);

  // Password state
  const [appPassword, setAppPassword] = useState(null);
  const [passwordPrompt, setPasswordPrompt] = useState(null); // 'create' | 'unlock' | null
  const [passwordError, setPasswordError] = useState('');

  const walletsRef = useRef(wallets);
  useEffect(() => {
    walletsRef.current = wallets;
  }, [wallets]);

  // Fix: connection memoized so it doesnt recreate every render
  const connection = useMemo(
    () => new Connection(network === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com', 'confirmed'),
    [network]
  );

  const addLog = useCallback((msg, type = 'info') => {
    setLogs(prev => [
      ...prev,
      { msg, type, time: new Date().toLocaleTimeString() }
    ]);
  }, []);

  const addDebug = useCallback((msg) => {
    const line = `${new Date().toLocaleTimeString()}: ${msg}`;
    setDebugLog(prev => [...prev.slice(-20), line]);
    console.log('[DEBUG]', msg);
  }, []);

  const refreshBalances = useCallback(async () => {
    try {
      const newBalances = {};
      for (const w of walletsRef.current) {
        const lamports = await connection.getBalance(w.keypair.publicKey);
        newBalances[w.publicKey] = lamports / 1_000_000_000;
      }
      setBalances(newBalances);
    } catch (err) {
      console.error('Balance fetch failed:', err);
    }
  }, [connection]);

  const refreshWalletBalances = refreshBalances;

  // ==================== LOAD DATA ====================
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedWallets = await localforage.getItem('wallets');
        const savedToken = await localforage.getItem('deployedToken');
        const savedLogs = await localforage.getItem('logs');
        const savedHistory = await localforage.getItem('tokenHistory');

        if (savedToken) setDeployedToken(savedToken);

        if (savedLogs && Array.isArray(savedLogs)) {
          setLogs(savedLogs);
        } else {
          setLogs([{
            msg: 'System initialized',
            type: 'success',
            time: new Date().toLocaleTimeString()
          }]);
        }

        if (savedHistory && Array.isArray(savedHistory)) {
          setTokenHistory(savedHistory);
        }

        if (hasStoredWallets(savedWallets)) {
          // Wallets exist - check if they are encrypted
          const isEncrypted = savedWallets[0]?.encrypted === true;

          if (isEncrypted) {
            // Prompt user to unlock
            setPasswordPrompt('unlock');
          } else {
            // Old unencrypted wallets - load them and prompt to set password
            const reconstructed = savedWallets
              .map((w, index) => {
                try {
                  const keypair = Keypair.fromSecretKey(Uint8Array.from(w.secretKey));
                  return {
                    name: w.name || `Wallet ${index + 1}`,
                    publicKey: w.publicKey,
                    keypair
                  };
                } catch {
                  return null;
                }
              })
              .filter(Boolean);

            setWallets(reconstructed);
            // Prompt to create a password to secure existing wallets
            setPasswordPrompt('create');
          }
        }
      } catch (err) {
        console.error('Load failed:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // ==================== UNLOCK WALLETS ====================
  const unlockWallets = useCallback(async (password) => {
    setPasswordError('');
    try {
      const savedWallets = await localforage.getItem('wallets');
      const reconstructed = [];

      for (let i = 0; i < savedWallets.length; i++) {
        const w = savedWallets[i];
        const secretKey = await decryptSecretKey(w.encryptedSecretKey, password);
        const keypair = Keypair.fromSecretKey(secretKey);
        reconstructed.push({
          name: w.name || `Wallet ${i + 1}`,
          publicKey: w.publicKey,
          keypair
        });
      }

      setWallets(reconstructed);
      setAppPassword(password);
      setPasswordPrompt(null);
      addLog('Wallets unlocked successfully', 'success');
    } catch (err) {
      setPasswordError('Incorrect password. Please try again.');
    }
  }, [addLog]);

  // ==================== CREATE PASSWORD ====================
  const createPassword = useCallback(async (password) => {
    setPasswordError('');
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }

    setAppPassword(password);
    setPasswordPrompt(null);
    addLog('Password set. Wallets are now encrypted.', 'success');
  }, [addLog]);

  // ==================== BALANCE REFRESH ====================
  useEffect(() => {
    if (wallets.length > 0) {
      refreshBalances();
    }
  }, [wallets, refreshBalances]);

  // ==================== SAVE WALLETS ====================
  useEffect(() => {
    if (isLoading || !appPassword) return;

    const saveWallets = async () => {
      if (wallets.length === 0) {
        await localforage.removeItem('wallets');
        return;
      }

      const safeWallets = await Promise.all(
        wallets.map(async (w) => {
          const encryptedSecretKey = await encryptSecretKey(
            w.keypair.secretKey,
            appPassword
          );
          return {
            name: w.name,
            publicKey: w.publicKey,
            encryptedSecretKey,
            encrypted: true
          };
        })
      );

      await localforage.setItem('wallets', safeWallets);
    };

    saveWallets();
  }, [wallets, isLoading, appPassword]);

  // ==================== SAVE TOKEN ====================
  useEffect(() => {
    if (isLoading) return;
    const saveToken = async () => {
      if (deployedToken) {
        await localforage.setItem('deployedToken', deployedToken);
      } else {
        await localforage.removeItem('deployedToken');
      }
    };
    saveToken();
  }, [deployedToken, isLoading]);

  // ==================== SAVE LOGS ====================
  useEffect(() => {
    if (isLoading || logs.length === 0) return;
    const saveLogs = async () => {
      const trimmed = logs.slice(-100);
      await localforage.setItem('logs', trimmed);
    };
    saveLogs();
  }, [logs, isLoading]);

  // ==================== SAVE TOKEN HISTORY ====================
  useEffect(() => {
    if (isLoading) return;
    const saveHistory = async () => {
      await localforage.setItem('tokenHistory', tokenHistory);
    };
    saveHistory();
  }, [tokenHistory, isLoading]);

  // ==================== WALLET ACTIONS ====================
  const addWallet = useCallback(async (name) => {
    try {
      const newKeypair = Keypair.generate();
      const newWallet = {
        name: name || `Wallet ${walletsRef.current.length + 1}`,
        publicKey: newKeypair.publicKey.toString(),
        keypair: newKeypair
      };
      setWallets(prev => [...prev, newWallet]);
      addLog(`Created wallet: ${newWallet.publicKey.slice(0, 8)}...`, 'success');
      return newWallet;
    } catch (err) {
      addLog('Failed to create wallet', 'error');
      return null;
    }
  }, [addLog]);

  const importWallet = useCallback(async (name, secretKey) => {
    try {
      const keypair = Keypair.fromSecretKey(secretKey);

      // Check for duplicate
      const exists = walletsRef.current.some(
        w => w.publicKey === keypair.publicKey.toString()
      );
      if (exists) {
        addLog('Wallet already exists', 'error');
        return null;
      }

      const newWallet = {
        name: name || `Imported ${walletsRef.current.length + 1}`,
        publicKey: keypair.publicKey.toString(),
        keypair
      };
      setWallets(prev => [...prev, newWallet]);
      addLog(`Imported wallet: ${newWallet.publicKey.slice(0, 8)}...`, 'success');
      return newWallet;
    } catch (err) {
      addLog('Failed to import wallet', 'error');
      return null;
    }
  }, [addLog]);

  const removeWallet = useCallback((publicKey) => {
    setWallets(prev => prev.filter(w => w.publicKey !== publicKey));
    addLog('Wallet removed', 'info');
  }, [addLog]);

  const addTokenToHistory = useCallback((tokenInfo) => {
    const newToken = {
      ...tokenInfo,
      deployedAt: new Date().toISOString()
    };
    setTokenHistory(prev => [...prev, newToken]);
    addLog(`Token ${tokenInfo.symbol} saved to history`, 'success');
  }, [addLog]);

  const clearAllData = useCallback(async () => {
    await localforage.clear();
    setWallets([]);
    setDeployedToken(null);
    setTokenHistory([]);
    setAppPassword(null);
    setLogs([{
      msg: 'All data cleared',
      type: 'info',
      time: new Date().toLocaleTimeString()
    }]);
  }, []);

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#00fff7',
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <AppContext.Provider
      value={{
        network,
        setNetwork,
        connection,
        wallets,
        balances,
        setWallets,
        addWallet,
        importWallet,
        removeWallet,
        deployedToken,
        setDeployedToken,
        logs,
        addLog,
        clearAllData,
        refreshBalances,
        refreshWalletBalances,
        debugLog,
        addDebug,
        tokenHistory,
        addTokenToHistory,
        appPassword,
        passwordPrompt,
        passwordError,
        setPasswordError,
        unlockWallets,
        createPassword
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

