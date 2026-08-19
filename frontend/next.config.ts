import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const lanAddresses = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => (
    address.family === "IPv4"
    && !address.internal
  ))
  .map((address) => address.address);

const nextConfig: NextConfig = {
  // Điện thoại mở trang qua IPv4 LAN. Nếu không khai báo, Next.js dev chỉ
  // trả HTML nhưng chặn tài nguyên hydrate/HMR nên mọi nút đều không bấm được.
  allowedDevOrigins: [
    ...lanAddresses,
    "*.trycloudflare.com",
  ],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
