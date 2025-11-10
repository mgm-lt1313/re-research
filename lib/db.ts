import { Pool } from 'pg';
import 'pg-types'; 

// 最初に環境変数を変数に格納します
const connectionString = process.env.DATABASE_URL;

// 接続文字列が存在するかどうかを厳密にチェックします
if (!connectionString) {
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.error("FATAL ERROR: DATABASE_URL environment variable is not set.");
  console.error("Please create a .env.local file and add your connection string.");
  console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  // 開発サーバーの起動時（インポート時）にエラーをスローして停止させます
  throw new Error('DATABASE_URL is not set. The application cannot connect to the database.');
}

const pool = new Pool({
  connectionString: connectionString, // 警告が出ないよう、チェック済みの変数を使用します
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

export default pool;