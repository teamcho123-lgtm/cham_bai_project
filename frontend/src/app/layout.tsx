import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "lucide-react";
import SideBar from "./components/sidebar";
import Header from "./components/header";
import { ToastContainer } from "react-toastify";



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body >
        <div className="flex min-h-screen w-full">
          <SideBar />

          <main className="min-w-0 flex-1 bg-[#fff0f3]">
            <Header />
            {children}
            <ToastContainer />
          </main>
        </div>
      </body>
    </html>
  );
}
