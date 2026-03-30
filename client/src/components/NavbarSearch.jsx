import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { searchCompaniesByPrefix, searchJobseekersByPrefix } from "../services/navSearch";

/** @type {'all' | 'company' | 'person'} */
const FILTER_ALL = "all";
const FILTER_COMPANY = "company";
const FILTER_PERSON = "person";

function useDebounced(value, delay) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function NavbarSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(FILTER_ALL);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [people, setPeople] = useState([]);
  const debounced = useDebounced(query.trim(), 280);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (debounced.length < 2) {
        setCompanies([]);
        setPeople([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const wantCo = filter === FILTER_ALL || filter === FILTER_COMPANY;
      const wantPe = filter === FILTER_ALL || filter === FILTER_PERSON;
      const [co, pe] = await Promise.all([
        wantCo ? searchCompaniesByPrefix(db, debounced) : Promise.resolve([]),
        wantPe ? searchJobseekersByPrefix(db, debounced) : Promise.resolve([]),
      ]);
      if (!cancelled) {
        setCompanies(co);
        setPeople(pe);
        setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [debounced, filter]);

  function submitSearch(e) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setOpen(false);
    const type =
      filter === FILTER_COMPANY ? "bedrift" : filter === FILTER_PERSON ? "person" : "";
    navigate(`/sok?q=${encodeURIComponent(q)}${type ? `&type=${type}` : ""}`);
  }

  const showCompanies = filter === FILTER_ALL || filter === FILTER_COMPANY;
  const showPeople = filter === FILTER_ALL || filter === FILTER_PERSON;
  const hasResults =
    (showCompanies && companies.length > 0) || (showPeople && people.length > 0);

  return (
    <div className="navbar-search" ref={wrapRef}>
      <form className="navbar-search-form" onSubmit={submitSearch} role="search">
        <label htmlFor="navbar-search-input" className="visually-hidden">
          Søk etter bedrift eller person
        </label>
        <input
          id="navbar-search-input"
          type="search"
          className="navbar-search-input"
          placeholder="Søk bedrift eller person…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        <button type="submit" className="navbar-search-submit" aria-label="Søk">
          Søk
        </button>
      </form>

      {open && (
        <div className="navbar-search-dropdown" role="listbox">
          <div className="navbar-search-filters" role="group" aria-label="Søkefilter">
            <button
              type="button"
              className={`navbar-search-chip ${filter === FILTER_ALL ? "is-active" : ""}`}
              onClick={() => setFilter(FILTER_ALL)}
            >
              Alle
            </button>
            <button
              type="button"
              className={`navbar-search-chip ${filter === FILTER_COMPANY ? "is-active" : ""}`}
              onClick={() => setFilter(FILTER_COMPANY)}
            >
              Bedrift
            </button>
            <button
              type="button"
              className={`navbar-search-chip ${filter === FILTER_PERSON ? "is-active" : ""}`}
              onClick={() => setFilter(FILTER_PERSON)}
            >
              Person
            </button>
          </div>

          {query.trim().length > 0 && query.trim().length < 2 && (
            <p className="navbar-search-hint">Skriv minst to tegn for å søke.</p>
          )}

          {loading && debounced.length >= 2 && (
            <p className="navbar-search-hint">Søker…</p>
          )}

          {!loading && debounced.length >= 2 && !hasResults && (
            <p className="navbar-search-hint">Ingen treff. Prøv et annet søkeord.</p>
          )}

          {showCompanies && companies.length > 0 && (
            <div className="navbar-search-section">
              <span className="navbar-search-section-label">Bedrifter</span>
              <ul className="navbar-search-list">
                {companies.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/bedrift/${c.id}`}
                      className="navbar-search-item"
                      onClick={() => setOpen(false)}
                    >
                      <span className="navbar-search-item-title">{c.companyName}</span>
                      {c.industry ? (
                        <span className="navbar-search-item-meta">{c.industry}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {showPeople && people.length > 0 && (
            <div className="navbar-search-section">
              <span className="navbar-search-section-label">Personer</span>
              <ul className="navbar-search-list">
                {people.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/profil/${p.id}`}
                      className="navbar-search-item"
                      onClick={() => setOpen(false)}
                    >
                      <span className="navbar-search-item-title">{p.displayLabel}</span>
                      <span className="navbar-search-item-meta">Jobbsøker</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasResults && (
            <button type="button" className="navbar-search-see-all" onClick={submitSearch}>
              Se alle treff på søkesiden →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
