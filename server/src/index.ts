import dotenv from 'dotenv';
dotenv.config();

import { config } from './config';
import { getDb } from './db';
import app from './app';

// Initialize database
getDb();

app.listen(config.port, () => {
  console.log(`Calendar server running on port ${config.port}`);
});
