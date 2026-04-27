"use client";

import * as React from "react";

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="min-h-screen w-full bg-background">{children}</div>;
}
