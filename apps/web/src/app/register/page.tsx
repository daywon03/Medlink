"use client";

import styles from "./page.module.css";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { register } from "../../../lib/auth";



export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);
      await register(email, password);
      router.push("/login?registered=1");
    } catch (err: any) {
      const msg = (err?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        setError("Cette adresse email est déjà utilisée.");
      } else {
        setError(err?.message ?? "Erreur d'inscription.");
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
          <p className={styles.sub}>Rejoindre l'espace Medlink.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-email">Email</label>
            <input
              id="register-email"
              className={styles.input}
              type="email"
              autoComplete="email"
              placeholder="email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-password">Mot de passe</label>
            <input
              id="register-password"
              className={styles.input}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit" disabled={loading}>
              {loading ? "Création..." : "Créer un compte"}
            </button>
          </div>
        </form>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.links}>
          <Link className={styles.link} href="/login">Se connecter</Link>
          <Link className={styles.link} href="/arm">Aller au dashboard</Link>
        </div>
      </div>
    </div>
  );

}
