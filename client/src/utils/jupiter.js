import { VersionedTransaction } from '@solana/web3.js';

const BACKEND_URL = 'http://localhost:3001';

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
  const inputMint = isBuy
    ? 'So11111111111111111111111111111111111111112' // SOL
    : tokenMint;
  const outputMint = isBuy
    ? tokenMint
    : 'So11111111111111111111111111111111111111112'; // SOL

  const amountLamports = Math.floor(amount * 1e9);
  const slippageBps = Math.floor(slippage * 100);

  onLog(`Getting quote...`);

  // Get quote via backend proxy
  const quoteRes = await fetch(
    `${BACKEND_URL}/jupiter/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=${slippageBps}`
  );
  const quote = await quoteRes.json();

  if (quote.error || !quote.routePlan) {
    throw new Error(quote.error || 'No route found');
  }

  onLog(`Route found, preparing swap...`);

  // Get swap transaction via backend proxy
  const swapRes = await fetch(`${BACKEND_URL}/jupiter/swap`, {
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

  // FIX: Deserialize VersionedTransaction properly
  const swapTransactionBuf = Buffer.from(swapData.swapTransaction, 'base64');
  const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  // FIX: Sign with array of signers (required for VersionedTransaction)
  transaction.sign([wallet.keypair]);

  // Send transaction
  onLog(`Sending transaction...`);
  const signature = await connection.sendTransaction(transaction, {
    maxRetries: 3,
    skipPreflight: false,
    preflightCommitment: 'confirmed'
  });

  // Wait for confirmation with fresh blockhash
  onLog(`Confirming ${signature.slice(0, 8)}...`);
  const latestBlockHash = await connection.getLatestBlockhash('confirmed');
  await connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature
  }, 'confirmed');

  onLog(`✅ Trade confirmed!`);

  return {
    signature,
    inputAmount: amount,
    outputAmount: quote.outAmount,
    price: quote.price
  };
}
