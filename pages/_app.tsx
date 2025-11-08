import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Spotify音楽嗜好マッチング</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <div className="dark min-h-screen bg-gray-900 text-white">
        <Component {...pageProps} />
      </div>
    </>
  );
}

export default MyApp;