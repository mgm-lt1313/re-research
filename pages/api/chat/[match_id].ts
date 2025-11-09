// pages/api/chat/[match_id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';
// ▼▼▼ 修正: 'PoolClient' のインポートを削除 ▼▼▼
// import { PoolClient } from 'pg';

// ユーザーID (uuid) を取得するヘルパー関数 (pool.query を直接使う)
async function getUserIdBySpotifyId(spotifyUserId: string): Promise<string | null> {
    const res = await pool.query('SELECT id FROM users WHERE spotify_user_id = $1', [spotifyUserId]);
    return res.rows.length > 0 ? res.rows[0].id : null;
}

// 認証チェック (pool.query を直接使う)
async function verifyUserMatchAccess(userId: string, matchId: number): Promise<boolean> {
     const res = await pool.query(
         `SELECT 1 FROM follows
          WHERE id = $1 AND (follower_id = $2 OR following_id = $2) AND status = 'approved'`,
         [matchId, userId]
     );
     return (res.rowCount ?? 0) > 0;
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { match_id: matchIdStr } = req.query as { match_id?: string };
    const selfSpotifyId = (req.method === 'GET' ? req.query.selfSpotifyId : req.body.senderSpotifyId) as string | undefined;

    console.log(`[API /api/chat/${matchIdStr}] Received ${req.method} request.`);
    console.log(`  Query params:`, req.query);
    console.log(`  Body params:`, req.body);
    console.log(`  Resolved selfSpotifyId:`, selfSpotifyId);

    if (!matchIdStr) {
        return res.status(400).json({ message: 'Missing match_id in URL path.' });
    }
    const matchId = parseInt(matchIdStr, 10);
    if (isNaN(matchId)) {
        return res.status(400).json({ message: 'Invalid match_id format, expected number.' });
    }
    if (!selfSpotifyId) {
        return res.status(401).json({ message: 'Missing authentication information (selfSpotifyId).' });
    }

    try {
        // ▼▼▼ 修正: pool.connect() を使わない ▼▼▼
        const selfId = await getUserIdBySpotifyId(selfSpotifyId);
        console.log(`  Internal selfId (uuid):`, selfId);
        if (!selfId) {
            return res.status(401).json({ message: 'User not found or invalid credentials.' });
        }

        const isParticipant = await verifyUserMatchAccess(selfId, matchId);
        console.log(`  Is participant authorized:`, isParticipant);
        if (!isParticipant) {
            return res.status(403).json({ message: 'You do not have access to this chat room.' });
        }

        if (req.method === 'GET') {
            const messagesRes = await pool.query(
                `SELECT id, created_at, sender_id, content
                 FROM messages
                 WHERE match_id = $1
                 ORDER BY created_at ASC`,
                [matchId]
            );
            res.status(200).json({ messages: messagesRes.rows });

        } else if (req.method === 'POST') {
            const { content } = req.body;
             console.log(`  POST content:`, content);
            if (!content || typeof content !== 'string' || content.trim().length === 0) {
                return res.status(400).json({ message: 'Message content cannot be empty.' });
            }
            console.log(`  Attempting to insert message: matchId=${matchId}, senderId=${selfId}, content=${content.trim()}`);

            const insertRes = await pool.query(
                `INSERT INTO messages (match_id, sender_id, content)
                 VALUES ($1, $2, $3)
                 RETURNING id, created_at, sender_id, content`,
                [matchId, selfId, content.trim()]
            );
            console.log(`  Message inserted successfully:`, insertRes.rows[0]);

            res.status(201).json({ message: 'Message sent successfully.', newMessage: insertRes.rows[0] });

        } else {
            res.setHeader('Allow', ['GET', 'POST']);
            res.status(405).json({ message: `Method ${req.method} Not Allowed` });
        }
        // ▲▲▲ 修正ここまで ▲▲▲

    } catch (dbError: unknown) {
        console.error(`Chat API error for match ${matchId}:`, dbError);
        const message = dbError instanceof Error ? dbError.message : 'Unknown database error';
        res.status(500).json({ message: `Database error in chat API: ${message}` });
    }
    // finally { client.release() } は不要
}