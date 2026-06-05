import { MongoClient } from 'mongodb';

let client;
let db;

export async function connectDB() {
  const { MONGODB_URI, DB_NAME = 'car_market' } = process.env;

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is required. Check server/.env.');
  }

  client = new MongoClient(MONGODB_URI);
  await client.connect();

  db = client.db(DB_NAME);

  console.log('MongoDB Atlas connected');
  return db;
}

export function getDB() {
  if (!db) {
    throw new Error('Database is not connected. Call connectDB() before getDB().');
  }

  return db;
}

