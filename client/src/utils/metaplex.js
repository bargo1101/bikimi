import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';

// ==================== CONSTANTS ====================

/**
 * Metaplex Token Metadata Program ID
 * @constant
 */
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

// ==================== HELPER FUNCTIONS ====================

/**
 * Write uint32 value as little-endian to buffer
 * @param {number} value - Value to write
 * @param {Uint8Array} buffer - Target buffer
 * @param {number} offset - Offset position
 */
function writeUint32LE(value, buffer, offset) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
  buffer[offset + 2] = (value >> 16) & 0xff;
  buffer[offset + 3] = (value >> 24) & 0xff;
}

/**
 * Write uint16 value as little-endian to buffer
 * @param {number} value - Value to write
 * @param {Uint8Array} buffer - Target buffer
 * @param {number} offset - Offset position
 */
function writeUint16LE(value, buffer, offset) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
}

// ==================== PDA FUNCTIONS ====================

/**
 * Get Metadata Program Derived Address (PDA) for a mint
 * @param {PublicKey} mint - Token mint address
 * @returns {PublicKey} Metadata PDA
 */
export function getMetadataPDA(mint) {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBytes(),
      mint.toBytes(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

/**
 * Get Edition PDA for NFTs (optional for fungible tokens)
 * @param {PublicKey} mint - Token mint address
 * @returns {PublicKey} Edition PDA
 */
export function getEditionPDA(mint) {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      new TextEncoder().encode('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBytes(),
      mint.toBytes(),
      new TextEncoder().encode('edition'),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return pda;
}

// ==================== INSTRUCTION BUILDERS ====================

/**
 * Create Metadata Account V3 Instruction
 * Creates metadata for a token using Metaplex Token Metadata Program
 * 
 * @param {PublicKey} mint - Token mint address
 * @param {PublicKey} metadataPDA - Metadata PDA
 * @param {PublicKey} mintAuthority - Mint authority
 * @param {PublicKey} payer - Transaction payer
 * @param {PublicKey} updateAuthority - Update authority
 * @param {Object} data - Metadata data object
 * @param {string} data.name - Token name
 * @param {string} data.symbol - Token symbol
 * @param {string} data.uri - Metadata URI
 * @param {number} [data.sellerFeeBasisPoints=0] - Seller fee basis points
 * @param {boolean} [data.isMutable=true] - Whether metadata is mutable
 * @returns {TransactionInstruction} Create metadata instruction
 */
export function createCreateMetadataAccountV3Instruction(
  mint,
  metadataPDA,
  mintAuthority,
  payer,
  updateAuthority,
  data
) {
  // Account keys for the instruction
  const keys = [
    { pubkey: metadataPDA, isSigner: false, isWritable: true },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: mintAuthority, isSigner: true, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: updateAuthority, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: PublicKey.default, isSigner: false, isWritable: false }, // Rent sysvar
  ];

  // Encode string data
  const nameBytes = new TextEncoder().encode(data.name);
  const symbolBytes = new TextEncoder().encode(data.symbol);
  const uriBytes = new TextEncoder().encode(data.uri);

  // Calculate total instruction data size
  let dataSize = 8; // discriminator
  dataSize += 4 + nameBytes.length; // name (4 bytes length + content)
  dataSize += 4 + symbolBytes.length; // symbol
  dataSize += 4 + uriBytes.length; // uri
  dataSize += 2; // sellerFeeBasisPoints (u16)
  dataSize += 1; // creators: Option<Vec<Creator>>
  dataSize += 1; // collection: Option<Collection>
  dataSize += 1; // uses: Option<Uses>
  dataSize += 1; // isMutable (bool)
  dataSize += 1; // collectionDetails: Option<CollectionDetails>

  const instructionData = new Uint8Array(dataSize);
  let offset = 0;

  // Instruction discriminator for CreateMetadataAccountV3
  // 8-byte hash of "global:create_metadata_account_v3"
  const discriminator = new Uint8Array([33, 18, 37, 213, 20, 112, 118, 169]);
  instructionData.set(discriminator, offset);
  offset += 8;

  // Serialize DataV2 struct (Borsh format)

  // name: String (4 bytes length + content)
  writeUint32LE(nameBytes.length, instructionData, offset);
  offset += 4;
  instructionData.set(nameBytes, offset);
  offset += nameBytes.length;

  // symbol: String
  writeUint32LE(symbolBytes.length, instructionData, offset);
  offset += 4;
  instructionData.set(symbolBytes, offset);
  offset += symbolBytes.length;

  // uri: String
  writeUint32LE(uriBytes.length, instructionData, offset);
  offset += 4;
  instructionData.set(uriBytes, offset);
  offset += uriBytes.length;

  // sellerFeeBasisPoints: u16 (0 for fungible tokens)
  writeUint16LE(data.sellerFeeBasisPoints || 0, instructionData, offset);
  offset += 2;

  // creators: Option<Vec<Creator>> - None (0)
  instructionData[offset++] = 0;

  // collection: Option<Collection> - None (0)
  instructionData[offset++] = 0;

  // uses: Option<Uses> - None (0)
  instructionData[offset++] = 0;

  // isMutable: bool (1 = true, 0 = false)
  instructionData[offset++] = data.isMutable !== false ? 1 : 0;

  // collectionDetails: Option<CollectionDetails> - None (0)
  instructionData[offset++] = 0;

  return new TransactionInstruction({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
}

/**
 * Create Update Metadata Account V2 Instruction
 * Updates existing metadata for a token
 * 
 * @param {PublicKey} metadataPDA - Metadata PDA
 * @param {PublicKey} updateAuthority - Current update authority
 * @param {Object} data - New metadata data
 * @param {PublicKey|null} [newUpdateAuthority=null] - New update authority (optional)
 * @param {boolean|null} [primarySaleHappened=null] - Primary sale flag (optional)
 * @param {boolean|null} [isMutable=null] - Mutability flag (optional)
 * @returns {TransactionInstruction} Update metadata instruction
 */
export function createUpdateMetadataAccountV2Instruction(
  metadataPDA,
  updateAuthority,
  data,
  newUpdateAuthority = null,
  primarySaleHappened = null,
  isMutable = null
) {
  const keys = [
    { pubkey: metadataPDA, isSigner: false, isWritable: true },
    { pubkey: updateAuthority, isSigner: true, isWritable: false },
  ];

  // Instruction discriminator for UpdateMetadataAccountV2
  const discriminator = new Uint8Array([170, 182, 43, 239, 249, 28, 218, 80]);

  // Encode string data
  const nameBytes = new TextEncoder().encode(data.name);
  const symbolBytes = new TextEncoder().encode(data.symbol);
  const uriBytes = new TextEncoder().encode(data.uri);

  // Calculate instruction data size
  let dataSize = 8; // discriminator
  dataSize += 1; // data: Option<Data>
  dataSize += 4 + nameBytes.length + 4 + symbolBytes.length + 4 + uriBytes.length + 2 + 1; // Data struct
  dataSize += 1; // newUpdateAuthority: Option<Pubkey>
  if (newUpdateAuthority) dataSize += 32;
  dataSize += 1; // primarySaleHappened: Option<bool>
  dataSize += 1; // isMutable: Option<bool>

  const instructionData = new Uint8Array(dataSize);
  let offset = 0;

  instructionData.set(discriminator, offset);
  offset += 8;

  // data: Option<Data> - Some (1)
  instructionData[offset++] = 1;

  // Data struct
  writeUint32LE(nameBytes.length, instructionData, offset);
  offset += 4;
  instructionData.set(nameBytes, offset);
  offset += nameBytes.length;

  writeUint32LE(symbolBytes.length, instructionData, offset);
  offset += 4;
  instructionData.set(symbolBytes, offset);
  offset += symbolBytes.length;

  writeUint32LE(uriBytes.length, instructionData, offset);
  offset += 4;
  instructionData.set(uriBytes, offset);
  offset += uriBytes.length;

  writeUint16LE(data.sellerFeeBasisPoints || 0, instructionData, offset);
  offset += 2;

  // creators: Option<Vec<Creator>> - None (0)
  instructionData[offset++] = 0;

  // newUpdateAuthority: Option<Pubkey>
  if (newUpdateAuthority) {
    instructionData[offset++] = 1;
    instructionData.set(newUpdateAuthority.toBytes(), offset);
    offset += 32;
  } else {
    instructionData[offset++] = 0;
  }

  // primarySaleHappened: Option<bool>
  if (primarySaleHappened !== null) {
    instructionData[offset++] = 1;
    instructionData[offset++] = primarySaleHappened ? 1 : 0;
  } else {
    instructionData[offset++] = 0;
  }

  // isMutable: Option<bool>
  if (isMutable !== null) {
    instructionData[offset++] = 1;
    instructionData[offset++] = isMutable ? 1 : 0;
  } else {
    instructionData[offset++] = 0;
  }

  return new TransactionInstruction({
    keys,
    programId: TOKEN_METADATA_PROGRAM_ID,
    data: instructionData.slice(0, offset),
  });
}

