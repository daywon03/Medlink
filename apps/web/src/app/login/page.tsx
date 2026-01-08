"use client";

import styles from "./page.module.css";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "../../../lib/auth";


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      await login(email, password);
      router.push("/arm");
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
   
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Connexion</h1>
          <p className={styles.sub}>Accéder à votre espace Medlink.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Email</label>
            <input className={styles.input} type="email" placeholder="email@exemple.com" />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Mot de passe</label>
            <input className={styles.input} type="password" placeholder="••••••••" />
          </div>

          <div className={styles.actions}>
            <button className={styles.button} type="submit">Se connecter</button>
          </div>
        </form>

        {/* {error && <div className={styles.error}>{error}</div>} */}

        <div className={styles.links}>
          <Link className={styles.link} href="/register">Créer un compte</Link>
          <Link className={styles.link} href="/arm">Aller au dashboard</Link>
        </div>
      </div>
    </div>
  );

}
