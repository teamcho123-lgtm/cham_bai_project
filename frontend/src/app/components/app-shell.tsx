"use client";

import { usePathname } from "next/navigation";
import Header from "./header";
import SideBar from "./sidebar";

interface IAppShellProps {
    children: React.ReactNode;
}

const AppShell = ({ children }: IAppShellProps) => {
    const pathname = usePathname();
    const isCameraPage = pathname.startsWith("/camera/");

    if (isCameraPage) {
        return <>{children}</>;
    }

    return (
        <div className="flex min-h-screen w-full">
            <SideBar />

            <main className="min-w-0 flex-1 bg-[#fff0f3]">
                <Header />
                {children}
            </main>
        </div>
    );
};

export default AppShell;
