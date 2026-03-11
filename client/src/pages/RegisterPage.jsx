// Registreringsside - bruker velger først kontotype, deretter fyller ut skjema

import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Auth.css";

function RegisterPage() {
  const { register, loginWithGoogle, completeSocialSignup, currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Sjekk om bruker kom fra sosial innlogging
  const isSocialSignup = searchParams.get("social") === "true";

  // Brukertype: 'company' eller 'jobseeker' (eller null hvis ikke valgt ennå)
  const [userType, setUserType] = useState(searchParams.get("type") || null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
    orgNumber: "",
    contactPerson: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  }

  // Google-registrering
  async function handleGoogleSignup() {
    try {
      setError("");
      setLoading(true);
      
      const result = await loginWithGoogle();
      
      if (!result.isNewUser) {
        navigate("/dashboard/company");
      }
      // Ny bruker - siden viser automatisk brukertype-valg
    } catch (error) {
      console.error("Google registrering feilet:", error);
      if (error.code === "auth/popup-closed-by-user") {
        setError("Registrering avbrutt");
      } else {
        setError("Kunne ikke registrere med Google. Prøv igjen.");
      }
    }
    setLoading(false);
  }

  // Fullfør sosial registrering med valgt brukertype
  async function handleCompleteSocialSignup(selectedType) {
    try {
      setError("");
      setLoading(true);
      
      let additionalData = {};
      if (selectedType === "company") {
        additionalData = { companyName: currentUser?.displayName || "Min bedrift" };
      } else {
        const nameParts = (currentUser?.displayName || "").split(" ");
        additionalData = {
          firstName: nameParts[0] || "",
          lastName: nameParts.slice(1).join(" ") || "",
        };
      }
      
      await completeSocialSignup(selectedType, additionalData);
      
      if (selectedType === "company") {
        navigate("/dashboard/company");
      } else {
        navigate("/dashboard/user");
      }
    } catch (error) {
      console.error("Feil ved fullføring:", error);
      setError("Kunne ikke fullføre registrering");
    }
    setLoading(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      return setError("Passordene matcher ikke");
    }

    if (formData.password.length < 6) {
      return setError("Passordet må være minst 6 tegn");
    }

    try {
      setError("");
      setLoading(true);

      let additionalData = {};

      if (userType === "company") {
        additionalData = {
          companyName: formData.companyName,
          orgNumber: formData.orgNumber,
          contactPerson: formData.contactPerson,
        };
      } else {
        additionalData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
        };
      }

      await register(formData.email, formData.password, userType, additionalData);

      if (userType === "company") {
        navigate("/dashboard/company");
      } else {
        navigate("/dashboard/user");
      }
    } catch (error) {
      console.error("Registreringsfeil:", error);

      if (error.code === "auth/email-already-in-use") {
        setError("Denne e-postadressen er allerede registrert");
      } else if (error.code === "auth/invalid-email") {
        setError("Ugyldig e-postadresse");
      } else {
        setError("Kunne ikke opprette konto. Prøv igjen.");
      }
    }

    setLoading(false);
  }

  // Steg 1: Velg kontotype
  if (!userType) {
    return (
      <div className="auth-page">
        <div className="auth-container type-selection">
          <h1>{isSocialSignup || currentUser ? "Velg kontotype" : "Opprett konto"}</h1>
          <p className="auth-subtitle">
            {isSocialSignup || currentUser
              ? "Siste steg - hva beskriver deg best?"
              : "Velg kontotype for å komme i gang"}
          </p>

          {error && <div className="auth-error">{error}</div>}

          <div className="type-cards">
            <button
              className="type-card"
              onClick={() =>
                isSocialSignup || currentUser
                  ? handleCompleteSocialSignup("company")
                  : setUserType("company")
              }
              disabled={loading}
            >
              <span className="type-icon">🏢</span>
              <h3>Bedrift</h3>
              <p>Jeg vil rekruttere ansatte</p>
              <ul>
                <li>Publiser stillingsannonser</li>
                <li>AI-rangering av søkere</li>
                <li>Administrer rekruttering</li>
              </ul>
            </button>

            <button
              className="type-card"
              onClick={() =>
                isSocialSignup || currentUser
                  ? handleCompleteSocialSignup("jobseeker")
                  : setUserType("jobseeker")
              }
              disabled={loading}
            >
              <span className="type-icon">👤</span>
              <h3>Jobbsøker</h3>
              <p>Jeg leter etter jobb</p>
              <ul>
                <li>Søk på stillinger</li>
                <li>Last opp CV</li>
                <li>Følg dine søknader</li>
              </ul>
            </button>
          </div>

          {/* Google-registrering */}
          {!isSocialSignup && !currentUser && (
            <>
              <div className="auth-divider">
                <span>eller</span>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignup}
                className="social-button google full-width"
                disabled={loading}
              >
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                  <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                  <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                </svg>
                Fortsett med Google
              </button>
            </>
          )}

          <p className="auth-footer">
            Har du allerede konto? <Link to="/login">Logg inn</Link>
          </p>
        </div>
      </div>
    );
  }

  // Steg 2: Fyll ut registreringsskjema
  return (
    <div className="auth-page">
      <div className="auth-container">
        <button className="back-button" onClick={() => setUserType(null)}>
          ← Tilbake til valg
        </button>

        <h1>
          {userType === "company" ? "🏢 Registrer bedrift" : "👤 Opprett profil"}
        </h1>
        <p className="auth-subtitle">
          {userType === "company"
            ? "Start å rekruttere de beste kandidatene"
            : "Finn din drømmejobb"}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {userType === "company" && (
            <>
              <div className="form-group">
                <label htmlFor="companyName">Bedriftsnavn *</label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Skriv inn bedriftsnavn"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="orgNumber">Organisasjonsnummer</label>
                <input
                  type="text"
                  id="orgNumber"
                  name="orgNumber"
                  value={formData.orgNumber}
                  onChange={handleChange}
                  placeholder="9 siffer"
                />
              </div>

              <div className="form-group">
                <label htmlFor="contactPerson">Kontaktperson *</label>
                <input
                  type="text"
                  id="contactPerson"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="Fullt navn"
                  required
                />
              </div>
            </>
          )}

          {userType === "jobseeker" && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">Fornavn *</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Fornavn"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">Etternavn *</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Etternavn"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="phone">Telefonnummer</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+47 XXX XX XXX"
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="email">E-post *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="din@epost.no"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Passord *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minst 6 tegn"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Bekreft passord *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Skriv passordet på nytt"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={loading}>
            {loading ? "Oppretter konto..." : "Opprett konto"}
          </button>
        </form>

        <p className="auth-footer">
          Har du allerede konto? <Link to="/login">Logg inn</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
