// pages/api/follow/request.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
// PoolClient は不要になったため削除

async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    // pool.query を直接使用
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { selfSpotifyId, targetUserId } = req.body;

    if (!selfSpotifyId || !targetUserId) {
        return res.status(400).json({ message: 'Missing selfSpotifyId or targetUserId.' });
    }
    if (typeof selfSpotifyId !== 'string' || typeof targetUserId !== 'string' || selfSpotifyId.length < 10 || targetUserId.length < 10 ) {
         return res.status(400).json({ message: 'Invalid ID format.' });
    }
    if (selfSpotifyId === targetUserId) {
         return res.status(400).json({ message: 'Cannot follow yourself.' });
    }

    try {
        // ▼▼▼ 修正: pool.connect() / client.release() を削除 ▼▼▼
        const selfId = await getUserIdBySpotifyId(selfSpotifyId);
        if (!selfId) {
            return res.status(404).json({ message: 'Self user not found in database.' });
        }

        if (selfId === targetUserId) {
             return res.status(400).json({ message: 'Internal check: Cannot follow yourself.' });
        }

        const targetUserCheck = await pool.query('SELECT id FROM users WHERE id = $1', [targetUserId]);
        if (targetUserCheck.rows.length === 0) {
            return res.status(404).json({ message: 'Target user not found.' });
        }

        const check = await pool.query(
            `SELECT id, follower_id, status FROM follows
             WHERE (follower_id = $1 AND following_id = $2)
                OR (follower_id = $2 AND following_id = $1)`,
            [selfId, targetUserId]
        );

        if (check.rows.length > 0) {
            const existingRequest = check.rows[0];
            if (existingRequest.follower_id === targetUserId && existingRequest.status === 'pending') {
                await pool.query(
                    'UPDATE follows SET status = $1 WHERE id = $2',
                    ['approved', existingRequest.id]
                );
                return res.status(200).json({ message: 'Match approved automatically!', status: 'approved' });
            }
            return res.status(409).json({ message: 'Request already exists or is in a different state.', status: existingRequest.status });
        }

        await pool.query(
            'INSERT INTO follows (follower_id, following_id, status) VALUES ($1, $2, $3)',
            [selfId, targetUserId, 'pending']
        );

        res.status(201).json({ message: 'Follow request sent!', status: 'pending' });
        // ▲▲▲ 修正ここまで ▲▲▲

    } catch (dbError: unknown) {
        console.error('Follow request database operation failed:', dbError);
        let errorMessage = 'Database error occurred during follow request.';
        if (dbError instanceof Error) {
            errorMessage += ` Details: ${dbError.message}`;
        }
        res.status(500).json({ message: errorMessage });
    }
    // finally { client.release() } は不要
}