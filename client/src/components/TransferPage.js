import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Connection, 
  PublicKey, 
  SystemProgram, 
  Transaction,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import { 
  getAssociatedTokenAddress, 
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import bs58 from 'bs58';

export default function TransferPage() {
  const { wallets, balances, addLog, addDebug, connection: appConnection } = useApp();
  
  const [selectedWallet, setSelectedWallet] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [transferType, setTransferType] = useState('SOL'); // 'SOL' or 'TOKEN'
  const [loading, setLoading] = useState(false);
  const [txSignature, setTxSignature] = useState(null);
  
  // Token-specific state
  const [tokenMint, setTokenMint] = useState('');
  const [walletTokens, setWalletTokens] = useState([]); // All tokens in selected wallet
  const [selectedToken, setSelectedToken] = useState(null);
  const [recentTokens, setRecentTokens] = useState(() => {
    const saved = localStorage.getItem('recentTokens');
    return saved ? JSON.parse(saved) : [];
  });
  const [fetchingTokens, setFetchingTokens] = useState(false);

  const getConnection = () => {
    if (appConnection) return appConnection;
    return new Connection('https://api.devnet.solana.com', 'confirmed');
  };

  // Fetch all tokens owned by selected wallet
  useEffect(() => {
    if (!selectedWallet || transferType !== 'TOKEN') {
      setWalletTokens([]);
      setSelectedToken(null);
      return;
    }

    const fetchTokens = async () => {
      setFetchingTokens(true);
      try {
        const connection = getConnection();
        const ownerPubkey = new PublicKey(selectedWallet);
        
        // Get all token accounts owned by this wallet
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
          ownerPubkey,
          { programId: TOKEN_PROGRAM_ID }
        );

        const tokens = tokenAccounts.value.map((accountInfo) => {
          const accountData = accountInfo.account.data.parsed.info;
          const mintAddress = accountData.mint;
          const tokenAmount = accountData.tokenAmount;
          
          return {
            mint: mintAddress,
            balance: parseFloat(tokenAmount.amount) / Math.pow(10, tokenAmount.decimals),
            decimals: tokenAmount.decimals,
            uiAmount: tokenAmount.uiAmount,
            address: accountInfo.pubkey.toString(),
            // Try to fetch metadata or use mint as name temporarily
            symbol: mintAddress.slice(0, 4) + '...' + mintAddress.slice(-4),
            name: 'Token ' + mintAddress.slice(0, 6) + '...'
          };
        }).filter(t => t.balance > 0); // Only show tokens with balance

        setWalletTokens(tokens);
        addDebug(`Found ${tokens.length} token types in wallet`);
      } catch (err) {
        console.error('Error fetching tokens:', err);
        addDebug('Error fetching tokens: ' + err.message);
      } finally {
        setFetchingTokens(false);
      }
    };

    fetchTokens();
  }, [selectedWallet, transferType]);

  // Save recent tokens to localStorage
  const addToRecentTokens = (mint, symbol = null) => {
    const newToken = {
      mint,
      symbol: symbol || mint.slice(0, 6) + '...',
      timestamp: Date.now()
    };
    
    setRecentTokens(prev => {
      const filtered = prev.filter(t => t.mint !== mint);
      const updated = [newToken, ...filtered].slice(0, 10); // Keep last 10
      localStorage.setItem('recentTokens', JSON.stringify(updated));
      return updated;
    });
  };

  const handleTransfer = async () => {
    if (!selectedWallet || !recipient || !amount) {
      addLog('Please fill all fields', 'error');
      return;
    }

    if (transferType === 'TOKEN' && !tokenMint && !selectedToken) {
      addLog('Please select or enter a token mint address', 'error');
      return;
    }

    setLoading(true);
    setTxSignature(null);
    addDebug(`Starting ${transferType} transfer...`);

    try {
      const connection = getConnection();
      const senderWallet = wallets.find(w => w.publicKey === selectedWallet);
      
      if (!senderWallet) {
        throw new Error('Sender wallet not found');
      }

      // Decode sender keypair
      const secretKey = bs58.decode(senderWallet.keypair.secretKey);
      const { Keypair } = await import('@solana/web3.js');
      const senderKeypair = Keypair.fromSecretKey(secretKey);

      let signature;

      if (transferType === 'SOL') {
        addDebug('Creating SOL transfer transaction...');
        
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(selectedWallet),
            toPubkey: new PublicKey(recipient),
            lamports: parseFloat(amount) * LAMPORTS_PER_SOL,
          })
        );

        signature = await connection.sendTransaction(transaction, [senderKeypair]);
        addDebug(`Transaction sent: ${signature.slice(0, 20)}...`);
        
      } else {
        // Transfer SPL Token
        const mintAddress = selectedToken ? selectedToken.mint : tokenMint;
        addDebug(`Creating token transfer for mint: ${mintAddress.slice(0, 20)}...`);
        
        const mintPubkey = new PublicKey(mintAddress);
        const recipientPubkey = new PublicKey(recipient);

        // Get sender token account
        const senderTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          new PublicKey(selectedWallet)
        );

        // Check if sender has this token account
        const senderAccountInfo = await connection.getAccountInfo(senderTokenAccount);
        if (!senderAccountInfo) {
          throw new Error('You do not have a token account for this mint. Do you own this token?');
        }

        // Get or create recipient token account
        addDebug('Getting recipient token account...');
        const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          senderKeypair, // payer
          mintPubkey,
          recipientPubkey,
          false,
          'confirmed',
          { commitment: 'confirmed' },
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );

        // Determine decimals
        const decimals = selectedToken ? selectedToken.decimals : 9;
        const transferAmount = parseFloat(amount) * Math.pow(10, decimals);

        // Create transfer instruction
        const transferInstruction = createTransferInstruction(
          senderTokenAccount,
          recipientTokenAccount.address,
          new PublicKey(selectedWallet),
          BigInt(Math.floor(transferAmount)), // Use BigInt for large numbers
          [],
          TOKEN_PROGRAM_ID
        );

        const transaction = new Transaction().add(transferInstruction);
        signature = await connection.sendTransaction(transaction, [senderKeypair]);
        addDebug(`Token transaction sent: ${signature.slice(0, 20)}...`);
        
        // Add to recent tokens
        addToRecentTokens(mintAddress, selectedToken?.symbol);
      }

      // Confirm transaction
      addDebug('Confirming transaction...');
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
      }
      
      setTxSignature(signature);
      addLog(`Transfer successful! Signature: ${signature.slice(0, 20)}...`, 'success');
      addDebug('Transfer completed successfully');
      
      // Refresh token list if it was a token transfer
      if (transferType === 'TOKEN') {
        setTimeout(() => {
          const event = new Event('refreshTokens');
          window.dispatchEvent(event);
        }, 1000);
      }
      
      // Clear form
      setRecipient('');
      setAmount('');
      setTokenMint('');
      setSelectedToken(null);
      
    } catch (err) {
      console.error('Transfer error:', err);
      addLog(`Transfer failed: ${err.message}`, 'error');
      addDebug(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const setMaxAmount = () => {
    if (!selectedWallet) return;
    
    if (transferType === 'SOL') {
      const bal = balances[selectedWallet];
      if (bal !== undefined) {
        // Leave 0.01 SOL for fees
        const maxAmount = Math.max(0, bal - 0.01);
        setAmount(maxAmount.toFixed(6));
      }
    } else if (selectedToken) {
      setAmount(selectedToken.balance.toString());
    }
  };

  const selectToken = (token) => {
    setSelectedToken(token);
    setTokenMint(token.mint);
  };

  const getCluster = () => {
    // Detect if using devnet or mainnet
    const conn = getConnection();
    return conn.rpcEndpoint.includes('devnet') ? 'devnet' : 'mainnet-beta';
  };

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ 
        background: 'rgba(0,0,0,0.3)', 
        padding: '15px', 
        marginBottom: '15px', 
        borderRadius: '8px' 
      }}>
        <div style={{ color: '#00f3ff', marginBottom: '15px', fontSize: '12px' }}>
          // TRANSFER
        </div>

        {/* Transfer Type Toggle 
        <div style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setTransferType('SOL')}
            style={{
              flex: 1,
              padding: '10px',
              background: transferType === 'SOL' ? '#00f3ff' : 'rgba(0,243,255,0.1)',
              color: transferType === 'SOL' ? '#000' : '#00f3ff',
              border: '1px solid #00f3ff',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Transfer SOL
          </button>
          <button
            onClick={() => setTransferType('TOKEN')}
            style={{
              flex: 1,
              padding: '10px',
              background: transferType === 'TOKEN' ? '#00f3ff' : 'rgba(0,243,255,0.1)',
              color: transferType === 'TOKEN' ? '#000' : '#00f3ff',
              border: '1px solid #00f3ff',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Transfer Any Token
          </button>
        </div>

        {/* From Wallet 
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', color: '#666', fontSize: '11px', marginBottom: '5px' }}>
            FROM WALLET
          </label>
          <select
            value={selectedWallet}
            onChange={(e) => setSelectedWallet(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid #333',
              color: '#fff',
              borderRadius: '4px'
            }}
          >
            <option value="">Select wallet...</option>
            {wallets.map((w) => (
              <option key={w.publicKey} value={w.publicKey}>
                {w.name} - {w.publicKey.slice(0, 8)}... ({balances[w.publicKey]?.toFixed(3) || '?'} SOL)
              </option>
            ))}
          </select>
        </div>

        {/* Token Selection (only for TOKEN type) 
        {transferType === 'TOKEN' && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', color: '#666', fontSize: '11px', marginBottom: '5px' }}>
              TOKEN TO TRANSFER
            </label>
            
            {/* Manual mint input 
            <input
              type="text"
              value={tokenMint}
              onChange={(e) => {
                setTokenMint(e.target.value);
                setSelectedToken(null);
              }}
              placeholder="Enter token mint address (or select below)..."
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid #333',
                color: '#fff',
                borderRadius: '4px',
                fontFamily: 'monospace',
                marginBottom: '10px',
                fontSize: '11px'
              }}
            />

            {/* Recently used tokens 
            {recentTokens.length > 0 && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: '#666', fontSize: '10px', marginBottom: '5px' }}>
                  RECENTLY USED
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {recentTokens.map((token) => (
                    <button
                      key={token.mint}
                      onClick={() => {
                        setTokenMint(token.mint);
                        setSelectedToken(null);
                      }}
                      style={{
                        padding: '4px 8px',
                        background: tokenMint === token.mint ? 'rgba(0,243,255,0.3)' : 'rgba(0,243,255,0.05)',
                        border: '1px solid rgba(0,243,255,0.3)',
                        color: '#00f3ff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                    >
                      {token.symbol}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tokens found in wallet 
            {fetchingTokens ? (
              <div style={{ color: '#666', fontSize: '11px', padding: '10px' }}>
                Scanning wallet for tokens...
              </div>
            ) : walletTokens.length > 0 ? (
              <div>
                <div style={{ color: '#666', fontSize: '10px', marginBottom: '5px' }}>
                  TOKENS IN THIS WALLET ({walletTokens.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {walletTokens.map((token) => (
                    <button
                      key={token.mint}
                      onClick={() => selectToken(token)}
                      style={{
                        padding: '8px 12px',
                        background: selectedToken?.mint === token.mint ? 'rgba(0,243,255,0.2)' : 'rgba(0,0,0,0.3)',
                        border: selectedToken?.mint === token.mint ? '1px solid #00f3ff' : '1px solid #333',
                        color: selectedToken?.mint === token.mint ? '#00f3ff' : '#fff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>
                        {token.mint.slice(0, 16)}...{token.mint.slice(-4)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#0f0' }}>
                        {token.balance.toLocaleString()} 
                        <span style={{ color: '#666', marginLeft: '4px' }}>tokens</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : selectedWallet ? (
              <div style={{ color: '#666', fontSize: '11px', padding: '10px' }}>
                No tokens found in this wallet. Enter mint address manually above.
              </div>
            ) : null}
          </div>
        )}

        {/* Recipient 
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', color: '#666', fontSize: '11px', marginBottom: '5px' }}>
            RECIPIENT ADDRESS
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Enter Solana address..."
            style={{
              width: '100%',
              padding: '10px',
              background: 'rgba(0,0,0,0.5)',
              border: '1px solid #333',
              color: '#fff',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '12px'
            }}
          />
        </div>

        {/* Amount 
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', color: '#666', fontSize: '11px', marginBottom: '5px' }}>
            AMOUNT ({transferType === 'TOKEN' && selectedToken ? 'tokens' : 'SOL'})
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              step={transferType === 'TOKEN' ? "1" : "0.001"}
              style={{
                flex: 1,
                padding: '10px',
                background: 'rgba(0,0,0,0.5)',
                border: '1px solid #333',
                color: '#fff',
                borderRadius: '4px'
              }}
            />
            <button
              onClick={setMaxAmount}
              style={{
                padding: '10px 15px',
                background: 'rgba(0,243,255,0.1)',
                border: '1px solid #00f3ff',
                color: '#00f3ff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              MAX
            </button>
          </div>
          {selectedWallet && (
            <div style={{ 
              marginTop: '5px', 
              fontSize: '11px', 
              color: '#666',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              {transferType === 'SOL' ? (
                <>
                  <span>Available: {balances[selectedWallet]?.toFixed(6) || '?'} SOL</span>
                  <span style={{ color: '#ff6b6b' }}>- Fee: ~0.000005 SOL</span>
                </>
              ) : selectedToken ? (
                <span style={{ color: '#0f0' }}>
                  Balance: {selectedToken.balance.toLocaleString()} tokens
                </span>
              ) : (
                <span>Enter token mint to see balance</span>
              )}
            </div>
          )}
        </div>

        {/* Transfer Button 
        <button
          onClick={handleTransfer}
          disabled={loading || !selectedWallet || !recipient || !amount || (transferType === 'TOKEN' && !tokenMint)}
          style={{
            width: '100%',
            padding: '15px',
            background: loading ? '#333' : '#00f3ff',
            color: loading ? '#666' : '#000',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px'
          }}
        >
          {loading ? 'Processing...' : `Send ${transferType === 'TOKEN' ? 'Tokens' : 'SOL'}`}
        </button>

        {/* Transaction Result 
        {txSignature && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            background: 'rgba(0,255,0,0.1)',
            border: '1px solid #0f0',
            borderRadius: '4px'
          }}>
            <div style={{ color: '#0f0', fontSize: '12px', marginBottom: '5px' }}>
              ✓ Transaction Successful
            </div>
            <div style={{ 
              fontSize: '10px', 
              color: '#666',
              wordBreak: 'break-all',
              fontFamily: 'monospace'
            }}>
              {txSignature}
            </div>
            <a 
              href={`https://explorer.solana.com/tx/${txSignature}?cluster=${getCluster()}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: '8px',
                color: '#00f3ff',
                fontSize: '11px',
                textDecoration: 'none'
              }}
            >
              View on Explorer →
            </a>
          </div>
        )}

        {/* Quick Transfer Between Own Wallets 
        {wallets.length > 1 && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #333' }}>
            <div style={{ color: '#666', fontSize: '11px', marginBottom: '10px' }}>
              QUICK TRANSFER TO YOUR OTHER WALLETS
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {wallets.filter(w => w.publicKey !== selectedWallet).map((w) => (
                <button
                  key={w.publicKey}
                  onClick={() => setRecipient(w.publicKey)}
                  style={{
                    padding: '6px 12px',
                    background: recipient === w.publicKey ? 'rgba(0,243,255,0.3)' : 'rgba(0,243,255,0.05)',
                    border: '1px solid rgba(0,243,255,0.3)',
                    color: '#00f3ff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '11px'
                  }}
                >
                  {w.name} ({w.publicKey.slice(0, 4)}...)
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info Panel 
      <div style={{ 
        background: 'rgba(255,243,0,0.05)', 
        padding: '12px', 
        borderRadius: '8px',
        border: '1px solid rgba(255,243,0,0.2)'
      }}>
        <div style={{ color: '#ff0', fontSize: '11px', marginBottom: '5px' }}>
          ⚠ IMPORTANT
        </div>
        <ul style={{ color: '#aa0', fontSize: '10px', margin: 0, paddingLeft: '15px' }}>
          <li>Double-check recipient addresses - transactions cannot be reversed</li>
          <li>Keep some SOL for transaction fees (~0.00001 SOL per tx)</li>
          <li>Token transfers auto-create recipient token accounts if needed</li>
          <li>Make sure you own the tokens you're trying to send</li>
          <li>Currently using: {getCluster()}</li>
        </ul>
      </div>
    </div>
  );
}
