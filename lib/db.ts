import { createPool } from '@vercel/postgres';

// DATABASE_URL 環境変数が設定されているか確認
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// pg の Pool の代わりに @vercel/postgres の createPool を使用
const pool = createPool({
  connectionString: process.env.DATABASE_URL,
  // SSL設定などは @vercel/postgres が環境変数から自動で判断します
});

// データベース接続テスト (起動時に一度だけ実行)
// @vercel/postgres では pool.on('connect') は不要なため削除

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export default pool;