/**
 * AI-tilgang for bedrifter: aiPass i Firestore.
 * Selve annonse + rangering kjøres i Python (PYTHON_AI_URL) – ikke i denne filen.
 */

/** Kun aiPass=true gir tilgang – ingen gratiskvote */
export async function getAiQuotaStatus(db, uid) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    return {
      allowed: false,
      reason: 'no_user_doc',
      remaining: 0,
      used: 0,
      limit: 0,
      pass: false,
    };
  }
  const d = snap.data();
  if (d.aiPass === true) {
    return {
      allowed: true,
      reason: 'pass',
      remaining: null,
      used: null,
      limit: null,
      pass: true,
    };
  }
  return {
    allowed: false,
    reason: 'no_pass',
    remaining: 0,
    used: 0,
    limit: 0,
    pass: false,
  };
}
