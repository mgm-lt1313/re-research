// next.config.js
module.exports = {
  images: {
    // domains: ['i.scdn.co'], // 👈 この行をコメントアウトするか削除し、
    
    // ▼▼▼ 以下 remotePatterns を追加 ▼▼▼
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co', // 既存のSpotifyドメイン
      },
      {
        protocol: 'https',
        hostname: 'yboaukncljdigwxwtju.supabase.co', // 👈 Supabaseドメイン
      },
    ],
    // ▲▲▲ 追加ここまで ▲▲▲
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};