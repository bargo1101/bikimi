/* global BigInt */
import {
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  ComputeBudgetProgram
} from '@solana/web3.js';
import {
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';  // USE OFFICIAL LIBRARY!
import {
  createCreateMetadataAccountV3Instruction,
  getMetadataPDA
} from './metaplex.js';

const MINT_SIZE = 82;

// ==================== MAIN DEPLOY FUNCTION ====================

export async function deployToken({
  name,
  symbol,
  supply,
  decimals,
  description,
  imageUrl,
  wallet,
  connection,
  network,
  onLog,
  priorityFeeLamports = 10000
}) {
  onLog(`Starting deployment: ${name} (${symbol})`);

  if (!wallet?.keypair) throw new Error('Wallet not provided');
  if (!connection) throw new Error('Connection not provided');

  const balanceResult = await connection.getBalance(wallet.keypair.publicKey);
  const balance = typeof balanceResult === 'object' ? balanceResult.value : balanceResult;
  
  if (balance < 0.01 * 1e9) {
    throw new Error('Insufficient SOL. Need at least 0.01 SOL.');
  }

  const mintKeypair = Keypair.generate();
  onLog(`Generated mint: ${mintKeypair.publicKey.toString().slice(0, 20)}...`);

  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  onLog(`Rent exemption: ${lamports} lamports`);

  const metadataPDA = getMetadataPDA(mintKeypair.publicKey);
  const ata = await getAssociatedTokenAddress(
    mintKeypair.publicKey,
    wallet.keypair.publicKey
  );
  const mintAmount = BigInt(supply) * BigInt(10 ** parseInt(decimals));

  const transaction = new Transaction();

  // Priority fees
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: 80000 })
  );
  transaction.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: priorityFeeLamports * 10000
    })
  );
  onLog(`Priority fee: ${priorityFeeLamports} lamports (${priorityFeeLamports/1e9} SOL)`);

  // 1. Create mint account
  transaction.add(
    SystemProgram.createAccount({
      fromPubkey: wallet.keypair.publicKey,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID
    })
  );

  // 2. Initialize mint - OFFICIAL WORKING VERSION
  transaction.add(
    createInitializeMintInstruction(
      mintKeypair.publicKey,
      parseInt(decimals),
      wallet.keypair.publicKey,
      wallet.keypair.publicKey, // freeze authority
      TOKEN_PROGRAM_ID
    )
  );

  // 3. Create metadata
  transaction.add(
    createCreateMetadataAccountV3Instruction(
      mintKeypair.publicKey,
      metadataPDA,
      wallet.keypair.publicKey,
      wallet.keypair.publicKey,
      wallet.keypair.publicKey,
      {
        name,
        symbol,
        uri: imageUrl || '',
        sellerFeeBasisPoints: 0,
        isMutable: true
      }
    )
  );

  // 4. Create ATA - OFFICIAL WORKING VERSION
  transaction.add(
    createAssociatedTokenAccountInstruction(
      wallet.keypair.publicKey,
      ata,
      wallet.keypair.publicKey,
      mintKeypair.publicKey,
      TOKEN_PROGRAM_ID
    )
  );

  // 5. Mint tokens - OFFICIAL WORKING VERSION
  transaction.add(
    createMintToInstruction(
      mintKeypair.publicKey,
      ata,
      wallet.keypair.publicKey,
      mintAmount,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // FIX: Get blockhash JUST BEFORE signing
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.keypair.publicKey;

  onLog('Signing transaction...');

  transaction.partialSign(mintKeypair);
  transaction.partialSign(wallet.keypair);

  onLog('Sending transaction...');
  
  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: true,
    preflightCommitment: 'confirmed',
    maxRetries: 5
  });

  onLog(`Transaction sent: ${signature.slice(0, 20)}...`);

  // FIX: Get FRESH blockhash for confirmation (old one expires)
  const confirmBlockhash = await connection.getLatestBlockhash('confirmed');
  
  const confirmation = await connection.confirmTransaction({
    signature,
    blockhash: confirmBlockhash.blockhash,
    lastValidBlockHeight: confirmBlockhash.lastValidBlockHeight
  }, 'confirmed');

  if (confirmation.value.err) {
    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
  }

  onLog('✓ Token deployed!', 'success');

  return {
    mint: mintKeypair.publicKey.toString(),
    signature,
    ata: ata.toString()
  };
}
