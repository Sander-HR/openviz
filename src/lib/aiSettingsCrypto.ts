import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function encryptionKey(): Buffer {
    const configured = process.env.AI_SETTINGS_ENCRYPTION_KEY;
    if (configured) {
        const key = Buffer.from(configured, 'base64');
        if (key.length !== 32) throw new Error('AI_SETTINGS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
        return key;
    }
    const fallback = process.env.NEXTAUTH_SECRET;
    if (!fallback) throw new Error('Configure AI_SETTINGS_ENCRYPTION_KEY or NEXTAUTH_SECRET.');
    return createHash('sha256').update(fallback).digest();
}

export function encryptAISecret(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
}

export function decryptAISecret(value: string): string {
    const [ivEncoded, tagEncoded, encryptedEncoded] = value.split('.');
    if (!ivEncoded || !tagEncoded || !encryptedEncoded) throw new Error('Invalid encrypted AI secret.');
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivEncoded, 'base64'));
    decipher.setAuthTag(Buffer.from(tagEncoded, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedEncoded, 'base64')), decipher.final()]).toString('utf8');
}