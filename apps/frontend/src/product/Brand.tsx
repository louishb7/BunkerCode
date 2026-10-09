export function Insignia({ large = false }: { large?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        large
          ? "relative block size-28 shrink-0 overflow-hidden md:size-36"
          : "relative block size-9 shrink-0 overflow-hidden"
      }
    >
      <img
        src="/brand/bunker.png"
        alt=""
        width="500"
        height="500"
        className="absolute top-1/2 left-1/2 h-[140%] w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
      />
    </span>
  );
}
