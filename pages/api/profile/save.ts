// pages/api/profile/save.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { getMyFollowingArtists, SpotifyArtist } from '../../../lib/spotify';
import { PoolClient } from 'pg'; // 👈 トランザクションのために PoolClient は必要です

/**
 * ユーザーの全フォローアーティストをDBに保存（または更新）する
 * (前回の修正（image_url 保存）を適用済み)
 */
async function saveAllFollowingArtists(
  client: PoolClient,
  userId: string,
  accessToken: string
) {
  const artists: SpotifyArtist[] = await getMyFollowingArtists(accessToken);
  console.log(`[API profile/save] Fetched ${artists.length} artists for user ${userId}`);

  await client.query(
    'DELETE FROM user_artists WHERE user_id = $1', 
    [userId]
  );

  if (artists.length === 0) {
    console.log(`[API profile/save] No artists to save for user ${userId}`);
    return;
  }

  const values: (string | number | null)[] = []; 
  const queryRows = artists.map((artist, index) => {
    const i = index * 6; // 👈 6列 (image_url を含む)
    values.push(
      userId, 
      artist.id, 
      artist.name, 
      JSON.stringify(artist.genres || []),
      artist.popularity,
      artist.images?.[2]?.url || artist.images?.[1]?.url || artist.images?.[0]?.url || null // 👈 画像URL
    );
    return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6})`;
  });

  const insertQuery = `
    INSERT INTO user_artists (user_id, artist_id, artist_name, genres, popularity, image_url) 
    VALUES ${queryRows.join(', ')}
  `;

  await client.query(insertQuery, values);
  console.log(`[API profile/save] Successfully saved ${artists.length} artists for user ${userId}`);
}


// メインのAPIハンドラ (修正版)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { spotifyUserId, nickname, profileImageUrl, bio, accessToken } = req.body;

  if (!spotifyUserId || !nickname) {
    return res.status(400).json({ message: 'Missing required fields: spotifyUserId and nickname' });
  } 
  if (!accessToken) {
    return res.status(400).json({ message: 'Missing required field: accessToken' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN'); // トランザクション開始

    // 1. ユーザープロフィールを users テーブルに挿入または更新
    const userCheck = await client.query(
      'SELECT id FROM users WHERE spotify_user_id = $1',
      [spotifyUserId]
    ); 

    let userId: string;
    if (userCheck.rows.length > 0) {
      userId = userCheck.rows[0].id;
      await client.query(
        'UPDATE users SET nickname = $1, profile_image_url = $2, bio = $3, updated_at = CURRENT_TIMESTAMP WHERE spotify_user_id = $4',
        [nickname, profileImageUrl || null, bio || null, spotifyUserId]
      ); 
    } else {
      const insertResult = await client.query(
        'INSERT INTO users (spotify_user_id, nickname, profile_image_url, bio) VALUES ($1, $2, $3, $4) RETURNING id',
        [spotifyUserId, nickname, profileImageUrl || null, bio || null]
      ); 
      userId = insertResult.rows[0].id;
    }

    // 2. フォローアーティストを保存
    await saveAllFollowingArtists(client, userId, accessToken);

    // ▼▼▼【削除】重い処理 (O(n)類似度計算) を削除 ▼▼▼
    // await calculateNewUserSimilarities(client, userId);
    // ▲▲▲ 削除ここまで ▲▲▲

    await client.query('COMMIT'); // トランザクションコミット
    
    // (変更なし) 全体計算(O(n^2))を非同期でトリガー
    // ※ 注意: Hobbyプランでは10秒でタイムアウトするため、このバッチ処理も10秒以内に終わる必要があります
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/batch/calculate-graph`)
      .catch(err => {
        console.error('Failed to trigger background graph calculation:', err);
      });

    res.status(200).json({ message: 'Profile and artists saved successfully!', userId: userId });

  } catch (dbError) {
    await client.query('ROLLBACK');
    console.error('Database transaction failed:', dbError);
    if (dbError instanceof Error && (dbError.message.includes('spotify') || dbError.message.includes('fetch'))) {
       res.status(500).json({ message: `Failed to fetch artists from Spotify: ${dbError.message}` });
    } else {
       res.status(500).json({ message: 'Failed to save profile due to database error.' });
    }
  } finally {
    client.release();
  }
}