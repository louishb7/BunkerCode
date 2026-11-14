import { LearningProvider } from "./learning/Learning";
import { AuthPage, RequireSession, SessionBoundary } from "./auth/Auth";
import { HomePage } from "./product/HomePage";
import { SiteHeader, LessonNavigationProvider } from "./product/SiteHeader";
import { Component, lazy, Suspense, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router";
import { CoursePage, CoursesPage } from "./courses/Pages";
import { Page, ScrollRestoration } from "./courses/Page";
import { ContentStatus } from "./courses/ContentStatus";

const LessonPage = lazy(() =>
  import("./courses/LessonPage").then((module) => ({
    default: module.LessonPage,
  })),
);
const StudioPage = __BUNKERCODE_AUTHORING__
  ? lazy(() =>
      import("./courses/Studio").then((module) => ({
        default: module.StudioPage,
      })),
    )
  : undefined;
const SqlAuthoring = __BUNKERCODE_AUTHORING__
  ? lazy(() => import("./sql-lab/SqlAuthoring"))
  : undefined;
const TacticsLab = lazy(() => import("./tactics/TacticsLab"));

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
  const { pathname, search, hash } = useLocation();
  return (
    <RouteBoundary key={pathname}>
      <Suspense fallback={<ContentStatus error="" />}>
        <Routes>
          <Route path="/login" element={<AuthPage key="login" />} />
          <Route
            path="/register"
            element={<AuthPage key="register" register />}
          />
          <Route path="/" element={<HomePage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/tactics" element={<TacticsLab />} />
          {SqlAuthoring && (
            <Route
              path="/studio/sql"
              element={
                <RequireSession admin>
                  <SqlAuthoring />
                </RequireSession>
              }
            />
          )}
          <Route
            path="/sql"
            element={
              <Navigate replace to={{ pathname: "/courses", search, hash }} />
            }
          />
          <Route
            path="/lab/tactics"
            element={
              <Navigate replace to={{ pathname: "/tactics", search, hash }} />
            }
          />
          <Route path="/courses/:id" element={<CoursePage />} />
          <Route path="/courses/:id/lessons/:slug" element={<LessonPage />} />
          {StudioPage && (
            <Route
              path="/courses/:id/lessons/:slug/edit"
              element={
                <RequireSession admin>
                  <StudioPage />
                </RequireSession>
              }
            />
          )}
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
      <SessionBoundary>
        <LearningProvider>
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
          <LessonNavigationProvider>
            <ApplicationShell />
          </LessonNavigationProvider>
        </LearningProvider>
      </SessionBoundary>
    </BrowserRouter>
  );
}

function ApplicationShell() {
  const { pathname } = useLocation();
  const learning = /^\/courses\/[^/]+\/lessons\/[^/]+\/?$/.test(pathname);
  return (
    <div
      className={
        learning
          ? "application-shell entry-surface learning-shell"
          : "application-shell entry-surface"
      }
    >
      <SiteHeader />
      <div className="application-route">
        <AppRoutes />
      </div>
    </div>
  );
}
