import { Braces } from "lucide-react";
// Technology identity is optional. Unknown course IDs keep the same neutral frame.
const identities: Record<
  string,
  { name: string; symbol: string; color: string }
> = {
  typescript: { name: "TypeScript", symbol: "TS", color: "#3178c6" },
};
export function CourseArtwork({ id }: { id: string }) {
  const identity = identities[id];
  return (
    <div
      aria-hidden="true"
      className="course-artwork relative flex min-h-40 items-center justify-center overflow-hidden rounded-xl border border-line bg-[#141c25]"
    >
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 400 240"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M0 60h400M0 120h400M0 180h400M80 0v240M160 0v240M240 0v240M320 0v240"
          stroke="#293b50"
          strokeWidth=".6"
        />
        <path
          d="m32 170 58-34 48 27 74-43 66 38 92-53M24 188l66-38 48 27 74-43 66 38 98-56"
          stroke="#547495"
          opacity=".4"
        />
        <path d="M18 18h20M18 18v20M382 222h-20M382 222v-20" stroke="#e8bd68" />
      </svg>
      {identity ? (
        <svg
          viewBox="0 0 128 128"
          className="relative my-8 size-28 drop-shadow-xl"
          role="presentation"
        >
          <rect width="128" height="128" rx="4" fill={identity.color} />
          <text
            x="116"
            y="113"
            textAnchor="end"
            fontFamily="Arial, sans-serif"
            fontWeight="bold"
            fontSize="69"
            fill="white"
          >
            {identity.symbol}
          </text>
        </svg>
      ) : (
        <Braces className="relative my-8 size-20 text-gold" strokeWidth={1} />
      )}
    </div>
  );
}
