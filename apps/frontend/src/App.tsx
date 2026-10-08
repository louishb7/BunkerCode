import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
} from "react-router";
import { Learning } from "./learning/Learning";
import { CoursePage, CoursesPage, LessonPage } from "./courses/Pages";
import { StudioPage } from "./courses/Studio";

export function App() {
  return (
    <BrowserRouter>
      <header className="site-header">
        <Link className="brand" to="/courses">
          <span aria-hidden="true">▰</span> BunkerCode
        </Link>
        <nav aria-label="Navegação principal">
          <NavLink to="/courses">Cursos</NavLink>
          <NavLink to="/learn">Exercícios</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<Navigate to="/courses" replace />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:id" element={<CoursePage />} />
        <Route path="/courses/:id/lessons/:slug" element={<LessonPage />} />
        <Route
          path="/courses/:id/lessons/:slug/edit"
          element={<StudioPage />}
        />
        <Route path="/learn/*" element={<Learning />} />
        <Route
          path="*"
          element={
            <main className="page-width">
              <h1>Página não encontrada</h1>
              <Link to="/courses">Voltar aos cursos</Link>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
