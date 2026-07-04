import React, { useState } from "react";
import image from "../assets/image.png";
import image1 from "../assets/image1.png";
import image2 from "../assets/image2.png";
import image3 from "../assets/image3.png";
import image4 from "../assets/image4.png";
import {
  BookHeart,
  LayoutDashboard,
  FileSignature,
  CheckSquare,
  Users,
  UserCog,
  BarChart,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Menu,
} from "lucide-react";

const templates = [
  {
    id: 1,
    name: "Mẫu App1 - THPT Quốc Gia",
    image: image1,

    mcq: 40,
    tf: 8,
    essay: 6,

    detector: "app1" // file xử lý
  },

  {
    id: 2,
    name: "Mẫu App2 - Đánh Giá Năng Lực",
    image: image2,

    mcq: 24,
    tf: 6,
    essay: 16,

    detector: "app2"
  },

  {
    id: 3,
    name: "Mẫu App3 - Cuối Kỳ",
    image: image3,

    mcq: 120,
    tf: 0,
    essay: 0,

    detector: "app3"
  },

  {
    id: 4,
    name: "Mẫu App4 - Phiếu OMR A",
    image: image4,

    mcq: 40,
    tf: 8,
    essay: 8,

    detector: "app4"
  },

  {
    id: 5,
    name: "Mẫu App5 - Phiếu OMR B",
    image: image,

    mcq: 40,
    tf: 8,
    essay: 12,

    detector: "app5"
  }
];
const TemplatePage = ({ onSelect }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#fff0f3] font-sans">

      {/* Sidebar */}
      <aside className="w-64 bg-[#ffe4e9] shadow-lg hidden lg:flex flex-col">

        <div className="p-6 flex flex-col items-center">

          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3">
            <BookHeart className="w-10 h-10 text-pink-500"/>
          </div>

          <h1 className="font-bold text-lg text-center uppercase">
            Chấm Thi
            <br />
          </h1>

        </div>

        <nav className="flex-1 px-4 space-y-2">

          <SidebarItem
            icon={<LayoutDashboard />}
            label="Bảng Điều Khiển"
          />

          <SidebarItem
            icon={<FileSignature />}
            label="Quản Lý Mã Đề"
            active
          />

          <SidebarItem
            icon={<CheckSquare />}
            label="Bài Đã Chấm"
          />

          <SidebarItem
            icon={<Users />}
            label="Danh Sách Lớp Học"
          />

          <SidebarItem
            icon={<UserCog />}
            label="Quản Lý Học Sinh"
          />

          <SidebarItem
            icon={<BarChart />}
            label="Báo Cáo"
          />

          <SidebarItem
            icon={<Settings />}
            label="Cài Đặt"
          />

        </nav>

      </aside>

      {/* Main */}

      <main className="flex-1 flex flex-col">

        {/* Header */}

        <header className="bg-[#fff0f3] px-8 py-4 flex justify-between items-center">

          <div>
            <h2 className="text-2xl font-bold">
              Chọn Mẫu Phiếu Trắc Nghiệm
            </h2>
          </div>

          <div className="flex items-center gap-4">

            <div className="relative">

              <Search className="w-4 h-4 absolute left-3 top-3 text-pink-400"/>

              <input
                placeholder="Search..."
                className="pl-10 py-2 rounded-full border border-pink-200 bg-white"
              />

            </div>

            <button className="p-2 rounded-full bg-white shadow">
              <Bell size={18}/>
            </button>

            <div className="flex items-center bg-white rounded-full px-2 py-1 shadow">

              <img
                src="https://api.dicebear.com/7.x/notionists/svg?seed=Minh"
                className="w-8 h-8"
              />

              <span className="mx-2 text-sm font-medium">
                Cô Phước
              </span>

              <ChevronDown size={15}/>

            </div>

          </div>

        </header>

        {/* Nội dung */}

        <div className="flex-1 overflow-y-auto p-8">

          <div className="bg-white rounded-3xl p-8 shadow border border-pink-100">

            <div className="mb-8">

              <h3 className="text-xl font-bold text-stone-700">

                Danh sách mẫu đề thi

              </h3>

              <p className="text-gray-500">

                Chọn một mẫu phiếu để tạo đáp án

              </p>

            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">

              {templates.map((template)=>(

                <div
                  key={template.id}
                  className="bg-[#fff5f7] border border-pink-200 rounded-xl overflow-hidden hover:shadow-xl transition cursor-pointer"
                >

                  <img
                    src={template.image}
                    className="w-full h-[400px] object-cover"
                  />

                  <div className="p-5">

                    <h2 className="font-bold text-lg mb-3">

                      {template.name}

                    </h2>

                    <div className="space-y-1 text-gray-500">

                      <p>
                        Trắc nghiệm: {template.mcq}
                      </p>

                      <p>
                        Đúng/Sai: {template.tf}
                      </p>

                      <p>
                        Tự luận: {template.essay}
                      </p>

                    </div>

                    <button
                      onClick={()=>onSelect(template)}
                      className="w-full mt-5 bg-[#723340] hover:bg-[#5a2732] text-white py-3 rounded-xl font-semibold"
                    >
                      Chọn mẫu này
                    </button>

                  </div>

                </div>

              ))}

            </div>

          </div>

        </div>

      </main>

    </div>
  );
};

const SidebarItem = ({ icon,label,active }) => (

  <button
    className={`
      w-full flex items-center gap-3 px-4 py-3 rounded-2xl
      ${active
        ? "bg-white text-pink-600 font-semibold"
        : "hover:bg-white/50"}
    `}
  >
    {icon}
    <span>{label}</span>
  </button>

);

export default TemplatePage;