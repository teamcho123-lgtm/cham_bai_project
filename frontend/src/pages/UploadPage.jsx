import React, { useState } from "react";
import axios from "axios";
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
  Upload,
  Image as ImageIcon,
  X,
  FileText
} from "lucide-react";


const UploadPage = ({ onBack }) => {
  // Lấy dữ liệu từ Local Storage
  const template = JSON.parse(localStorage.getItem("selectedTemplate")) || {};
  const selectedCode = localStorage.getItem("selectedCode") || "N/A";
  const mcqAnswers = JSON.parse(localStorage.getItem("mcqAnswers")) || {};
  const tfAnswers = JSON.parse(localStorage.getItem("tfAnswers")) || {};
  const essayAnswers = JSON.parse(localStorage.getItem("essayAnswers")) || {};

  // Lưu trữ danh sách file (kèm preview URL)
  const [images, setImages] = useState([]);

  const handleUpload = (e) => {
    const files = Array.from(e.target.files);
    // Tạo preview URL cho từng ảnh để hiển thị thumbnail
    const newImages = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      name: file.name,
    }));
    // Gộp ảnh mới vào danh sách ảnh cũ
    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (indexToRemove) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleChamBai = async()=>{

    if(images.length===0){
        alert("Chưa chọn ảnh");
        return;
    }

    const formData = new FormData();
    images.forEach((img)=>{
        formData.append(
            "files",
            img.file
        );

    });
    const template = JSON.parse(
        localStorage.getItem(
            "selectedTemplate"
        )
    );
    formData.append(
        "detector",
        template.detector
    );

    const selectedCode =
    localStorage.getItem(
        "selectedCode"
    );

    formData.append(
        "code",
        selectedCode
    );
    try{
        const res = await axios.post(
            "http://127.0.0.1:8000/cham_bai",
            formData,
            {
                headers:{
                    "Content-Type":
                    "multipart/form-data"
                }
            }
        );
        // alert(
        //     `CHẤM YANHF CÔNG! Kết quả đã được lưu vào Local Storage.`
        // );
        console.log(
            res.data
        );
    }
    catch(err){
        console.log(err);
        alert(
             JSON.stringify(
            err.response?.data
        )
        );
    }
  };

  return (
    <div className="flex h-screen bg-[#fff0f3] font-sans text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-[#ffe4e9] shadow-xl hidden lg:flex flex-col z-10">
        <div className="p-6 flex flex-col items-center border-b border-pink-200/50">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3 transition-transform hover:scale-105">
            <BookHeart className="w-8 h-8 text-pink-500" />
          </div>
          <h1 className="font-extrabold text-lg text-gray-800 tracking-wide">
            CHẤM THI
          </h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          <SidebarItem icon={<LayoutDashboard size={20} />} label="Bảng Điều Khiển" />
          <SidebarItem icon={<FileSignature size={20} />} label="Quản Lý Mã Đề" />
          <SidebarItem icon={<CheckSquare size={20} />} label="Chấm Bài" active />
          <SidebarItem icon={<Users size={20} />} label="Danh Sách Lớp" />
          <SidebarItem icon={<BarChart size={20} />} label="Báo Cáo" />
          <SidebarItem icon={<Settings size={20} />} label="Cài Đặt" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white/60 backdrop-blur-md px-8 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
          <h2 className="text-2xl font-bold text-gray-800">
            Tải ảnh bài làm để chấm
          </h2>
          <div className="flex items-center gap-5">
            <button className="p-2.5 bg-white text-gray-600 hover:text-pink-600 rounded-full shadow-sm hover:shadow-md transition-all">
              <Bell size={20} />
            </button>
            <div className="flex items-center bg-white px-1.5 py-1.5 pr-4 rounded-full shadow-sm hover:shadow-md cursor-pointer transition-all border border-gray-100">
              <img
                src="https://api.dicebear.com/7.x/notionists/svg?seed=Minh"
                alt="Avatar"
                className="w-8 h-8 rounded-full bg-pink-100"
              />
              <span className="mx-3 font-medium text-sm text-gray-700">Cô Phước</span>
              <ChevronDown size={16} className="text-gray-400" />
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto space-y-6">
            
            {/* Top Section: Info & JSON Data (Grid Layout) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: Template Info */}
              <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col">
                <div className="flex items-center gap-2 mb-5">
                  <FileText className="text-pink-500" size={22} />
                  <h4 className="font-bold text-lg text-gray-800">Thông tin mẫu đề</h4>
                </div>
                <div className="space-y-4 flex-1">
                  <InfoRow label="Mã đề" value={selectedCode} highlight />
                  <InfoRow label="Tên mẫu" value={template?.name || "Chưa có"} />
                  <InfoRow label="Detector" value={template?.detector || "Chưa có"} />
                  <InfoRow label="Trắc nghiệm" value={`${template?.mcq || 0} câu`} />
                  <InfoRow label="Đúng/Sai" value={`${template?.tf || 0} câu`} />
                  <InfoRow label="Tự luận" value={`${template?.essay || 0} câu`} />
                </div>
              </div>

              {/* Right Column: JSON Answers */}
              <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h4 className="font-bold text-lg text-gray-800 mb-5">Đáp án đã lưu</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Trắc nghiệm */}
                  <JsonCard title="Trắc nghiệm" data={mcqAnswers} color="blue" />
                  {/* Đúng/Sai */}
                  <JsonCard title="Đúng / Sai" data={tfAnswers} color="green" />
                  {/* Tự luận */}
                  <JsonCard title="Tự luận" data={essayAnswers} color="orange" />
                </div>
              </div>
            </div>

            {/* Middle Section: Upload Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-xl mb-1 text-gray-800">Import ảnh bài làm</h3>
              <p className="text-gray-500 text-sm mb-5">
                Kéo thả hoặc chọn một/nhiều ảnh để bắt đầu hệ thống nhận diện.
              </p>
              
              <label className="border-2 border-dashed border-pink-300 bg-pink-50/30 rounded-2xl h-56 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-50 hover:border-pink-400 transition-all group">
                <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32} className="text-pink-500" />
                </div>
                <p className="font-semibold text-gray-700 text-lg mb-1">
                  Nhấn để tải ảnh lên
                </p>
                <p className="text-gray-400 text-sm font-medium">
                  Hỗ trợ định dạng: JPG, PNG, JPEG
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
            </div>

            {/* Bottom Section: Image Preview Grid */}
            {images.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-5">
                  <h4 className="font-bold text-lg text-gray-800">
                    Ảnh đã tải lên <span className="text-pink-600 bg-pink-100 px-2 py-0.5 rounded-md ml-2 text-sm">{images.length}</span>
                  </h4>
                  <button 
                    onClick={() => setImages([])}
                    className="text-sm text-red-500 hover:text-red-700 font-medium"
                  >
                    Xóa tất cả
                  </button>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {images.map((img, index) => (
                    <div key={index} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-[3/4]">
                      <img 
                        src={img.preview} 
                        alt={img.name} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      {/* Overlay & Info */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                        <p className="text-white text-xs truncate w-full font-medium" title={img.name}>
                          {img.name}
                        </p>
                      </div>
                      {/* Remove Button */}
                      <button 
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-sm"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-4 pb-10">
              <button
                onClick={onBack}
                className="px-6 py-2.5 bg-white border-2 border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                Quay lại
              </button>
              <button onClick={handleChamBai} className="px-8 py-2.5 bg-[#723340] text-white font-medium rounded-xl hover:bg-[#5a2832] shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                <CheckSquare size={18} />
                Bắt đầu chấm bài
              </button>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

/* --- Sub Components (để file gọn gàng hơn) --- */

const SidebarItem = ({ icon, label, active }) => (
  <button
    className={`
      w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all
      ${
        active
          ? "bg-white text-pink-600 shadow-sm"
          : "text-gray-600 hover:bg-white/50 hover:text-gray-900"
      }
    `}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const InfoRow = ({ label, value, highlight }) => (
  <div className="flex justify-between items-center py-2 border-b border-gray-50 border-dashed last:border-0">
    <span className="text-gray-500 text-sm">{label}</span>
    <span className={`font-semibold text-sm ${highlight ? "text-pink-600 bg-pink-50 px-2 py-0.5 rounded" : "text-gray-800"}`}>
      {value}
    </span>
  </div>
);

const JsonCard = ({ title, data, color }) => {
  const colorMap = {
    blue: "bg-blue-50 border-blue-100 text-blue-700",
    green: "bg-green-50 border-green-100 text-green-700",
    orange: "bg-orange-50 border-orange-100 text-orange-700",
  };

  return (
    <div className="flex flex-col h-48 border rounded-xl overflow-hidden bg-gray-50/50">
      <div className={`px-3 py-2 text-xs font-bold uppercase tracking-wider border-b ${colorMap[color]}`}>
        {title}
      </div>
      <div className="flex-1 p-3 overflow-y-auto">
        <pre className="text-xs text-gray-600 font-mono">
          {Object.keys(data).length === 0 
            ? "Chưa có dữ liệu" 
            : JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default UploadPage;