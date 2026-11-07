import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../auth/Auth";
import { learningRequest, parseSummary, type LearningSummary } from "./api";
const LearningContext = createContext<{
  summary?: LearningSummary;
  error: string;
  refresh: () => void;
}>({ error: "", refresh: () => {} });
export const useLearning = () => useContext(LearningContext);
export function LearningProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<LearningSummary>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    void learningRequest("", controller.signal)
      .then(parseSummary)
      .then((value) => {
        if (!controller.signal.aborted) {
          setSummary(value);
          setError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("Progresso da conta indisponível.");
      });
    return () => controller.abort();
  }, [user?.id, revision]);
  useEffect(() => {
    window.addEventListener("bunkercode-learning-change", refresh);
    return () =>
      window.removeEventListener("bunkercode-learning-change", refresh);
  }, [refresh]);
  return (
    <LearningContext.Provider value={{ summary, error, refresh }}>
      {children}
    </LearningContext.Provider>
  );
}
