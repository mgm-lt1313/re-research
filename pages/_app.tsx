// pages/_app.tsx
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import NavBar from '../components/NavBar';
import Header from '../components/Header'; // 👈 1. Header をインポート
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter(); 
  
  // ログインページ('/') 以外でナビゲーションを表示
  const showNavigation = router.pathname !== '/';

  return (
    <>
      <Head>
        <title>Spotify音楽嗜好マッチング</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className="dark min-h-screen bg-gray-900 text-white">
        
        {/* 👈 2. Header を表示 (ログインページ以外) */}
        {showNavigation && <Header />}

        {/* 👈 3. main に padding-top を追加 (ヘッダー分: pt-16) */}
        <main className="pb-20 pt-16"> 
          <Component {...pageProps} />
        </main>

        {/* 👈 4. NavBar (フッター) を表示 (ログインページ以外) */}
        {showNavigation && <NavBar />}
      </div>
    </>
  );
}

export default MyApp;