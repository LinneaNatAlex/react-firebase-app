import { useState, useEffect } from 'react'
import { db } from './firebase'
import { collection, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore'
import './App.css'

function App() {
  const [items, setItems] = useState([])
  const [newItem, setNewItem] = useState({ name: '', description: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchItems = async () => {
    try {
      setLoading(true)
      const querySnapshot = await getDocs(collection(db, 'items'))
      const itemsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setItems(itemsList)
      setError(null)
    } catch (err) {
      console.error('Error fetching items:', err)
      setError('Kunne ikke hente data. Sjekk Firebase-konfigurasjonen.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const handleAddItem = async (e) => {
    e.preventDefault()
    if (!newItem.name.trim()) return

    try {
      await addDoc(collection(db, 'items'), {
        name: newItem.name,
        description: newItem.description,
        createdAt: new Date()
      })
      setNewItem({ name: '', description: '' })
      fetchItems()
    } catch (err) {
      console.error('Error adding item:', err)
      setError('Kunne ikke legge til element.')
    }
  }

  const handleDeleteItem = async (id) => {
    try {
      await deleteDoc(doc(db, 'items', id))
      fetchItems()
    } catch (err) {
      console.error('Error deleting item:', err)
      setError('Kunne ikke slette element.')
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>React + Firebase App</h1>
        <p>Koblet til Firestore Database</p>
      </header>

      <main className="main">
        <section className="add-section">
          <h2>Legg til nytt element</h2>
          <form onSubmit={handleAddItem} className="add-form">
            <input
              type="text"
              placeholder="Navn"
              value={newItem.name}
              onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
              className="input"
            />
            <input
              type="text"
              placeholder="Beskrivelse"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              className="input"
            />
            <button type="submit" className="btn btn-primary">
              Legg til
            </button>
          </form>
        </section>

        {error && <div className="error">{error}</div>}

        <section className="items-section">
          <h2>Elementer fra database</h2>
          {loading ? (
            <p className="loading">Laster...</p>
          ) : items.length === 0 ? (
            <p className="empty">Ingen elementer funnet. Legg til noe ovenfor!</p>
          ) : (
            <ul className="items-list">
              {items.map((item) => (
                <li key={item.id} className="item">
                  <div className="item-content">
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="btn btn-danger"
                  >
                    Slett
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>React + Vite + Node.js + Firebase</p>
      </footer>
    </div>
  )
}

export default App
