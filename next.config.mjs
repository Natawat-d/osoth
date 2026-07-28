/** @type {import('next').NextConfig} */
// Sub-path hosting (optional): set NEXT_PUBLIC_BASE_PATH="/osoth" at build time to
// serve the whole app under that prefix (behind an nginx `location /osoth`).
// Unset -> served at root exactly as before (dev/AWS unaffected).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = {
  ...(basePath ? { basePath } : {}),
};

export default nextConfig;
