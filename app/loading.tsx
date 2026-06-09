import Image from "next/image";

export default function Loading() {
  return (
    <main
      aria-label="Ladataan"
      className="grid min-h-screen place-items-center bg-canvas text-ink"
    >
      <div className="flex flex-col items-center gap-5">
        <Image
          src="/logo.png"
          alt=""
          width={56}
          height={56}
          priority
          className="h-14 w-14 object-contain"
        />
        <div className="h-1 w-32 overflow-hidden bg-rule-muted">
          <div className="h-full w-1/2 animate-loading-bar bg-accent" />
        </div>
      </div>
    </main>
  );
}
