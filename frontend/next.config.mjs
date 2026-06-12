/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Move the dev-only build indicator to the bottom-right so it doesn't
  // overlap the sidebar footer (profile / logout) in the bottom-left.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
