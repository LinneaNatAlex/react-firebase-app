import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

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
