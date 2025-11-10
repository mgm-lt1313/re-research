// pages/match.tsx (UI改善版)
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { SpotifyProfile, getMyProfile } from '../lib/spotify';
import Image from 'next/image';
import Link from 'next/link';

interface UserProfile {
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
}

// ▼ MatchResult の型を API レスポンスに合わせて更新
interface MatchResult {
  other_user_id: string; // uuid
  nickname: string;
  profile_image_url: string | null;
  bio: string | null;
  artist_similarity: number;
  genre_similarity: number;
  combined_similarity: number;
  match_score: number;
  is_same_community: boolean;
  common_artists: string; // JSON文字列
  common_genres: string; // JSON文字列
  // ▼▼▼ 【追加】 ▼▼▼
  follow_status: 'pending' | 'approved' | null;
  i_am_follower: boolean;
  // ▲▲▲ 【追加】 ▲▲▲
}

// (ProfileEditorProps, ProfileEditor コンポーネントは変更なし)
// ... (ProfileEditor ... )

export default function Match() {
  const router = useRouter();
  const { access_token } = router.query as { access_token?: string };

  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string>('');
  const [profileImageUrl, setProfileImageUrl] = useState<string>('');
  const [bio, setBio] = useState<string>('');
  
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [followingInProgress, setFollowingInProgress] = useState<Set<string>>(new Set());

  // (useEffect, handleProfileSubmit は変更なし)
  // ... (useEffect) ...

  // ▼ handleFollow を handleFollowRequest にリネーム
  const handleFollowRequest = async (targetUserId: string, targetNickname: string) => {
    // 既にリクエスト処理中の場合は何もしない
    if (followingInProgress.has(targetUserId)) return;

    setFollowingInProgress(prev => new Set(prev).add(targetUserId));
    try {
      if (!profile) throw new Error('Profile not loaded');
      
      const res = await axios.post('/api/follow/request', {
        targetUserId: targetUserId,
        selfSpotifyId: profile.id
      });

      // ▼▼▼ APIレスポンスに応じてアラートと状態を更新 ▼▼▼
      if (res.data.status === 'approved') {
         alert(`${targetNickname} さんとマッチングが成立しました！ チャット一覧から会話を始められます。`);
      } else {
         alert(`${targetNickname} さんにフォローリクエストを送信しました。`);
      }

      // マッチングリストを更新してボタンの状態を変える
      setMatches(currentMatches => 
        currentMatches.map(m => 
          m.other_user_id === targetUserId 
            ? { ...m, follow_status: res.data.status, i_am_follower: true } // 状態を更新
            : m
        )
      );
      // ▲▲▲ 更新ここまで ▲▲▲

    } catch (err: unknown) {
      let errorMessage = 'フォローリクエストに失敗しました。';
      if (axios.isAxiosError(err) && err.response?.data?.message) {
          errorMessage = `失敗: ${err.response.data.message}`;
      }
      alert(errorMessage);
    } finally {
      // 成功・失敗に関わらず処理中状態を解除
      setFollowingInProgress(prev => {
        const next = new Set(prev);
        next.delete(targetUserId);
        return next;
      });
    }
  };

  
  // (handleProfileSubmit, loading, error, editorProps, isNewUser, isEditingProfile のロジックは変更なし)
  // ... (handleProfileSubmit) ...
  // ... (loading, error, editorProps) ...
  // ... (isNewUser, isEditingProfile) ...


  // ▼ メインのマッチング表示部分 (JSX)
  return (
    <div className="p-4 max-w-2xl mx-auto text-white">
      {profile && (
        // (ヘッダー部分は変更なし)
        <div className="bg-gray-800 p-6 rounded-lg shadow-md mb-6 relative">
          <div className="absolute top-4 right-4 flex space-x-2">
            <Link href={`/chats?spotifyUserId=${profile.id}`} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm">チャット一覧</Link>
            <button onClick={() => setIsEditingProfile(true)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded text-sm">プロフィール編集</button>
          </div>
          <div className="flex items-center space-x-4 mb-4">
            {(profileImageUrl || profile.images?.[0]?.url) && (<Image src={profileImageUrl || profile.images?.[0]?.url || ''} alt={nickname || profile.display_name || 'プロフィール画像'} width={40} height={40} className="w-10 h-10 rounded-full object-cover" />)}
            <div>
              <h1 className="text-2xl font-bold">こんにちは、{nickname || profile.display_name} さん！</h1>
              <a href={profile.external_urls.spotify} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline text-sm">Spotifyで開く</a>
            </div>
          </div>
        </div>
      )}

      {/* ▼▼▼ おすすめマッチングの表示ロジック ▼▼▼ */}
      {/* ▼▼▼【修正】0件の場合の表示ロジックを追加 ▼▼▼ */}
      <div>
        <h2 className="text-xl font-bold mt-8 mb-4 border-b border-gray-700 pb-2">🔥 おすすめのマッチング</h2>
        
        {/* 0件かつローディング終了時にメッセージ表示 */}
        {matches.length === 0 && !loading && (
          <div className="bg-gray-800 p-6 rounded-lg text-center text-gray-400">
            <p className="text-lg font-semibold mb-2">まだおすすめのユーザーがいません</p>
            <p className="text-sm">
              新しいユーザーが登録されると、マッチング計算が自動的に実行されます。
            </p>
          </div>
        )}

        {/* 1件以上ある場合のみリストを表示 */}
        {matches.length > 0 && (
          <ul className="space-y-4 mb-8">
            {matches.map((match) => {
              // ... (中略: isFollowing, commonArtists, commonGenres) ...
              // ... (中略: <li> の中身) ...
              const isFollowing = followingInProgress.has(match.other_user_id);
              const commonArtists: string[] = JSON.parse(match.common_artists || '[]');
              const commonGenres: string[] = JSON.parse(match.common_genres || '[]');

              return (
              <li key={match.other_user_id} className="bg-gray-700 p-4 rounded-lg shadow-md">
                <div className="flex items-start space-x-4">
                  {match.profile_image_url ? (<Image src={match.profile_image_url} alt={match.nickname} width={48} height={48} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />) : (<div className="w-12 h-12 rounded-full bg-gray-600 flex-shrink-0"></div>)}
                  
                  <div className="flex-grow">
                    <h3 className="text-lg font-bold">{match.nickname}</h3>
                    {match.is_same_community && (
                        <span className="text-xs font-bold text-cyan-300">★同じ音楽コミュニティ</span>
                    )}
                    <p className="text-sm text-gray-300 mt-1 mb-2 line-clamp-2">{match.bio || '(自己紹介文がありません)'}</p>
                    
                    <div className="text-sm mb-2">
                        <span className="font-bold text-white">総合一致度: {Math.round(match.combined_similarity * 100)}%</span>
                        <span className="text-xs text-gray-400 ml-2">
                            (アーティスト: {Math.round(match.artist_similarity * 100)}%, ジャンル: {Math.round(match.genre_similarity * 100)}%)
                        </span>
                    </div>
                    {commonArtists.length > 0 && (
                        <div className="text-xs text-gray-300">
                           <span className="font-semibold">共通アーティスト:</span> {commonArtists.slice(0, 3).join(', ')} {commonArtists.length > 3 ? '...' : ''}
                        </div>
                    )}
                    {commonGenres.length > 0 && (
                         <div className="text-xs text-gray-300">
                           <span className="font-semibold">共通ジャンル:</span> {commonGenres.slice(0, 2).join(', ')} {commonGenres.length > 2 ? '...' : ''}
                        </div>
                    )}
                  </div>
                  
                  <button onClick={() => handleFollow(match.other_user_id)} disabled={isFollowing} className={`flex-shrink-0 px-4 py-2 rounded font-semibold text-sm ${isFollowing ? 'bg-gray-500 text-white cursor-wait' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
                    {isFollowing ? '送信中...' : 'フォロー'}
                  </button>
                </div>
              </li>
            );})}
          </ul>
        )}
      </div>
      {/* ▲▲▲ 修正ここまで ▲▲▲ */}
    </div>
  );
}