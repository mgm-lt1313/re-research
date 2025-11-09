// pages/api/follow/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
// ▼▼▼ 修正: 'PoolClient' のインポートを削除 ▼▼▼
// import { PoolClient } from 'pg';

// (pool.query を直接使う)
async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

// --- 🔽 型定義を追加 ---
// マッチ済みユーザー情報の型 (フロントエンド chats.tsx と合わせる)
interface MatchProfile {
    id: string; // users.id (uuid)
    nickname: string;
    profile_image_url: string | null;
}
interface ApprovedMatchResult {
  match_id: number; // follows.id (bigint) - チャットルームID
  other_user: MatchProfile | undefined; // 相手のプロフィール (Mapに存在しない場合 undefined)
}
// --- 🔼 型定義を追加 ---

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).end();

    const { spotifyUserId } = req.query;
    if (!spotifyUserId || typeof spotifyUserId !== 'string') {
        return res.status(400).json({ message: 'Missing spotifyUserId query parameter.' });
    }

    try {
        // ▼▼▼ 修正: pool.connect() を使わない ▼▼▼
        const selfId = await getUserIdBySpotifyId(spotifyUserId);
        if (!selfId) return res.status(404).json({ message: 'User not found.' });

        // 1. 自分宛の承認待ちリクエスト (変更なし)
        const pendingRequests = await pool.query(
            `SELECT
                f.id as follow_id, u.id as user_id, u.nickname, u.profile_image_url
             FROM follows f
             JOIN users u ON f.follower_id = u.id
             WHERE f.following_id = $1 AND f.status = 'pending'`,
            [selfId]
        );

        // 2. 成立済みのマッチング (変更なし)
        const approvedMatches = await pool.query(
            `SELECT
                f.id as match_id,
                CASE
                    WHEN f.follower_id = $1 THEN f.following_id
                    ELSE f.follower_id
                END as other_user_id
             FROM follows f
             WHERE (f.follower_id = $1 OR f.following_id = $1)
               AND f.status = 'approved'`,
            [selfId]
        );

        const otherUserIds = approvedMatches.rows.map(r => r.other_user_id);

        let matchesWithProfiles: ApprovedMatchResult[] = [];

        if (otherUserIds.length > 0) {
            const usersRes = await pool.query(
                'SELECT id, nickname, profile_image_url FROM users WHERE id = ANY($1::uuid[])',
                [otherUserIds]
            );
            
            const userProfileMap = new Map<string, MatchProfile>(
                usersRes.rows.map(u => [u.id, { id: u.id, nickname: u.nickname, profile_image_url: u.profile_image_url }])
            );

            matchesWithProfiles = approvedMatches.rows.map(match => ({
                match_id: match.match_id,
                other_user: userProfileMap.get(match.other_user_id) // getは undefined を返す可能性がある
            }));
        }

        res.status(200).json({
            pendingRequests: pendingRequests.rows,
            approvedMatches: matchesWithProfiles // 型付けされた配列を返す
        });
        // ▲▲▲ 修正ここまで ▲▲▲

    } catch (dbError: unknown) {
        console.error('Failed to list follows/matches:', dbError);
        const message = dbError instanceof Error ? dbError.message : 'Unknown database error';
        res.status(500).json({ message: `Database error while fetching lists: ${message}` });
    }
    // finally { client.release() } は不要
}