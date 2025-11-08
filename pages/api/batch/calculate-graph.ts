import type { NextApiRequest, NextApiResponse } from 'next';
import pool from '../../../lib/db'; //
import { PoolClient } from 'pg';
import Graph from 'graphology'; //
// @ts-ignore 
// Step 2でインストールしたLouvain法ライブラリ
import { louvain } from 'graphology-communities-louvain';

// --- 研究計画 3.1 & 3.2 ---
/**
 * Jaccard係数を計算するヘルパー関数
 * @param setA 集合A
 * @param setB 集合B
 */
function calculateJaccard(setA: Set<string>, setB: Set<string>): { similarity: number, intersection: Set<string> } {
  const intersection = new Set<string>([...setA].filter(x => setB.has(x)));
  const union = new Set<string>([...setA, ...setB]);

  if (union.size === 0) {
    return { similarity: 0, intersection };
  }
  
  return { similarity: intersection.size / union.size, intersection };
}

// DBから取得するアーティストデータの型
interface DbUserArtist {
  user_id: string; // uuid
  artist_id: string;
  genres: string; // DBからはJSON文字列として取得
}

// 計算用に整形するデータ型
type UserDataMap = Map<string, {
  artists: Set<string>;
  genres: Set<string>;
}>;

/**
 * DBから全ユーザーのアーティストとジャンルのセットを取得
 */
async function getAllArtistData(client: PoolClient): Promise<UserDataMap> {
  const res = await client.query<DbUserArtist>(
    // genresがJSONB型なので、TEXT型にキャストして取得
    'SELECT user_id, artist_id, genres::TEXT FROM user_artists'
  );

  const userMap: UserDataMap = new Map();

  for (const row of res.rows) {
    // ユーザーがMapになければ初期化
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        artists: new Set<string>(),
        genres: new Set<string>(),
      });
    }

    const userData = userMap.get(row.user_id)!;
    
    // アーティストIDを追加
    userData.artists.add(row.artist_id);

    // ジャンルを追加 (JSON文字列をパース)
    try {
      const genres: string[] = JSON.parse(row.genres || '[]');
      for (const genre of genres) {
        // ジャンル名を正規化 (例: 'j-pop' と 'J-Pop' を統一)
        userData.genres.add(genre.toLowerCase().trim());
      }
    } catch (e) {
      console.warn(`Could not parse genres for user ${row.user_id}: ${row.genres}`);
    }
  }

  return userMap;
}


