import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { db } from "../firebase";
import { searchCompaniesByPrefix, searchJobseekersByPrefix } from "../services/navSearch";
import "../styles/SearchPage.css";

const FILTER_ALL = "all";
const FILTER_COMPANY = "bedrift";
const FILTER_PERSON = "person";

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const qParam = searchParams.get("q") || "";
  const typeParam = searchParams.get("type") || "";

  const [filter, setFilter] = useState(() => {
    if (typeParam === FILTER_COMPANY) return FILTER_COMPANY;
    if (typeParam === FILTER_PERSON) return FILTER_PERSON;
    return FILTER_ALL;
  });
  const [companies, setCompanies] = useState([]);
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeParam === FILTER_COMPANY) setFilter(FILTER_COMPANY);
    else if (typeParam === FILTER_PERSON) setFilter(FILTER_PERSON);
    else if (!typeParam) setFilter(FILTER_ALL);
  }, [typeParam]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const q = qParam.trim();
      if (q.length < 2) {
        setCompanies([]);
        setPeople([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const wantCo = filter === FILTER_ALL || filter === FILTER_COMPANY;
      const wantPe = filter === FILTER_ALL || filter === FILTER_PERSON;
      const [co, pe] = await Promise.all([
        wantCo ? searchCompaniesByPrefix(db, q) : Promise.resolve([]),
        wantPe ? searchJobseekersByPrefix(db, q) : Promise.resolve([]),
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
  }, [qParam, filter]);

  function applyFilter(next) {
    setFilter(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === FILTER_ALL) nextParams.delete("type");
    else if (next === FILTER_COMPANY) nextParams.set("type", FILTER_COMPANY);
    else nextParams.set("type", FILTER_PERSON);
    setSearchParams(nextParams);
  }

  const hasResults = companies.length > 0 || people.length > 0;

  return (
    <div className="search-page">
      <header className="search-page-header">
        <h1>Søk</h1>
        {qParam.trim().length >= 2 ? (
          <p className="search-page-sub">
            Resultater for «{qParam.trim()}»
          </p>
        ) : (
          <p className="search-page-sub">Skriv minst to tegn i søkefeltet i menyen.</p>
        )}
      </header>

      <div className="search-page-filters" role="group" aria-label="Søkefilter">
        <button
          type="button"
          className={`search-page-chip ${filter === FILTER_ALL ? "is-active" : ""}`}
          onClick={() => applyFilter(FILTER_ALL)}
        >
          Alle
        </button>
        <button
          type="button"
          className={`search-page-chip ${filter === FILTER_COMPANY ? "is-active" : ""}`}
          onClick={() => applyFilter(FILTER_COMPANY)}
        >
          Bedrift
        </button>
        <button
          type="button"
          className={`search-page-chip ${filter === FILTER_PERSON ? "is-active" : ""}`}
          onClick={() => applyFilter(FILTER_PERSON)}
        >
          Person
        </button>
      </div>

      {loading && qParam.trim().length >= 2 && (
        <p className="search-page-muted">Laster treff…</p>
      )}

      {!loading && qParam.trim().length >= 2 && !hasResults && (
        <p className="search-page-muted">Ingen treff.</p>
      )}

      {(filter === FILTER_ALL || filter === FILTER_COMPANY) && companies.length > 0 && (
        <section className="search-page-block">
          <h2 className="search-page-block-title">Bedrifter</h2>
          <ul className="search-page-list">
            {companies.map((c) => (
              <li key={c.id}>
                <Link to={`/bedrift/${c.id}`} className="search-page-card">
                  <span className="search-page-card-title">{c.companyName}</span>
                  {c.industry ? (
                    <span className="search-page-card-meta">{c.industry}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(filter === FILTER_ALL || filter === FILTER_PERSON) && people.length > 0 && (
        <section className="search-page-block">
          <h2 className="search-page-block-title">Personer</h2>
          <ul className="search-page-list">
            {people.map((p) => (
              <li key={p.id}>
                <Link to={`/profil/${p.id}`} className="search-page-card">
                  <span className="search-page-card-title">{p.displayLabel}</span>
                  <span className="search-page-card-meta">Jobbsøker</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
