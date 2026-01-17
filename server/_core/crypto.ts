import crypto from 'crypto';

/**
 * Encrypts a string using AES-256-CBC encryption
 * @param text - The text to encrypt
 * @param secret - The encryption secret (defaults to JWT_SECRET from env)
 * @returns Encrypted string in hex format
 */
export function encrypt(text: string, secret?: string): string {
  const key = secret || process.env.JWT_SECRET || 'default-key';
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    crypto.createHash('sha256').update(key).digest().slice(0, 32),
    Buffer.alloc(16, 0)
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

/**
 * Decrypts a string that was encrypted with the encrypt function
 * @param encryptedText - The encrypted text in hex format
 * @param secret - The encryption secret (defaults to JWT_SECRET from env)
 * @returns Decrypted string
 */
export function decrypt(encryptedText: string, secret?: string): string {
  const key = secret || process.env.JWT_SECRET || 'default-key';
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    crypto.createHash('sha256').update(key).digest().slice(0, 32),
    Buffer.alloc(16, 0)
  );
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
