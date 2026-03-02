import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { deployToken } from '../utils/solana';

export default function DeployPage() {
  const { connection, wallets, addLog, setDeployedToken, addDebug, addTokenToHistory, network } = useApp();
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [decimals, setDecimals] = useState(9);
  const [supply, setSupply] = useState(1000);
  const [isDeploying, setIsDeploying] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(0);
  const [tokenImage, setTokenImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addLog('Image too large. Max 5MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setTokenImage(file);
      setImagePreview(reader.result);
      addDebug('Image selected: ' + file.name);
    };
    reader.readAsDataURL(file);
  };

  // Upload image via backend
  const uploadToPinata = async (file) => {
    const data = new FormData();
    data.append('file', file);

    const res = await fetch('http://localhost:3001/upload-image', {
      method: 'POST',
      body: data,
    });

    if (!res.ok) throw new Error('Image upload failed');
    const result = await res.json();
    return result.url;
  };

  // Upload metadata via backend
  const uploadMetadata = async (imageUrl) => {
    const metadata = {
      name: tokenName || 'My Token',
      symbol: tokenSymbol || 'MTK',
      description: 'Token created with Nexus Launchpad',
      image: imageUrl,
      attributes: []
    };

    const res = await fetch('http://localhost:3001/upload-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });

    if (!res.ok) throw new Error('Metadata upload failed');
    const result = await res.json();
    return result.url;
  };

  const handleDeploy = async () => {
    addDebug("DEPLOY clicked on " + network);

    if (!connection || wallets.length === 0) {
      addLog('No connection or wallets', 'error');
      return;
    }

    const wallet = wallets[selectedWallet];
    addDebug('Wallet: ' + wallet.publicKey.slice(0,8));

    try {
      setIsDeploying(true);

      let imageUrl = null;
      let metadataUri = null;

      // Upload image and metadata first (before any blockchain txs)
      if (tokenImage) {
        addDebug('Uploading image to IPFS...');
        setIsUploading(true);
        imageUrl = await uploadToPinata(tokenImage);
        addDebug('Image URL: ' + imageUrl);

        addDebug('Uploading metadata...');
        metadataUri = await uploadMetadata(imageUrl);
        addDebug('Metadata URI: ' + metadataUri);
        setIsUploading(false);
      }

      // Use the atomic deployment from solana.js
      addDebug('Starting atomic deployment...');
      const result = await deployToken({
        name: tokenName || 'My Token',
        symbol: tokenSymbol || 'MTK',
        supply: supply,
        decimals: decimals,
        description: 'Token created with Nexus Launchpad',
        imageUrl: metadataUri, // Use metadata URI as the imageUrl param
        wallet: wallet,
        connection: connection,
        network: network,
        onLog: (msg, type) => {
          addDebug(msg);
          if (type === 'success') addLog(msg, 'success');
        }
      });

      const tokenInfo = {
        mint: result.mint,
        name: tokenName || 'My Token',
        symbol: tokenSymbol || 'MTK',
        decimals,
        supply,
        owner: wallet.publicKey,
        tokenAccount: result.ata,
        image: imageUrl,
        metadataUri,
        signature: result.signature
      };

      addTokenToHistory(tokenInfo);
      setDeployedToken(tokenInfo);
      addDebug('SUCCESS! Token deployed: ' + result.mint.slice(0,8));
      addLog('Token deployed successfully!', 'success');

    } catch (err) {
      addDebug('ERROR: ' + err.message);
      console.error(err);
      addLog('Failed: ' + err.message, 'error');
    } finally {
      setIsDeploying(false);
      setIsUploading(false);
    }
  };

  return (
    <div style={{ padding: '10px' }}>
      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '15px', borderRadius: '8px' }}>
        <div style={{ color: '#00f3ff', marginBottom: '15px' }}>DEPLOY TOKEN</div>

        {wallets.length === 0 ? (
          <p style={{ color: '#ff4444' }}>Create a wallet first!</p>
        ) : (
          <>
            <select 
              value={selectedWallet} 
              onChange={e => setSelectedWallet(Number(e.target.value))} 
              style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
            >
              {wallets.map((w, i) => (
                <option key={w.publicKey} value={i}>
                  {w.name} ({w.publicKey.slice(0,8)}...)
                </option>
              ))}
            </select>

            <input 
              value={tokenName} 
              onChange={e => setTokenName(e.target.value)} 
              placeholder="Token Name" 
              style={{ width: '100%', marginBottom: '10px', padding: '8px' }} 
            />
            
            <input 
              value={tokenSymbol} 
              onChange={e => setTokenSymbol(e.target.value)} 
              placeholder="Symbol (e.g. MTK)" 
              style={{ width: '100%', marginBottom: '10px', padding: '8px' }} 
            />
            
            <input 
              type="number" 
              value={decimals} 
              onChange={e => setDecimals(Number(e.target.value))} 
              placeholder="Decimals" 
              style={{ width: '100%', marginBottom: '10px', padding: '8px' }} 
            />
            
            <input 
              type="number" 
              value={supply} 
              onChange={e => setSupply(Number(e.target.value))} 
              placeholder="Supply" 
              style={{ width: '100%', marginBottom: '10px', padding: '8px' }} 
            />

            <div style={{ marginBottom: '10px' }}>
              <label style={{ color: '#00f3ff', fontSize: '12px', display: 'block', marginBottom: '5px' }}>
                Token Image (IPFS):
              </label>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageSelect} 
                style={{ width: '100%', color: '#fff' }} 
              />
              {imagePreview && (
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img 
                    src={imagePreview} 
                    alt="Preview" 
                    style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} 
                  />
                  <span style={{ color: '#0f0', fontSize: '12px' }}>✓ Ready for IPFS</span>
                </div>
              )}
            </div>

            <button
              onClick={handleDeploy}
              disabled={isDeploying || isUploading}
              style={{ 
                width: '100%', 
                padding: '10px', 
                background: (isDeploying || isUploading) ? '#333' : '#00f3ff', 
                color: (isDeploying || isUploading) ? '#888' : '#000',
                marginTop: '10px',
                border: 'none',
                borderRadius: '4px',
                cursor: (isDeploying || isUploading) ? 'not-allowed' : 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isUploading ? 'Uploading to IPFS...' : isDeploying ? 'Deploying...' : 'Deploy Token'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

