// components/Header.tsx
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface NavItem {
  href: string;
  label: string;
}

export default function Header() {
  const router = useRouter();
  const { spotifyUserId } = router.query as { spotifyUserId?: string };
  const { access_token } = router.query as { access_token?: string };

  const [clientSpotifyId, setClientSpotifyId] = useState<string | null>(null);
  const [clientAccessToken, setClientAccessToken] = useState<string | null>(null);

  useEffect(() => {
    // ページ遷移後もLocalStorageからID/Tokenを復元
    const storedId = localStorage.getItem('spotify_user_id');
    const storedToken = localStorage.getItem('spotify_access_token');
    if (storedId) setClientSpotifyId(storedId);
    if (storedToken) setClientAccessToken(storedToken);
  }, []);

  // 常に最新のID/Tokenを使用 (クエリパラメータ優先)
  const currentSpotifyId = spotifyUserId || clientSpotifyId;
  const currentAccessToken = access_token || clientAccessToken;
  const currentPath = router.pathname;

  const navItems: NavItem[] = [
    { href: `/profile`, label: 'プロフィール' },
    { href: `/matches`, label: 'マッチング' },
    { href: `/follows`, label: 'フォロー' },
    { href: `/chats`, label: 'チャット' },
  ];

  // ログアウト処理
  const handleLogout = async () => {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_user_id');
    setClientSpotifyId(null);
    setClientAccessToken(null);
    await supabase.auth.signOut();
    router.push('/'); // ログインページに戻る
  };
  
  // ログインページ(/)ではヘッダー非表示
  if (currentPath === '/') {
      return null;
  }

  return (
    // PDFのUIに合わせたヘッダー
    <header className="bg-gray-800 text-white p-4 shadow-md sticky top-0 z-50">
      <div className="max-w-lg mx-auto flex justify-between items-center">
        {/* 左側のナビゲーションリンク */}
        <nav className="flex space-x-4">
          {navItems.map((item) => {
            const query: { [key: string]: string } = {};
            
            // プロフィールページのみ access_token を使用
            if (item.href === '/profile' && currentAccessToken) {
              query.access_token = currentAccessToken;
            } else if (item.href !== '/profile' && currentSpotifyId) {
              query.spotifyUserId = currentSpotifyId;
            }
            
            const isActive = currentPath === item.href;

            return (
              <Link
                key={item.label}
                href={{ pathname: item.href, query }}
                className={`text-sm font-medium ${
                  isActive
                    ? 'text-green-400' // アクティブなリンク
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* 右側のログアウトボタン */}
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-gray-300 hover:text-white"
        >
          ログアウト
        </button>
      </div>
    </header>
  );
}