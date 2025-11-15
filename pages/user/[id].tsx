// pages/user/[id].tsx
// 👈 1. next/router, next/image, next/link, GetServerSideProps のインポートを削除
import { useEffect, useState } from 'react';
import axios from 'axios';

// ユーザー詳細データの型
interface UserDetail {
  profile: {
    id: string;
    nickname: string;
    profile_image_url: string | null;
    bio: string | null;
  };
  similarity: {
    artist_similarity: number;
    genre_similarity: number;
    combined_similarity: number;
    common_artists: string[];
    common_genres: string[];
  } | null;
  follow_status: 'pending' | 'approved' | 'none'; // 'none' = 未フォロー
  i_am_follower: boolean; // 自分がフォローしているか
}

export default function UserProfilePage() {
  // 👈 2. router を削除し、StateでIDを管理
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [selfSpotifyId, setSelfSpotifyId] = useState<string | null>(null);

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);

  // 👈 3. window.locationからIDを取得するuseEffectを追加
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const id = window.location.pathname.split('/').pop() || null;
      const selfId = params.get('selfSpotifyId');
      
      setTargetUserId(id);
      setSelfSpotifyId(selfId);

      // localStorageからもフォールバック (NavBarからの遷移用)
      if (!selfId) {
        const storedSelfId = localStorage.getItem('spotify_user_id');
        if (storedSelfId) {
          setSelfSpotifyId(storedSelfId);
        }
      }
    }
  }, []); // ページロード時に1回だけ実行

  useEffect(() => {
    // 👈 4. 依存配列を State のIDに変更
    if (!targetUserId || !selfSpotifyId) {
        setLoading(false);
        return;
    }

    const fetchUser = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/user/${targetUserId}`, {
          params: { selfSpotifyId }
        });
        setUser(res.data);
      } catch (e: unknown) {
        console.error("Failed to fetch user details:", e);
        setError('ユーザー情報の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [targetUserId, selfSpotifyId]); // 👈 依存配列を変更

  // フォロー/フォロー解除処理 (変更なし)
  const handleFollow = async () => {
    if (followLoading || !user || !selfSpotifyId) return;
    setFollowLoading(true);

    try {
      if (user.follow_status === 'none') {
        // --- フォローする ---
        const res = await axios.post('/api/follow/request', {
          targetUserId: user.profile.id,
          selfSpotifyId: selfSpotifyId
        });
        // 状態を即時反映
        setUser(prev => prev ? ({
          ...prev,
          follow_status: res.data.status, // 'pending' or 'approved'
          i_am_follower: true,
        }) : null);
        if (res.data.status === 'approved') {
          alert('マッチングが成立しました！');
        } else {
          alert('フォローリクエストを送信しました。');
        }
      } else {
        // --- フォロー解除する ---
        const res = await axios.post('/api/follow/unfollow', {
          targetUserId: user.profile.id,
          selfSpotifyId: selfSpotifyId
        });
        // 状態を即時反映
        setUser(prev => prev ? ({
          ...prev,
          follow_status: 'none',
          i_am_follower: false,
        }) : null);
        alert('フォローを解除しました。');
      }
    } catch (e: unknown) {
      console.error("Follow/Unfollow error:", e);
      alert('操作に失敗しました。');
    } finally {
      setFollowLoading(false);
    }
  };


  if (loading) return <div className="p-4 text-center">読み込み中...</div>;
  if (error) return <div className="p-4 text-center text-red-500">{error}</div>;
  if (!user) return <div className="p-4 text-center">ユーザーが見つかりません。</div>;

  const { profile, similarity, follow_status, i_am_follower } = user;
  
  // フォローボタンのテキストとスタイル (変更なし)
  let followButtonText = 'フォロー';
  let followButtonClass = 'bg-blue-600 hover:bg-blue-700';
  if (follow_status === 'approved') {
    followButtonText = 'フォロー解除';
    followButtonClass = 'bg-red-600 hover:bg-red-700';
  } else if (follow_status === 'pending' && i_am_follower) {
    followButtonText = 'リクエスト解除';
    followButtonClass = 'bg-red-600 hover:bg-red-700';
  } else if (follow_status === 'pending' && !i_am_follower) {
    followButtonText = '承認する'; // 相手からリクエストが来ている
    followButtonClass = 'bg-green-600 hover:bg-green-700';
  }

  return (
    <div className="p-4 max-w-xl mx-auto text-white">
      {/* 👈 5. Link を <a> に変更 */}
      <a href={`/matches?spotifyUserId=${selfSpotifyId}`} className="text-blue-400 hover:text-blue-300 mb-4 inline-block transition-colors">
        &lt; マッチング一覧に戻る
      </a>
      
      {/* ユーザーヘッダー (👈 6. Image を <img> に変更) */}
      <div className="flex items-center space-x-4 mb-4">
        {profile.profile_image_url ? (
          <img src={profile.profile_image_url} alt={profile.nickname} className="w-20 h-20 rounded-full object-cover" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-600"></div>
        )}
        <div>
          <h1 className="text-3xl font-bold">{profile.nickname} [cite: 45]</h1>
          <p className="text-gray-300">{profile.bio || '(自己紹介なし)'} [cite: 45]</p>
        </div>
      </div>

      {/* フォローボタン (変更なし) */}
      <button
        onClick={handleFollow}
        disabled={followLoading}
        className={`w-full py-2 px-4 rounded font-bold text-white transition-colors ${followLoading ? 'bg-gray-500' : followButtonClass}`}
      >
        {followLoading ? '処理中...' : followButtonText} [cite: 46]
      </button>

      {/* 類似度情報 (変更なし) */}
      {similarity && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md my-6">
          <h2 className="text-xl font-bold mb-4">あなたとの共通点</h2>
          <div className="mb-4">
            <span className="font-bold text-lg text-green-400">総合一致度: {Math.round(similarity.combined_similarity * 100)}%</span>
            <span className="text-sm text-gray-400 ml-2">
              (アーティスト: {Math.round(similarity.artist_similarity * 100)}%, ジャンル: {Math.round(similarity.genre_similarity * 100)}%)
            </span>
          </div>

          <div className="mb-4">
            <h3 className="font-semibold mb-2">共通しているフォローアーティスト [cite: 51]</h3>
            {similarity.common_artists.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {similarity.common_artists.map(artist => (
                  <span key={artist} className="bg-gray-700 px-3 py-1 rounded-full text-sm">{artist} [cite: 52, 53]</span>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">共通のアーティストはいません。</p>}
          </div>

          <div>
            <h3 className="font-semibold mb-2">共通しているジャンル [cite: 47]</h3>
            {similarity.common_genres.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {similarity.common_genres.map(genre => (
                  <span key={genre} className="bg-gray-700 px-3 py-1 rounded-full text-sm">{genre} [cite: 48, 49]</span>
                ))}
              </div>
            ) : <p className="text-gray-400 text-sm">共通のジャンルはいません。</p>}
          </div>
        </div>
      )}
      
    </div>
  );
}

// 👈 7. getServerSideProps を削除