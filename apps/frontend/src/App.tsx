import { HomePage } from "./product/HomePage";
import { SiteHeader } from "./product/SiteHeader";
import { Component, lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Link, Route, Routes, useLocation } from "react-router";
import { CoursePage, CoursesPage } from "./courses/Pages";
import { Page, ScrollRestoration } from "./courses/Page";
import { ContentStatus } from "./courses/ContentStatus";

const LessonPage = lazy(() =>
  import("./courses/LessonPage").then((module) => ({
    default: module.LessonPage,
  })),
);
const StudioPage = lazy(() =>
  import("./courses/Studio").then((module) => ({ default: module.StudioPage })),
);

class RouteBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <ContentStatus error="Não foi possível carregar esta página. Tente novamente." />
    ) : (
      this.props.children
    );
  }
}
function AppRoutes() {
  const { pathname } = useLocation();
  return (
    <RouteBoundary key={pathname}>
      <Suspense fallback={<ContentStatus error="" />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/courses/:id" element={<CoursePage />} />
          <Route path="/courses/:id/lessons/:slug" element={<LessonPage />} />
          <Route
            path="/courses/:id/lessons/:slug/edit"
            element={<StudioPage />}
          />
          <Route
            path="*"
            element={
              <Page title="Página não encontrada" className="page-width">
                <h1>Página não encontrada</h1>
                <Link to="/courses">Voltar aos cursos</Link>
              </Page>
            }
          />
        </Routes>
      </Suspense>
    </RouteBoundary>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollRestoration />
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          const main = document.getElementById("main-content");
          main?.focus({ preventScroll: true });
          main?.scrollIntoView();
        }}
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <AppRoutes />
    </BrowserRouter>
  );
}
