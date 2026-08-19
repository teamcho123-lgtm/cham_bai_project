"use client";

import { ConfigProvider } from "antd";
export default function Home() {


  return (
    <div className="flex h-screen overflow-hidden bg-[#fff0f3] font-sans text-stone-800">
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#8f3c4a",
            borderRadius: 12,
            controlHeight: 42,
            fontFamily:
              "Arial, Helvetica, sans-serif",
          },
        }}
      >

      </ConfigProvider>
    </div>
  );
}