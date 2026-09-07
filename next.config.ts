import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The on-screen route badge in next dev — local-only, never rendered
  // on a production build or shown to a real visitor either way. Off
  // because it was surfacing a below-the-fold lazy-image heuristic
  // (see components/landing/Section.tsx) that doesn't apply here; Next
  // still prints real compile/runtime errors to the terminal without it.
  devIndicators: false,
};

export default nextConfig;
