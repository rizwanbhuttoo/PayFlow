import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useNavigate, useSearchParams } from "../../lib/router";
import { CheckCircle2, LoaderCircle, MailCheck } from "lucide-react";
import { AuthShell } from "../../components/AuthShell";
import { Notice } from "../../components/ui";
import { api, jsonOptions } from "../../lib/api";
import { useAuth } from "../../context/useAuth";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = params.get("token") || location.state?.token;
  const started = useRef(false);
  const [status, setStatus] = useState(token ? "working" : "waiting");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api("/auth/verify-email", jsonOptions("POST", { token }))
      .then((data) => {
        login(data);
        setStatus("done");
        setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
      })
      .catch((reason) => { setError(reason.message); setStatus("error"); });
  }, [token, login, navigate]);

  return (
    <AuthShell eyebrow="Email verification" title="Check your inbox" description={`We sent a verification link${location.state?.email ? ` to ${location.state.email}` : ""}.`}>
      {status === "working" ? <div className="card flex items-center gap-3 p-5"><LoaderCircle className="animate-spin text-brand-500" /> Verifying your email…</div> : null}
      {status === "done" ? <Notice type="success"><span className="flex items-center gap-2"><CheckCircle2 size={17} /> Verified. Opening your dashboard…</span></Notice> : null}
      {status === "error" ? <Notice>{error}</Notice> : null}
      {status === "waiting" ? (
        <div className="card p-6 text-center">
          <MailCheck className="mx-auto text-brand-500" size={34} />
          <p className="mt-3 text-sm leading-6 text-muted">Open the email from PayFlow and select “Verify email”. The link expires in 24 hours.</p>
        </div>
      ) : null}
      <p className="mt-6 text-center text-sm text-muted">Already verified? <Link to="/login" className="font-bold text-brand-600">Sign in</Link></p>
    </AuthShell>
  );
}
