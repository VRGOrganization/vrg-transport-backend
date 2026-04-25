import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;
let mongoUri = '';

export async function connectTestDB(): Promise<string> {
  mongod = await MongoMemoryServer.create();
  mongoUri = mongod.getUri();
  return mongoUri;
}

export async function clearTestDB(): Promise<void> {
  if (!mongoUri) return;

  const connection = await mongoose.createConnection(mongoUri).asPromise();
  const collections = connection.collections;

  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  await connection.close();
}

export async function closeTestDB(): Promise<void> {
  mongoUri = '';
  if (mongod) {
    await mongod.stop();
  }
}
