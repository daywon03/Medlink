"use client";

import styles from "./page.module.css";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "../../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const justRegistered = searchParams.get("registered") === "1";
  const unauthorized = searchParams.get("unauthorized") === "1";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      router.push("/arm");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("Invalid login")) {
        setError("Email ou mot de passe incorrect.");
      } else if (message.includes("Email not confirmed")) {
        setError("Veuillez confirmer votre email avant de vous connecter.");
      } else {
        setError(message || "Erreur de connexion. Réessayez.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logoWrap}>
          <img className={styles.logo} src="/MedLink_logo.png" alt="MedLink" />
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>Connexion</h1>
          <p className={styles.sub}>Accédez à votre espace de régulation MedLink</p>
        </div>

        {justRegistered && (
          <div className={styles.notice}>
            ✅ Compte créé avec succès ! Vous pouvez maintenant vous connecter.
          </div>
        )}
        {unauthorized && (
          <div className={styles.notice}>
            🔒 Connexion requise pour accéder à cette page.
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">
              Adresse email
            </label>
            <input
              id="login-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              placeholder="nom@hopital.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">
              Mot de passe
            </label>
            <input
              id="login-password"
              className={styles.input}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "Connexion en cours…" : "Se connecter"}
            </button>
          </div>
        </form>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.links}>
          <Link className={styles.link} href="/register">
            Créer un compte
          </Link>
        </div>
      </div>
    </div>
  );
}
