import Layout from "./Layout";
import React from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}
