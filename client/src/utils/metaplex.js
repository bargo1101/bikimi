import { 
  PublicKey, 
  TransactionInstruction, 
  SYSVAR_RENT_PUBKEY, 
  SystemProgram 
} from '@solana/web3.js';

const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

export function getMetadataPDA(mint) {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    METADATA_PROGRAM_ID
  );
  return pda;
}

export function createCreateMetadataAccountV3Instruction(
  mint,
  metadataPDA,
  mintAuthority,
  payer,
  updateAuthority,
  data
) {
  const keys = [
    { pubkey: metadataPDA, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: updateAuthority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },   // ← System Program
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },       // ← Rent sysvar
  ];

  const nameBuf = Buffer.from(data.name);
  const symbolBuf = Buffer.from(data.symbol);
  const uriBuf = Buffer.from(data.uri || '');

  const buffers = [];

  buffers.push(Buffer.from([0x21]));   // Single-byte discriminator for CreateMetadataAccountV3

  // name
  const nameLen = Buffer.alloc(4);
  nameLen.writeUInt32LE(nameBuf.length, 0);
  buffers.push(nameLen);
  buffers.push(nameBuf);

  // symbol
  const symbolLen = Buffer.alloc(4);
  symbolLen.writeUInt32LE(symbolBuf.length, 0);
  buffers.push(symbolLen);
  buffers.push(symbolBuf);

  // uri
  const uriLen = Buffer.alloc(4);
  uriLen.writeUInt32LE(uriBuf.length, 0);
  buffers.push(uriLen);
  buffers.push(uriBuf);

  // sellerFeeBasisPoints
  const feeBuf = Buffer.alloc(2);
  feeBuf.writeUInt16LE(data.sellerFeeBasisPoints || 0, 0);
  buffers.push(feeBuf);

  // creators: None
  buffers.push(Buffer.from([0]));

  // collection: None
  buffers.push(Buffer.from([0]));

  // uses: None
  buffers.push(Buffer.from([0]));

  // isMutable
  buffers.push(Buffer.from([data.isMutable !== false ? 1 : 0]));

  // collectionDetails: None
  buffers.push(Buffer.from([0]));

  return new TransactionInstruction({
    keys,
    programId: METADATA_PROGRAM_ID,
    data: Buffer.concat(buffers),
  });
}
