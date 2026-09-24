import nacl from 'tweetnacl';

/**
 * Validates whether a given public key string is valid hex of 32 bytes.
 */
export function isValidHexPublicKey(publicKey: string): boolean {
  if (!publicKey || typeof publicKey !== 'string') return false;
  const cleanKey = publicKey.trim();
  return cleanKey.length === 64 && /^[0-9a-fA-F]{64}$/.test(cleanKey);
}

/**
 * Verifies the Discord Ed25519 signature.
 *
 * @param rawBody - Raw request body as Buffer or Uint8Array
 * @param signature - The X-Signature-Ed25519 header (hex string)
 * @param timestamp - The X-Signature-Timestamp header (string)
 * @param publicKey - The Discord Application Public Key (hex string)
 * @returns boolean - true if signature is valid, false otherwise
 */
export function verifyDiscordSignature(
  rawBody: Buffer | Uint8Array | string,
  signature: string | string[] | undefined,
  timestamp: string | string[] | undefined,
  publicKey: string | undefined
): boolean {
  try {
    if (!signature || !timestamp || !publicKey) {
      return false;
    }

    const sigStr = Array.isArray(signature) ? signature[0] : signature;
    const timeStr = Array.isArray(timestamp) ? timestamp[0] : timestamp;
    const keyStr = publicKey.trim();

    if (!sigStr || !timeStr || !keyStr) {
      return false;
    }

    // Signature must be a 64-byte hex string (128 characters)
    if (sigStr.length !== 128 || !/^[0-9a-fA-F]{128}$/.test(sigStr)) {
      return false;
    }

    // Public key must be a 32-byte hex string (64 characters)
    if (!isValidHexPublicKey(keyStr)) {
      return false;
    }

    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : typeof rawBody === 'string'
      ? Buffer.from(rawBody, 'utf-8')
      : Buffer.from(rawBody);

    const messageBuffer = Buffer.concat([
      Buffer.from(timeStr, 'utf-8'),
      bodyBuffer,
    ]);

    const signatureBuffer = Buffer.from(sigStr, 'hex');
    const publicKeyBuffer = Buffer.from(keyStr, 'hex');

    return nacl.sign.detached.verify(
      new Uint8Array(messageBuffer),
      new Uint8Array(signatureBuffer),
      new Uint8Array(publicKeyBuffer)
    );
  } catch {
    return false;
  }
}

/**
 * Helper for generating test Ed25519 key pairs and signatures for unit and integration testing.
 */
export function generateTestKeyPair() {
  const keyPair = nacl.sign.keyPair();
  const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex');
  const secretKeyHex = Buffer.from(keyPair.secretKey).toString('hex');
  return {
    publicKeyHex,
    secretKeyHex,
    keyPair,
  };
}

export function signMessageForDiscord(
  rawBody: string | Buffer,
  timestamp: string,
  secretKey: Uint8Array
): string {
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8');
  const messageBuffer = Buffer.concat([
    Buffer.from(timestamp, 'utf-8'),
    bodyBuffer,
  ]);
  const signature = nacl.sign.detached(new Uint8Array(messageBuffer), secretKey);
  return Buffer.from(signature).toString('hex');
}
