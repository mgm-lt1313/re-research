// pages/api/match/get-recommendations.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
import { PoolClient } from 'pg'; // 型定義は pg から取得

// 内部UUIDを取得するヘルパー (変更なし)
async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    // pool.query を直接使用
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

// 自分のコミュニティIDを取得するヘルパー (client を引数に取らないように変更)
async function getMyCommunityId(selfId: string): Promise<number | null> {
    // pool.query を直接使用
    const res = await pool.query('SELECT community_id FROM communities WHERE user_id = $1', [selfId]);
    return res.rows.length > 0 ? res.rows[0].community_id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    const { spotifyUserId } = req.body;
    if (!spotifyUserId) {
        return res.status(400).json({ message: 'Missing spotifyUserId.' });
    }

    try {
        // ▼▼▼ 修正: pool.connect() / client.release() を削除 ▼▼▼
        const selfId = await getUserIdBySpotifyId(spotifyUserId);
        if (!selfId) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const myCommunityId = await getMyCommunityId(selfId);
        
        const query = `
            WITH MySimilarities AS (
                SELECT
                    CASE WHEN user_a_id = $1 THEN user_b_id ELSE user_a_id END AS other_user_id,
                    artist_similarity,
                    genre_similarity,
                    combined_similarity,
                    common_artists,
                    common_genres
                FROM similarities
                WHERE (user_a_id = $1 OR user_b_id = $1)
                  AND combined_similarity >= 0.20
            ),
            MatchesWithCommunity AS (
                SELECT
                    s.other_user_id,
                    s.artist_similarity,
                    s.genre_similarity,
                    s.combined_similarity,
                    s.common_artists,
                    s.common_genres,
                    c.community_id,
                    u.nickname,
                    u.profile_image_url,
                    u.bio,
                    (s.combined_similarity + (CASE WHEN c.community_id = $2 THEN 0.2 ELSE 0 END)) AS match_score,
                    (c.community_id = $2) AS is_same_community
                FROM MySimilarities s
                JOIN users u ON s.other_user_id = u.id
                LEFT JOIN communities c ON s.other_user_id = c.user_id
            )
            SELECT *
            FROM MatchesWithCommunity
            ORDER BY match_score DESC
            LIMIT 10;
        `;
        
        // pool.query を直接使用
        const { rows } = await pool.query(query, [selfId, myCommunityId]);

        res.status(200).json({ matches: rows });
        // ▲▲▲ 修正ここまで ▲▲▲

    } catch (dbError) {
        console.error('Recommendation calculation failed:', dbError);
        res.status(500).json({ message: 'Failed to get recommendations.' });
    }
    // finally { client.release() } は不要
}