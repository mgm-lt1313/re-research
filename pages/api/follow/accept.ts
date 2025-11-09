// pages/api/follow/accept.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
// PoolClient は不要になったため削除

async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    // pool.query を直接使用
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).end();

    const { selfSpotifyId, followId: followIdInput } = req.body;

    if (!selfSpotifyId || followIdInput === undefined || followIdInput === null) {
        return res.status(400).json({ message: 'Missing selfSpotifyId or followId.' });
    }

    let followId: number;
    if (typeof followIdInput === 'string') {
        followId = parseInt(followIdInput, 10);
        if (isNaN(followId)) {
             return res.status(400).json({ message: 'Invalid followId format, expected number or numeric string.' });
        }
    } else if (typeof followIdInput === 'number') {
        followId = followIdInput;
    } else {
        return res.status(400).json({ message: 'Invalid followId type.' });
    }


    try {
        // ▼▼▼ 修正: pool.connect() / client.release() を削除 ▼▼▼
        const selfId = await getUserIdBySpotifyId(selfSpotifyId);
        if (!selfId) return res.status(404).json({ message: 'User not found.' });

        const updateRes = await pool.query(
            `UPDATE follows
             SET status = 'approved'
             WHERE id = $1
               AND following_id = $2
               AND status = 'pending'
             RETURNING id`,
            [followId, selfId]
        );

        if (updateRes.rowCount === 0) {
            return res.status(404).json({ message: 'Pending follow request not found for this user, or already approved/rejected.' });
        }

        res.status(200).json({ message: 'Match approved successfully!', match_id: updateRes.rows[0].id });
        // ▲▲▲ 修正ここまで ▲▲▲

    } catch (dbError: unknown) {
        console.error('Failed to accept follow request:', dbError);
        const message = dbError instanceof Error ? dbError.message : 'Unknown database error';
        res.status(500).json({ message: `Database error while accepting follow: ${message}` });
    }
    // finally { client.release() } は不要
}