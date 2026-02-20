"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "../../../lib/supabaseClient";
import ArmStyles from "../arm/ui/ArmStyles";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  requireAuth?: boolean;
  hideSidebar?: boolean;
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/arm", label: "Incidents", icon: "📋" },
  { href: "/arm/history", label: "Historique", icon: "📜" },
];

export default function MedlinkLayout({
  title,
  subtitle,
  actions,
  requireAuth = false,
  hideSidebar = false,
  children,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [checking, setChecking] = useState(requireAuth);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!requireAuth) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error || !data.user) {
        router.replace("/login?unauthorized=1");
        return;
      }

      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [requireAuth, router]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled) setUserEmail(data.user?.email ?? null);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (checking) {
    return (
      <div className="medCentered">
        <div className="medMessageCard">
          <div className="medMessageTitle">Vérification…</div>
        </div>
        <ArmStyles />
      </div>
    );
  }

  return (
    <div className="armShell medShell">
      {!hideSidebar && (
        <aside className="medSidebar">
          <div className="medLogoCard">
            <img className="medLogoImg" src="/MedLink_logo.png" alt="MedLink" />
            <div className="medLogoTitle">MedLink</div>
            <div className="medLogoTag">REPENSONS L'URGENCE</div>
          </div>

          <nav className="medNav">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} className={`medNavItem ${isActive ? "active" : ""}`} href={item.href}>
                  <span className="medNavIcon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            {userEmail ? (
              <button className="medNavItem" type="button" onClick={handleLogout}>
                <span className="medNavIcon">🚪</span>
                <span>Déconnexion</span>
              </button>
            ) : (
              <>
                <Link className={`medNavItem ${pathname === "/login" ? "active" : ""}`} href="/login">
                  <span className="medNavIcon">🔐</span>
                  <span>Connexion</span>
                </Link>
                <Link className={`medNavItem ${pathname === "/register" ? "active" : ""}`} href="/register">
                  <span className="medNavIcon">👤</span>
                  <span>Créer un compte</span>
                </Link>
              </>
            )}
          </nav>

          <div className="medSidebarCard">
            <div className="medSidebarTitle">ID agent connecté</div>
            <div className="medSidebarStatus">
              <span className="medPill">{userEmail ?? "Non connecté"}</span>
              <span className="medDot" />
            </div>
          </div>

          <div className="medSidebarCard">
            <div className="medSidebarTitle">Raccourcis</div>
            <div className="medShortcutList">
              <div>• / : focus recherche</div>
              <div>• ⬆︎⬇︎ : sélectionner</div>
              <div>• Entrée : ouvrir détails</div>
            </div>
          </div>
        </aside>
      )}

      <div className={`medContent ${hideSidebar ? "medContentFull" : ""}`}>
        <header className="medTopbar">
          <div className="medTopTitle">
            <div className="medPageTitle">{title}</div>
            {subtitle && <div className="medPageSub">{subtitle}</div>}
          </div>
          {actions && <div className="medTopActions">{actions}</div>}
        </header>

        <main className="medMain">{children}</main>
      </div>
      <ArmStyles />
    </div>
  );
}
