import { Link, NavLink } from "react-router";
import { Insignia } from "./Brand";
export function SiteHeader() {
  return (
    <header className="site-header border-b border-line bg-bunker">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-5 px-4 sm:gap-8 sm:px-8">
        <Link
          to="/"
          aria-label="BunkerCode — Início"
          className="flex shrink-0 items-center gap-1.5 text-base font-semibold tracking-tight text-ink no-underline sm:gap-2 sm:text-xl"
        >
          <Insignia />
          <span>
            Bunker<span className="text-gold">Code</span>
          </span>
        </Link>
        <nav
          aria-label="Navegação principal"
          className="flex h-full items-center gap-4 text-sm sm:gap-6"
        >
          <NavLink
            to="/"
            end
            className="flex h-full items-center border-b-2 border-transparent text-subtle no-underline aria-[current=page]:border-gold aria-[current=page]:text-ink"
          >
            Início
          </NavLink>
          <NavLink
            to="/courses"
            className="flex h-full items-center border-b-2 border-transparent text-subtle no-underline aria-[current=page]:border-gold aria-[current=page]:text-ink"
          >
            Cursos
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
