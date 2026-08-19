import { Geist } from "next/font/google";
import "./globals.css";
import { ToastContainer } from "react-toastify";
import AppShell from "./components/app-shell";
import { AntdRegistry } from "@ant-design/nextjs-registry";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${geistSans.variable} antialiased`}>
        <AntdRegistry>
          <AppShell>{children}</AppShell>

        </AntdRegistry>
        <ToastContainer />
      </body>
    </html>
  );
}
