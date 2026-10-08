// OAuth สำหรับผู้ให้บริการที่ Supabase ไม่รองรับโดยตรง (LINE)
// เราทำ OAuth เองฝั่ง Server แล้วสร้าง/เข้าสู่ระบบผู้ใช้ใน Supabase ด้วย Admin API

export type SocialProfile = {
  id: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
};

type ProviderConfig = {
  label: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
  authorizeUrl: (p: { clientId: string; redirectUri: string; state: string }) => string;
  fetchProfile: (p: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }) => Promise<SocialProfile>;
};

async function postForm(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error_message || data.error || 'OAuth error');
  return data;
}

export const SOCIAL_PROVIDERS: Record<string, ProviderConfig> = {
  line: {
    label: 'LINE',
    clientId: process.env.LINE_CHANNEL_ID,
    clientSecret: process.env.LINE_CHANNEL_SECRET,
    authorizeUrl: ({ clientId, redirectUri, state }) =>
      'https://access.line.me/oauth2/v2.1/authorize?' +
      new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
        scope: 'profile openid email',
      }),
    fetchProfile: async ({ code, clientId, clientSecret, redirectUri }) => {
      const token = await postForm('https://api.line.me/oauth2/v2.1/token', {
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      });
      // ตรวจสอบ id_token กับ LINE โดยตรง เพื่อดึง sub / name / email
      const claims = await postForm('https://api.line.me/oauth2/v2.1/verify', {
        id_token: token.id_token,
        client_id: clientId,
      });
      return {
        id: claims.sub,
        email: claims.email ?? null,
        name: claims.name ?? null,
        avatar: claims.picture ?? null,
      };
    },
  },
};

export const STATE_COOKIE = 'paybio_oauth_state';

export function callbackUrl(origin: string, provider: string) {
  return `${origin}/auth/social/${provider}/callback`;
}

// ผู้ให้บริการที่ไม่ส่งอีเมลมา ใช้อีเมลภายในที่ผูกกับ id ของผู้ให้บริการแทน
export function accountEmail(provider: string, profile: SocialProfile) {
  return profile.email ?? `${provider}_${profile.id}@users.paybio.local`.toLowerCase();
}
