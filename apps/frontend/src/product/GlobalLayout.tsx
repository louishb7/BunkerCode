import type { ReactNode } from "react";
import { BookOpen, House, ScanSearch } from "lucide-react";
import { Link, NavLink } from "react-router";
import { Insignia } from "./Brand";
import "./global-layout.css";

const destinations = [
  { to: "/", label: "Início", icon: House },
  { to: "/courses", label: "Cursos", icon: BookOpen },
  { to: "/tactics", label: "Táticas", icon: ScanSearch },
];

export function GlobalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="global-layout">
      <aside className="global-sidebar" aria-label="Navegação da plataforma">
        <Link className="global-brand" to="/" aria-label="BunkerCode — Início">
          <Insignia />
          <span>
            Bunker<span className="text-gold">Code</span>
          </span>
        </Link>
        <nav className="global-nav" aria-label="Navegação principal">
          {destinations.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className="global-nav-link"
            >
              <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="global-content">{children}</div>
    </div>
  );
}
