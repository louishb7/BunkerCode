import type { Attempt, Draft, LearningActivity } from "./types";
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/learning${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-bunkercode-client": "local",
          },
          body: JSON.stringify(body),
        },
  );
  const value = await response.json();
  if (!response.ok) throw new Error(value.message ?? `HTTP ${response.status}`);
  return value as T;
}
export const learningApi = {
  activities: () => request<LearningActivity[]>("/activities"),
  activity: (id: string) =>
    request<LearningActivity>(`/activities/${encodeURIComponent(id)}`),
  create: (activityId: string) => request<Attempt>("/attempts", { activityId }),
  attempt: (id: string) =>
    request<Attempt>(`/attempts/${encodeURIComponent(id)}`),
  save: (attempt: Attempt, draft: Draft) =>
    request<Attempt>(`/attempts/${attempt.id}/draft`, {
      revision: attempt.revision,
      draft,
    }),
  submit: (attempt: Attempt) =>
    request<Attempt>(`/attempts/${attempt.id}/submissions`, {
      revision: attempt.revision,
    }),
  complete: (attempt: Attempt, reflection: string) =>
    request<Attempt>(`/attempts/${attempt.id}/completion`, {
      revision: attempt.revision,
      reflection,
    }),
};
