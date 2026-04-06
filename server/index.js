import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import dotenv from 'dotenv';
import {
  getAiQuotaStatus,
  handleAiAction,
  resolveLlmConfig,
} from './aiHandler.js';
import { buildRagContextForAction, getEmbeddingsApiKey } from './rag.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : null;

if (serviceAccount) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
} else {
  console.warn('Firebase Admin SDK not initialized - missing service account credentials');
}

const db = serviceAccount ? admin.firestore() : null;

function getLlmConfig() {
  return resolveLlmConfig();
}

async function requireUser(req, res, next) {
  if (!serviceAccount) {
    res.status(503).json({
      error: 'Firebase Admin er ikke konfigurert – AI-endepunktet er utilgjengelig',
    });
    return;
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: 'Mangler innlogging (Bearer token)' });
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (e) {
    console.error('verifyIdToken:', e.message);
    res.status(401).json({ error: 'Ugyldig eller utløpt sesjon' });
  }
}

async function requireCompanyForAi(req, res, next) {
  if (!db) {
    res.status(503).json({ error: 'Database ikke konfigurert' });
    return;
  }
  try {
    const snap = await db.collection('users').doc(req.uid).get();
    const d = snap.exists ? snap.data() : {};
    if (d.userType !== 'company') {
      res.status(403).json({
        error: 'ai_company_only',
        message: 'Sky-AI er kun for bedriftskontoer. Privatpersoner bruker lokale maler.',
      });
      return;
    }
    next();
  } catch (e) {
    console.error('requireCompanyForAi:', e);
    res.status(500).json({ error: 'Kunne ikke verifisere bruker' });
  }
}

const COMPANY_AI_ACTIONS = ['jobPosting', 'rankApplicants'];

// AI: bedrift med aiPass + LLM; valgfri RAG (embeddings) fra utlyste stillinger + stillingsbibliotek ved jobPosting
app.get('/api/ai/status', requireUser, requireCompanyForAi, async (req, res) => {
  try {
    const status = await getAiQuotaStatus(db, req.uid);
    const llm = getLlmConfig();
    res.json({
      ...status,
      role: 'company',
      llmConfigured: Boolean(llm.apiKey && llm.baseUrl),
    });
  } catch (e) {
    console.error('ai/status:', e);
    res.status(500).json({ error: 'Kunne ikke hente AI-status' });
  }
});

app.post('/api/ai', requireUser, requireCompanyForAi, async (req, res) => {
  try {
    const llm = getLlmConfig();
    if (!llm.apiKey || !llm.baseUrl) {
      return res.status(503).json({
        error:
          'LLM er ikke konfigurert. Sett LLM_API_KEY + LLM_BASE_URL (eller GROQ_API_KEY for Groq) på serveren.',
      });
    }

    const { action, payload } = req.body || {};
    if (!action) {
      return res.status(400).json({ error: 'Mangler action' });
    }

    if (!COMPANY_AI_ACTIONS.includes(action)) {
      return res.status(400).json({ error: 'Ukjent handling' });
    }

    const quota = await getAiQuotaStatus(db, req.uid);
    if (!quota.allowed) {
      return res.status(402).json({
        error: 'ai_no_access',
        message:
          'AI krever aktiv tilgang (betaling eller administrator). Det finnes ingen gratis prøverunder.',
        ...quota,
      });
    }

    const embedKey = getEmbeddingsApiKey();
    const ragContext = await buildRagContextForAction(db, {
      uid: req.uid,
      action,
      payload: payload || {},
      embedApiKey: embedKey,
    });

    const mergedPayload = { ...(payload || {}), ragContext };
    const result = await handleAiAction({ action, payload: mergedPayload }, llm);

    const nextQuota = await getAiQuotaStatus(db, req.uid);
    res.json({ ...result, quota: nextQuota, ragUsed: Boolean(ragContext?.trim()) });
  } catch (e) {
    const status = e.status || 500;
    console.error('api/ai:', e);
    res.status(status).json({
      error: e.message || 'AI-kall feilet',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Example: Get all items from a collection
app.get('/api/items', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    const snapshot = await db.collection('items').get();
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Example: Add a new item
app.post('/api/items', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    const { name, description } = req.body;
    const docRef = await db.collection('items').add({
      name,
      description,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.status(201).json({ id: docRef.id, name, description });
  } catch (error) {
    console.error('Error adding item:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Example: Delete an item
app.delete('/api/items/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    await db.collection('items').doc(req.params.id).delete();
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
