/**
 * RAG: embeddings + ragChunks for bedriftens eget innhold (utlyste stillinger + stillingsbibliotek).
 * Brukes når /api/ai kalles med action jobPosting og OPENAI_API_KEY/EMBEDDINGS_API_KEY er satt.
 */

const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small';
const RAG_TOP_K = Math.min(8, Math.max(1, parseInt(process.env.RAG_TOP_K || '4', 10) || 4));
const SYNC_COOLDOWN_MS = Math.max(
  60_000,
  parseInt(process.env.RAG_SYNC_COOLDOWN_MS || String(10 * 60_000), 10) || 600_000,
);

export function getEmbeddingsApiKey() {
  return (process.env.OPENAI_API_KEY || process.env.EMBEDDINGS_API_KEY || '').trim();
}

function ownerKey(ownerType, uid) {
  return `${ownerType}_${uid}`;
}

function chunkText(text, maxChars = 900) {
  const t = String(text || '').trim();
  if (!t) return [];
  const parts = t.split(/\n\n+/);
  const chunks = [];
  let cur = '';
  for (const p of parts) {
    const s = p.trim();
    if (!s) continue;
    if ((cur + '\n\n' + s).length > maxChars && cur) {
      chunks.push(cur.trim());
      cur = s;
    } else {
      cur = cur ? `${cur}\n\n${s}` : s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  if (chunks.length === 0 && t) return [t.slice(0, maxChars * 2)];
  return chunks.map((c) => c.slice(0, maxChars * 2));
}

async function fetchEmbedding(apiKey, input) {
  const res = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: String(input).slice(0, 8000),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || 'Embedding-API feilet');
  }
  const vec = data?.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error('Tomt embedding-svar');
  return vec;
}

function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

async function loadChunks(db, ok) {
  const snap = await db.collection('ragChunks').where('ownerKey', '==', ok).get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        text: x.text,
        embedding: x.embedding,
        sourceKey: x.sourceKey,
      };
    })
    .filter((x) => x.text && Array.isArray(x.embedding) && x.embedding.length > 0);
}

export async function retrieveRagContext(db, { ownerType, uid, queryText, embedApiKey }) {
  if (!embedApiKey || !queryText?.trim()) return '';
  const ok = ownerKey(ownerType, uid);
  const chunks = await loadChunks(db, ok);
  if (chunks.length === 0) return '';

  let qVec;
  try {
    qVec = await fetchEmbedding(embedApiKey, queryText);
  } catch (e) {
    console.warn('RAG retrieve embed:', e.message);
    return '';
  }

  const scored = chunks
    .map((c) => ({ ...c, score: cosineSimilarity(qVec, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, RAG_TOP_K);

  return scored.map((s, i) => `--- Utdrag ${i + 1} ---\n${s.text}`).join('\n\n');
}

async function shouldSkipSync(db, uid, field) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const t = snap.data()?.[field];
  if (!t?.toMillis) return false;
  return Date.now() - t.toMillis() < SYNC_COOLDOWN_MS;
}

async function markSynced(db, uid, field) {
  await db.collection('users').doc(uid).set(
    { [field]: new Date() },
    { merge: true },
  );
}

export async function syncCompanyCorpus(db, companyId, embedApiKey) {
  if (!embedApiKey) return;
  const field = 'ragCompanySyncedAt';
  if (await shouldSkipSync(db, companyId, field)) return;

  const jobsSnap = await db
    .collection('jobs')
    .where('companyId', '==', companyId)
    .limit(40)
    .get();

  const ok = ownerKey('company', companyId);
  const batchDeletes = [];
  const existingSnap = await db.collection('ragChunks').where('ownerKey', '==', ok).get();
  existingSnap.docs.forEach((d) => batchDeletes.push(d.ref.delete()));

  await Promise.all(batchDeletes);

  let written = 0;

  async function writeChunks(sourcePrefix, docId, titleLine, bodyText, minLen = 80) {
    const desc = String(bodyText || '').trim();
    if (desc.length < minLen) return;
    const title = String(titleLine || '');
    const pieces = chunkText(`${title}\n\n${desc}`);
    let i = 0;
    for (const text of pieces) {
      const sourceKey = `${sourcePrefix}_${docId}_${i++}`;
      try {
        const embedding = await fetchEmbedding(embedApiKey, text);
        await db
          .collection('ragChunks')
          .doc(`${ok}_${sourceKey}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 450))
          .set({
            ownerKey: ok,
            ownerType: 'company',
            ownerId: companyId,
            sourceKey,
            text,
            embedding,
            updatedAt: new Date(),
          });
        written += 1;
      } catch (e) {
        console.warn('RAG sync company chunk:', e.message);
      }
    }
  }

  for (const doc of jobsSnap.docs) {
    const job = doc.data();
    await writeChunks('job', doc.id, job.title || '', job.description || '', 80);
  }

  const libSnap = await db
    .collection('companyJobLibrary')
    .where('companyId', '==', companyId)
    .limit(50)
    .get();

  for (const doc of libSnap.docs) {
    const row = doc.data();
    await writeChunks('lib', doc.id, row.title || '', row.description || '', 40);
  }

  await markSynced(db, companyId, field);
  console.info(`RAG company ${companyId}: ${written} chunks (jobs + bibliotek)`);
}

export async function buildRagContextForAction(db, { uid, action, payload, embedApiKey }) {
  if (!embedApiKey || action !== 'jobPosting') return '';

  try {
    await syncCompanyCorpus(db, uid, embedApiKey);
    const q = [
      payload.title,
      payload.keywords,
      payload.company,
      payload.location,
      payload.companyAbout && String(payload.companyAbout).slice(0, 1200),
    ]
      .filter(Boolean)
      .join(' | ');
    return await retrieveRagContext(db, {
      ownerType: 'company',
      uid,
      queryText: q || payload.title || 'stillingsannonse',
      embedApiKey,
    });
  } catch (e) {
    console.warn('buildRagContextForAction:', e.message);
  }
  return '';
}
