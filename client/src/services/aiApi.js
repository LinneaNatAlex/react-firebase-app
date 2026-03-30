// Kaller backend /api/ai (Groq). API-nøkkel ligger kun på serveren. Kun bedrift med aiPass.

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
    const err = new Error(data.error || data.message || 'AI-kall feilet');
    err.status = res.status;
    throw err;
  }
  return data;
}
