"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
    BarChart,
    BookHeart,
    CheckSquare,
    FileSignature,
    LayoutDashboard,
    Menu,
    Settings,
    UserCog,
    Users,
    X,
    type LucideIcon,
} from "lucide-react";

interface MenuItem {
    label: string;
    href: string;
    icon: LucideIcon;
}

interface SidebarItemProps extends MenuItem {
    active: boolean;
    onNavigate: () => void;
}


const menuItems: MenuItem[] = [
    {
        label: "Tạo Bài Chấm",
        href: "/class",
        icon: LayoutDashboard,
    },
    {
        label: "Kỳ thi",
        href: "/examination",
        icon: FileSignature,
    },
    {
        label: "Bài Đã Chấm",
        href: "/graded",
        icon: CheckSquare,
    },
    {
        label: "Danh Sách Lớp Học",
        href: "/classes",
        icon: Users,
    },
    {
        label: "Quản Lý Học Sinh",
        href: "/students",
        icon: UserCog,
    },
    {
        label: "Báo Cáo Thống Kê",
        href: "/reports",
        icon: BarChart,
    },
    {
        label: "Cài Đặt",
        href: "/settings",
        icon: Settings,
    },
];

const SidebarItem = (prop: SidebarItemProps) => {
    return (
        <Link
            href={prop?.href}
            onClick={prop?.onNavigate}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200
                    ${prop?.active ? "bg-white font-semibold text-pink-600 shadow-sm" : "text-stone-600 hover:bg-white/60 hover:text-pink-500"}`}
        >
            <prop.icon
                className={`h-5 w-5 shrink-0 ${prop?.active ? "text-pink-500" : "text-stone-500"}`}
            />
            <span>{prop?.label}</span>
        </Link>
    );
};

const SideBar = () => {
    const pathname = usePathname();

    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

    const handleOpenSideBar = (): void => {
        setIsSidebarOpen(true);
    };

    const handleCloseSideBar = (): void => {
        setIsSidebarOpen(false);
    };

    return (
        <div className="relative min-h-screen w-0 shrink-0 lg:w-64">
            {/* Nút mở sidebar trên mobile */}
            <button
                type="button"
                aria-label="Mở menu"
                onClick={handleOpenSideBar}
                className="fixed left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-pink-500 shadow-md transition hover:bg-pink-50 "
            >
                <Menu className="h-6 w-6" />
            </button>

            <button
                type="button"
                aria-label="Đóng menu"
                onClick={handleCloseSideBar}
                className={`fixed inset-0 z-20 bg-[#ffe4e9] transition-opacity duration-300 ease-in-out 
                        ${isSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
            />

            <aside
                style={{ borderRadius: 0 }}
                className={`fixed inset-y-0 left-0 z-30 flex h-screen w-64 flex-col
                    transform-gpu bg-[#ffe4e9] shadow-lg transition-transform duration-300
                    ease-in-out will-change-transform
                    lg:h-screen lg:translate-x-0 lg:shadow-none
                    ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
                {/* Nút đóng trên mobile */}
                <button
                    type="button"
                    aria-label="Đóng menu"
                    onClick={handleCloseSideBar}
                    className=" absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-white/70 hover:text-pink-500 lg:hidden">
                    <X className="h-5 w-5" />
                </button>

                {/* Logo */}
                <div className="flex flex-col items-center justify-center p-6">
                    <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
                        <BookHeart className="h-10 w-10 text-pink-500" />
                    </div>

                    <h1 className="text-center text-lg font-bold uppercase tracking-wide text-stone-800">
                        Chấm Thi
                    </h1>
                </div>

                {/* Menu */}
                <nav className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-4 pb-6">
                    {menuItems.map((item) => {
                        const active =
                            pathname === item.href ||
                            pathname.startsWith(`${item.href}/`);

                        return (
                            <SidebarItem
                                key={item.href}
                                icon={item.icon}
                                label={item.label}
                                href={item.href}
                                active={active}
                                onNavigate={handleCloseSideBar}
                            />
                        );
                    })}
                </nav>
            </aside>
        </div>
    );
};

export default SideBar;
