"use client";

import { Bell, ChevronDown, Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { Breadcrumb, Image } from "antd";
import Link from "next/link";

const Header = () => {
    const pathname = usePathname();

    const classRouteMatch = pathname.match(
        /^\/class\/([^/]+)(?:\/exams\/([^/]+))?(?:\/([^/]+))?$/
    );
    const classId = classRouteMatch?.[1];
    const classExamId = classRouteMatch?.[2];
    const examCode = classRouteMatch?.[3];

    const examinationMatch = pathname.match(
        /^\/examination\/([^/]+)(?:\/([^/]+))?/
    );
    const periodId = examinationMatch?.[1];
    const schoolExamId = examinationMatch?.[2];

    const linkItem = (title: string, href: string) => ({
        title: (
            <Link
                href={href}
                className="text-gray-500 transition-colors hover:text-pink-500"
            >
                {title}
            </Link>
        ),
    });

    const currentItem = (title: string) => ({
        title: (
            <span className="font-semibold text-pink-600">
                {title}
            </span>
        ),
    });

    const getBreadcrumbItems = () => {
        if (/^\/class\/[^/]+\/exams\/[^/]+\/[^/]+$/.test(pathname)) {
            return [
                linkItem("Danh sách lớp học", "/class"),
                linkItem("Chi tiết lớp học", `/class/${classId}`),
                linkItem(
                    "Danh sách mã đề",
                    `/class/${classId}/exams/${classExamId}`
                ),
                currentItem(
                    examCode === "all"
                        ? "Chấm tất cả mã đề"
                        : `Chấm mã đề ${examCode}`
                ),
            ];
        }

        if (/^\/class\/[^/]+\/exams\/[^/]+$/.test(pathname)) {
            return [
                linkItem("Danh sách lớp học", "/class"),
                linkItem("Chi tiết lớp học", `/class/${classId}`),
                currentItem("Danh sách mã đề"),
            ];
        }

        if (/^\/class\/[^/]+$/.test(pathname)) {
            return [
                linkItem("Danh sách lớp học", "/class"),
                currentItem("Chi tiết lớp học"),
            ];
        }

        if (pathname === "/class") {
            return [currentItem("Danh sách lớp học")];
        }

        if (/^\/examination\/[^/]+\/[^/]+\/grading\/[^/]+$/.test(pathname)) {
            return [
                linkItem("Danh sách kỳ thi", "/examination"),
                linkItem("Chi tiết kỳ thi", `/examination/${periodId}`),
                linkItem(
                    "Chi tiết phòng thi",
                    `/examination/${periodId}/${schoolExamId}`
                ),
                currentItem("Chấm bài"),
            ];
        }

        if (/^\/examination\/[^/]+\/[^/]+$/.test(pathname)) {
            return [
                linkItem("Danh sách kỳ thi", "/examination"),
                linkItem("Chi tiết kỳ thi", `/examination/${periodId}`),
                currentItem("Chi tiết phòng thi"),
            ];
        }

        if (/^\/examination\/[^/]+$/.test(pathname)) {
            return [
                linkItem("Danh sách kỳ thi", "/examination"),
                currentItem("Chi tiết kỳ thi"),
            ];
        }

        if (pathname === "/examination") {
            return [currentItem("Danh sách kỳ thi")];
        }

        return [currentItem("Trang chủ")];
    };

    return (
        <header className="bg-[#fff0f3] px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center">
                <button
                    className="p-2 mr-4 rounded-lg bg-pink-100 text-pink-600 lg:hidden hover:bg-pink-200"
                >
                    <Menu size={24} />
                </button>
                <div className="hidden md:flex items-center space-x-2 text-stone-500 text-sm">
                    <Breadcrumb
                        separator={<span className="text-gray-300">|</span>}
                        items={getBreadcrumbItems()}
                    />
                </div>
            </div>

            <div className="flex items-center space-x-4">
                <div className="relative hidden sm:block">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-pink-300" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="pl-9 pr-4 py-2 rounded-full bg-white border border-pink-100 focus:outline-none focus:ring-2 focus:ring-pink-300 text-sm w-48 transition-all"
                    />
                </div>
                <button className="p-2 rounded-full bg-white text-pink-400 hover:text-pink-600 hover:bg-pink-50 transition shadow-sm relative">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                <div className="flex items-center space-x-2 cursor-pointer bg-white py-1 px-2 rounded-full shadow-sm">
                    <div className="w-12 h-8 rounded-full bg-pink-200 border-2 border-white overflow-hidden ">
                        <Image
                            src="https://api.dicebear.com/7.x/notionists/svg?seed=Minh&backgroundColor=ffdfed"
                            alt="Avatar cô Phước"
                            preview={false}
                            width={32}
                            height={32}
                            className="object-cover"
                        />
                    </div>
                    <span className="font-medium text-sm text-stone-700 hidden sm:block">Cô Phước</span>
                    <ChevronDown className="w-4 h-4 text-stone-400 hidden sm:block" />
                </div>
            </div>
        </header>
    )
}

export default Header
