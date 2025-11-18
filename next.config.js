// next.config.js
module.exports = {
  images: {
    // domains: ['i.scdn.co'], // 👈 この行は削除
    
    // ▼▼▼ 以下 remotePatterns を追加 ▼▼▼
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.scdn.co', // Spotifyドメイン
      },
      {
        protocol: 'https',
        hostname: 'yboaukncljdigwxwtju.supabase.co', // 👈 あなたのSupabaseドメイン
      },
    ],
    // ▲▲▲ 追加ここまで ▲▲▲
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};