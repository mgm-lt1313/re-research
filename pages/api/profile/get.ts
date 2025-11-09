import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db'; // データベース接続をインポート

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // クエリパラメータから Spotify User ID を取得
  const { spotifyUserId } = req.query;

  if (!spotifyUserId || typeof spotifyUserId !== 'string') {
    return res.status(400).json({ message: 'Missing required query parameter: spotifyUserId' });
  }

  try {
    // pool.connect() と client.release() を使わず、直接 pool.query を呼ぶ
    const result = await pool.query(
      'SELECT nickname, profile_image_url, bio FROM users WHERE spotify_user_id = $1',
      [spotifyUserId]
    );

    if (result.rows.length > 0) {
      // プロフィールが存在する場合
      res.status(200).json({ profile: result.rows[0] });
    } else {
      // プロフィールが存在しない場合
      res.status(200).json({ profile: null });
    }
  } catch (error) {
    console.error('Database connection or query failed:', error);
    res.status(500).json({ message: 'Failed to retrieve profile due to database error.' });
  }
}