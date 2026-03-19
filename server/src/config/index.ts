import dotenv from 'dotenv';

dotenv.config();

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  jwtSecret: getRequiredEnv('JWT_SECRET'),
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  port: parseInt(process.env.PORT || '3200', 10),
  databasePath: process.env.DATABASE_PATH || './data/calendar.db',
};
