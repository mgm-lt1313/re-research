// pages/_app.tsx
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import Header from '../components/Header';
import { useRouter } from 'next/router';

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter(); 
  
  const showNavigation = router.pathname !== '/';

  return (
    <>
      <Head>
        <title>Spotify音楽嗜好マッチング</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      {/* ▼▼▼ この div のクラス名を元に戻します ▼▼▼ */}
      <div className="dark min-h-screen bg-gray-900 text-white">
      {/* 変更点：
        1. `dark` を復活
        2. `bg-white` を `bg-gray-900` に変更
        3. `text-gray-900` を `text-white` に変更
      */}
      {/* ▲▲▲ 変更ここまで ▲▲▲ */}
        
        {showNavigation && <Header />}

        <main className="pt-20"> 
          <Component {...pageProps} />
        </main>
        
      </div>
    </>
  );
}

export default MyApp;