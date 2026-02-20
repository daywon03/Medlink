"use client";

import styles from "../login/page.module.css";
import Link from "next/link";
import { useState, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { register } from "../../../lib/auth";

function getPasswordStrength(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  return Math.min(4, score);
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const strengthLabel = ["", "Faible", "Moyen", "Bon", "Fort"][strength];
  const strengthClass = strength <= 1 ? "" : strength === 2 ? styles.medium : styles.strong;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    try {
      setLoading(true);
      await register(email, password);
      router.push("/login?registered=1");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("already") || msg.includes("registered")) {
        setError("Cette adresse email est déjà utilisée.");
      } else if (msg.includes("password")) {
        setError("Le mot de passe ne respecte pas les critères de sécurité.");
      } else {
        setError(msg || "Erreur lors de l'inscription. Réessayez.");
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
          <h1 className={styles.title}>Créer un compte</h1>
          <p className={styles.sub}>Rejoignez l'espace de régulation MedLink</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-email">
              Adresse email
            </label>
            <input
              id="register-email"
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
            <label className={styles.label} htmlFor="register-password">
              Mot de passe
            </label>
            <input
              id="register-password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              placeholder="Minimum 6 caractères"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            {password && (
              <>
                <div className={styles.passwordStrength}>
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`${styles.strengthBar} ${i <= strength ? `${styles.active} ${strengthClass}` : ""}`}
                    />
                  ))}
                </div>
                <div className={styles.strengthHint}>
                  Force : {strengthLabel}
                </div>
              </>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-confirm">
              Confirmer le mot de passe
            </label>
            <input
              id="register-confirm"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              placeholder="Retapez le mot de passe"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "Création en cours…" : "Créer mon compte"}
            </button>
          </div>
        </form>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.links}>
          <Link className={styles.link} href="/login">
            Déjà un compte ? Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
