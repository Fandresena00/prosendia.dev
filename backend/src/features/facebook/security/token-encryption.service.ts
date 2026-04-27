import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

@Injectable()
export class TokenEncryptionService {
  private readonly logger = new Logger(TokenEncryptionService.name);
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    const hexKey = configService.getOrThrow<string>(
      'facebookTokenEncryptionKey',
    );
    if (hexKey.length !== 64) {
      throw new Error(
        'FACEBOOK_TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)',
      );
    }
    this.key = Buffer.from(hexKey, 'hex');
  }

  encrypt(plaintext: string): string {
    try {
      const iv = crypto.randomBytes(IV_BYTES);
      const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_BYTES,
      });
      const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      return [
        iv.toString('hex'),
        authTag.toString('hex'),
        encrypted.toString('hex'),
      ].join(':');
    } catch (error) {
      this.logger.error('Token encryption failed', error);
      throw new InternalServerErrorException(
        'Failed to secure the access token.',
      );
    }
  }

  decrypt(stored: string): string {
    try {
      const parts = stored.split(':');
      if (parts.length !== 3) throw new Error('Invalid stored token format');
      const [ivHex, authTagHex, ciphertextHex] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      if (iv.length !== IV_BYTES) throw new Error('Invalid IV length');
      if (authTag.length !== AUTH_TAG_BYTES)
        throw new Error('Invalid authTag length');

      const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, {
        authTagLength: AUTH_TAG_BYTES,
      });
      decipher.setAuthTag(authTag);
      return (
        decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
      );
    } catch (error) {
      this.logger.error('Token decryption failed', error);
      throw new InternalServerErrorException(
        'Failed to read the stored access token.',
      );
    }
  }
}
