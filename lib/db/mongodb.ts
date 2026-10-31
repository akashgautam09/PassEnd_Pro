import "server-only";

import { MongoClient, type Db } from "mongodb";

const configuredMongoUri = process.env.MONGODB_URI ?? "";
const mongoUri = configuredMongoUri.startsWith("MONGODB_URI=")
  ? configuredMongoUri.slice("MONGODB_URI=".length)
  : configuredMongoUri;
const mongoDatabaseName = process.env.MONGODB_DB_NAME ?? "";

type MongoCache = {
  client: MongoClient;
  database: Db;
  indexesReady?: Promise<void>;
};

const globalMongo = globalThis as typeof globalThis & {
  __passendMongo?: MongoCache;
};

export function getDatabase(): Db {
  if ((!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) || !mongoDatabaseName) {
    throw new Error("MONGODB_URI and MONGODB_DB_NAME must be configured");
  }

  if (!globalMongo.__passendMongo) {
    const client = new MongoClient(mongoUri);
    const database = client.db(mongoDatabaseName);
    globalMongo.__passendMongo = {
      client,
      database,
    };
  }

  return globalMongo.__passendMongo.database;
}

export function ensureDatabaseIndexes(): Promise<void> {
  const database = getDatabase();
  const cache = globalMongo.__passendMongo;

  if (!cache) {
    throw new Error("MongoDB cache was not initialized");
  }

  if (!cache.indexesReady) {
    cache.indexesReady = Promise.all([
      database.collection("vault_items").createIndex({ userId: 1 }),
      database.collection("vault_items").createIndex({ userId: 1, isTrash: 1, updatedAt: -1 }),
    ]).then(() => undefined);
  }

  return cache.indexesReady;
}