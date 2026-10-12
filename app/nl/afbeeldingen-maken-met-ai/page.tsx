import { permanentRedirect } from "next/navigation";

// Requests are redirected by proxy.ts before this legacy route can render.
// Keep a route module for builds and for deployments where Proxy is bypassed.
export default function DutchImageGenerationLegacyPage() {
  permanentRedirect("/nl/");
}
