import { Braces } from "lucide-react";
const identities = new Set([
  "typescript",
  "javascript",
  "nodejs",
  "nestjs",
  "postgresql",
  "git",
  "linux",
  "docker",
]);
export function CourseArtwork({ id }: { id: string }) {
  return (
    <div
      aria-hidden="true"
      className="course-artwork flex items-center justify-center"
    >
      {identities.has(id) ? (
        <img
          src={`/technologies/${id}.svg`}
          alt=""
          className="technology-logo"
          width="80"
          height="80"
        />
      ) : (
        <Braces className="technology-logo text-subtle" strokeWidth={1.2} />
      )}
    </div>
  );
}
