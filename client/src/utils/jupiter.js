import { VersionedTransaction } from '@solana/web3.js';

const JUPITER_API = {
  devnet: 'https://quote-api.jup.ag/v6',
  'mainnet-beta': 'https://quote-api.jup.ag/v6'
};

export async function executeTrade({ 
  tokenMint, 
  isBuy, 
  amount, 
  wallet, 
  network, 
  slippage = 1,
  onLog,
  connection
}) {
  const apiUrl = JUPITER_API[network];
  if (!apiUrl) {
    throw new Error(`Unknown network: ${network}`);
  }

  const inputMint = isBuy
    ? 'So11111111111111111111111111111111111111112' // SOL
    : tokenMint;
  const outputMint = isBuy
    ? tokenMint
    : 'So11111111111111111111111111111111111111112'; // SOL

  const amountLamports = Math.floor(amount * 1e9);
  const slippageBps = Math.floor(slippage * 100);

  onLog(`Getting quote...`);

  // Get quote
  const quoteRes = await fetch(
    `${apiUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}`
  );
  const quote = await quoteRes.json();

  if (quote.error || !quote.routePlan) {
    throw new Error(quote.error || 'No route found');
  }

  onLog(`Route found, preparing swap...`);

  // Get swap transaction
  const swapRes = await fetch(`${apiUrl}/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet.publicKey,
      wrapAndUnwrapSol: true
    })
  });
  const swapData = await swapRes.json();

  if (!swapData.swapTransaction) {
    throw new Error('Failed to create swap transaction');
  }

  // Deserialize
  const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  // SIGN with wallet keypair
  transaction.sign([wallet.keypair]);

  // SEND transaction
  onLog(`Sending transaction...`);
  const signature = await connection.sendTransaction(transaction, {
    maxRetries: 3,
    skipPreflight: false,
    preflightCommitment: 'confirmed'
  });

  // Wait for confirmation
  onLog(`Confirming ${signature.slice(0, 8)}...`);
  const latestBlockHash = await connection.getLatestBlockhash();
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: signature
  }, 'confirmed');

  onLog(`✅ Trade confirmed!`);

  return {
    signature,
    inputAmount: amount,
    outputAmount: quote.outAmount,
    price: quote.price
  };
}

