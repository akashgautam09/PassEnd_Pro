import type { Document } from "mongodb";

export type KdfMetadata = {
  algorithm: string;
  salt: string;
  parameters: Record<string, string | number | boolean>;
};

export type UserVaultDocument = Document & {
  _id: string;
  kdf: KdfMetadata;
  wrappedVaultKey: string;
  wrapIv: string;
  cryptoVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export type VaultItemDocument = Document & {
  _id: string;
  userId: string;
  encryptedData: string;
  iv: string;
  cryptoVersion: number;
  isFavorite: boolean;
  isTrash: boolean;
  trashedAt: Date | null;
  purgeAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ActivityEventDocument = Document & {
  _id?: string;
  userId: string;
  eventType: string;
  createdAt: Date;
};