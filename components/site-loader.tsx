"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function SiteLoader() {
  const [isVisible, setIsVisible] = useState(true);
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    const frameId = requestAnimationFrame(() => {
      setIsVisible(false);
      timeoutId = setTimeout(() => setIsMounted(false), 240);
    });

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
    };
  }, []);

  if (!isMounted) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-50 grid place-items-center bg-canvas transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
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
    </div>
  );
}