// APIメインハンドラ
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed. Use GET to trigger.' });
  }

  // (オプション) 将来的にVercel Cronで実行する場合、不正アクセス防止のシークレットキーを設定できます
  // if (req.query.secret !== process.env.BATCH_SECRET) {
  //   return res.status(401).json({ message: 'Invalid secret.' });
  // }

  console.log('[Batch] === Start: Similarity & Graph Calculation ===');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. 全ユーザーのアーティスト・ジャンルデータをDBから取得
    const userDataMap = await getAllArtistData(client);
    const userIds = Array.from(userDataMap.keys());
    console.log(`[Batch] Step 1: Loaded data for ${userIds.length} users.`);

    if (userIds.length < 2) {
      await client.query('ROLLBACK');
      console.log('[Batch] Canceled: Need at least 2 users to calculate similarities.');
      return res.status(200).json({ message: 'Calculation skipped: Need at least 2 users.' });
    }

    // 2. 類似度計算 (研究計画 3)
    const allSimilarities: any[] = [];
    for (let i = 0; i < userIds.length; i++) {
      for (let j = i + 1; j < userIds.length; j++) {
        const userA_id = userIds[i];
        const userB_id = userIds[j];
        
        const dataA = userDataMap.get(userA_id)!;
        const dataB = userDataMap.get(userB_id)!;

        // 3.1 アーティスト類似度
        const { similarity: artistSim, intersection: commonArtists } = calculateJaccard(dataA.artists, dataB.artists);
        // 3.2 ジャンル類似度
        const { similarity: genreSim, intersection: commonGenres } = calculateJaccard(dataA.genres, dataB.genres);

        // 3.3 総合類似度 (研究計画 3.3)
        const w1 = 0.6; // アーティスト重み
        const w2 = 0.4; // ジャンル重み
        const combinedSim = (artistSim * w1) + (genreSim * w2);

        allSimilarities.push({
          userA: userA_id,
          userB: userB_id,
          artistSim,
          genreSim,
          combinedSim,
          commonArtists: JSON.stringify(Array.from(commonArtists)),
          commonGenres: JSON.stringify(Array.from(commonGenres)),
        });
      }
    }
    console.log(`[Batch] Step 2: Calculated ${allSimilarities.length} similarity pairs.`);

    // 3. `similarities` テーブルをクリアし、一括挿入 (研究計画 9.1)
    await client.query('TRUNCATE TABLE similarities CASCADE'); // CASCADEで関連データをクリア
    
    if (allSimilarities.length > 0) {
      const simValues: (string | number | null)[] = [];
      const simQueryRows = allSimilarities.map((sim, index) => {
        const i = index * 7;
        simValues.push(
          sim.userA, sim.userB, sim.artistSim, sim.genreSim, 
          sim.combinedSim, sim.commonArtists, sim.commonGenres
        );
        return `($${i + 1}, $${i + 2}, $${i + 3}, $${i + 4}, $${i + 5}, $${i + 6}, $${i + 7})`;
      });
      const simInsertQuery = `
        INSERT INTO similarities (user_a_id, user_b_id, artist_similarity, genre_similarity, combined_similarity, common_artists, common_genres)
        VALUES ${simQueryRows.join(', ')}
      `;
      await client.query(simInsertQuery, simValues);
    }
    console.log(`[Batch] Step 3: Saved similarities to DB.`);

    // 4. グラフ構築 (研究計画 4)
    const graph = new Graph();
    const similarityThreshold = 0.20; // 閾値 (研究計画 4.3)

    // 4.1 ノード追加
    for (const userId of userIds) {
      graph.addNode(userId);
    }

    // 4.2 エッジ追加
    for (const sim of allSimilarities) {
      if (sim.combinedSim >= similarityThreshold) {
        // 重み付き無向エッジを追加 (研究計画 4.2)
        graph.addUndirectedEdge(sim.userA, sim.userB, { weight: sim.combinedSim });
      }
    }
    console.log(`[Batch] Step 4: Graph built (${graph.order} nodes, ${graph.size} edges).`);

    // 5. コミュニティ検出 (Louvain法) (研究計画 5)
    // resolution: 1.0 (標準), weighted: true (重み考慮)
    const communityAssignments = louvain(graph, { 
      resolution: 1.0, // (研究計画 5.5)
      weighted: true // (研究計画 5.4)
    });

    // { user1_id: 0, user2_id: 0, user3_id: 1, ... } の形式のオブジェクトが返る

    // 6. `communities` テーブルをクリアし、一括挿入 (研究計画 9.1)
    await client.query('TRUNCATE TABLE communities CASCADE'); // CASCADEで関連データをクリア

    const communityEntries = Object.entries(communityAssignments); // [ [userId, communityId], ... ]
    if (communityEntries.length > 0) {
      const commValues: (string | number)[] = [];
      const commQueryRows = communityEntries.map(([userId, communityId], index) => {
        const i = index * 2;
        // ▼▼▼ ここが修正点です ▼▼▼
        commValues.push(userId, communityId as number);
        // ▲▲▲ ここが修正点です ▲▲▲
        return `($${i + 1}, $${i + 2})`;
      });
      const commInsertQuery = `
        INSERT INTO communities (user_id, community_id)
        VALUES ${commQueryRows.join(', ')}
      `;
      await client.query(commInsertQuery, commValues);
    }
    console.log(`[Batch] Step 5 & 6: Communities detected and saved to DB.`);

    await client.query('COMMIT');
    console.log('[Batch] === Success: All calculations committed. ===');
    res.status(200).json({ 
      message: 'Batch calculation successful.',
      users: userIds.length,
      pairs: allSimilarities.length,
      edges: graph.size,
      communities: new Set(Object.values(communityAssignments)).size
    });

  } catch (error: unknown) {
    await client.query('ROLLBACK');
    console.error('[Batch] === Error: Transaction rolled back. ===', error);
    const message = error instanceof Error ? error.message : 'Unknown batch error';
    res.status(500).json({ message });
  } finally {
    client.release();
  }
}