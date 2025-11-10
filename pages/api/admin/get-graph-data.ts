// pages/api/admin/get-graph-data.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db';

// グラフのノード（ユーザー）の型定義
interface GraphNode {
  id: string;          // ユーザーID (uuid)
  label: string;       // ニックネーム（可視化ツールでの表示名）
  community: number | null; // コミュニティID
  image_url: string | null; // プロフィール画像URL
}

// グラフのエッジ（繋がり）の型定義
interface GraphEdge {
  source: string; // ユーザーAのID
  target: string; // ユーザーBのID
  weight: number; // 総合類似度
}

// APIレスポンスの型定義
interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GraphData | { message: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // --- シークレットキーによる認証 ---
  const { secret } = req.query;
  const ADMIN_SECRET = process.env.ADMIN_SECRET_KEY;

  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    console.warn('[API get-graph-data] Invalid or missing secret key.');
    return res.status(401).json({ message: 'Unauthorized: Invalid secret key.' });
  }
  // --- 認証ここまで ---

  // 論文の定義に合わせて、エッジを作成する閾値を設定
  // (研究概要で 0.20 を推奨していたため)
  const SIMILARITY_THRESHOLD = 0.20;

  try {
    // 1. ノード情報を取得 (users と communities を結合)
    const nodesRes = await pool.query(
      `SELECT 
         u.id, 
         u.nickname AS label, 
         u.profile_image_url AS image_url,
         c.community_id AS community
       FROM users u
       LEFT JOIN communities c ON u.id = c.user_id`
    );
    const nodes: GraphNode[] = nodesRes.rows.map(row => ({
        ...row,
        // community_id が null の場合（コミュニティ未割り当て）も考慮
        community: row.community !== null ? Number(row.community) : null,
    }));

    // 2. エッジ情報を取得 (閾値以上の類似度のみ)
    const edgesRes = await pool.query(
      `SELECT 
         user_a_id AS source,
         user_b_id AS target,
         combined_similarity AS weight
       FROM similarities
       WHERE combined_similarity >= $1`,
      [SIMILARITY_THRESHOLD]
    );
    const edges: GraphEdge[] = edgesRes.rows.map(row => ({
        ...row,
        weight: Number(row.weight), // DBからは文字列で返る可能性があるため数値に変換
    }));

    console.log(`[API get-graph-data] Successfully fetched graph data: ${nodes.length} nodes, ${edges.length} edges.`);

    // 3. JSON形式でレスポンス
    res.status(200).json({
      nodes,
      edges,
    });

  } catch (dbError: unknown) {
    console.error('[API get-graph-data] Failed to fetch graph data:', dbError);
    const message = dbError instanceof Error ? dbError.message : 'Unknown database error';
    res.status(500).json({ message: `Database error: ${message}` });
  }
}