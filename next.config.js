// next.config.js
module.exports = {
  images: {
    // ▼▼▼ "domains" から "remotePatterns" に変更します ▼▼▼
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co', // 既存のSpotifyドメイン
      },
      {
        protocol: 'https',
        hostname: 'yboauknclliydigxwtju.supabase.co', // 👈 あなたのSupabaseドメイン
      },
    ],
    // ▲▲▲ 修正ここまで ▲▲▲
  },
  eslint: {
    // ビルド時にESLintエラーがあってもビルドを続行する
    ignoreDuringBuilds: true,
  },
};