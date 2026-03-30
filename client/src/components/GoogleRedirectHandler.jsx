// Fullfører Google signInWithRedirect: naviger etter retur fra Google (viktig på Netlify)

import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getRedirectResult } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function GoogleRedirectHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname.startsWith("/admin")) {
      return;
    }

    let cancelled = false;

    getRedirectResult(auth)
      .then(async (result) => {
        if (cancelled || !result?.user) return;

        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        if (!userDoc.exists()) {
          navigate("/register?social=true", { replace: true });
          return;
        }
        const userType = userDoc.data().userType;
        navigate(
          userType === "company" ? "/dashboard/company" : "/dashboard/user",
          { replace: true },
        );
      })
      .catch((e) => {
        console.warn("getRedirectResult:", e);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, location.pathname]);

  return null;
}
