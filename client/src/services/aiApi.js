// Kaller backend /api/ai. API-nøkkel ligger kun på serveren. Kun bedrift med aiPass.

export function getAiApiBase() {
  return String(import.meta.env.VITE_AI_API_URL || 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
}

/**
 * @param {import('firebase/auth').User} currentUser
 * @param {'jobPosting'|'rankApplicants'} action
 * @param {object} payload
 */
export async function postAi(currentUser, action, payload) {
  if (!currentUser) {
    throw new Error('Du må være innlogget');
  }
  const token = await currentUser.getIdToken();
  const res = await fetch(`${getAiApiBase()}/api/ai`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 402) {
    const err = new Error('AI_LIMIT');
    err.code = 'AI_LIMIT';
    err.quota = data;
    throw err;
  }
  if (!res.ok) {
    let msg = data.error || data.message || 'AI-kall feilet';
    if (
      res.status === 503 &&
      typeof msg === 'string' &&
      msg.includes('Firebase Admin')
    ) {
      msg =
        'Node-serveren mangler Firebase Admin-nøkkel. Legg firebase-admin-key.json i server-mappen (se server/.env.example), start server på nytt.';
    }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}
