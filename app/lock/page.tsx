import type { Metadata } from "next";
import { PinLock } from "./pin-lock";

export const metadata: Metadata = {
  title: "JobFuture Oy",
  robots: {
    follow: false,
    index: false
  }
};

type LockPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
  }>;
};

export default async function LockPage({ searchParams }: LockPageProps) {
  const params = searchParams ? await searchParams : {};

  return <PinLock nextPath={getSafeNextPath(params.next)} />;
}

function getSafeNextPath(value: string | string[] | undefined) {
  const nextPath = Array.isArray(value) ? value[0] : value;

  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/";
  }

  if (nextPath === "/lock" || nextPath.startsWith("/lock/")) {
    return "/";
  }

  return nextPath;
}
