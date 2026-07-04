import axios from "axios";
import React, { useState, useEffect } from 'react';
import TemplatePage from "./pages/TemplatePage";
import UploadPage from "./pages/UploadPage";
import { 
  BookHeart, LayoutDashboard, FileSignature, CheckSquare, 
  Users, UserCog, BarChart, Settings, Search, Bell, 
  ChevronDown, Edit, Trash2, Menu
} from 'lucide-react';

const App = () => {
  // --- STATES ---
  const [examCodes, setExamCodes] = useState([]);
  const [answersData, setAnswersData] = useState({});
  const [selectedCode, setSelectedCode] = useState("");
  
  // SỬA LỖI 1: Chỉ giữ 1 state currentView duy nhất
  const [currentView, setCurrentView] = useState("template");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [mcqAnswers, setMcqAnswers] = useState({});
  const [tfAnswers, setTfAnswers] = useState({});
  const [essayAnswers, setEssayAnswers] = useState({});

  // Lấy dữ liệu template từ LocalStorage
  const selectedTemplate = JSON.parse(localStorage.getItem("selectedTemplate")) || {};
  const [numMCQ, setNumMCQ] = useState(selectedTemplate.mcq || 0);
  const [numTF, setNumTF] = useState(selectedTemplate.tf || 0);
  const [numEssay, setNumEssay] = useState(selectedTemplate.essay || 0);

  // --- EFFECTS ---
  useEffect(() => {
    const loadExams = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:8000/get_exams");
        setAnswersData(res.data);
        setExamCodes(Object.keys(res.data));
      } catch (err) {
        console.error("Lỗi khi tải dữ liệu bài thi:", err);
      }
    };
    loadExams();
  }, []);

  // --- HANDLERS ---
  const saveExam = async () => {
    // 1. Kiểm tra xem đã nhập mã đề chưa
    if (!selectedCode || !selectedCode.trim()) {
      alert("Vui lòng nhập Mã Đề trước khi lưu!");
      return false;
    }

    // 2. Lấy template an toàn
    const templateString = localStorage.getItem("selectedTemplate");
    const template = templateString ? JSON.parse(templateString) : {};

    const data = {
      code: selectedCode,
      mcq: mcqAnswers,
      tf: tfAnswers,
      essay: essayAnswers,
      template_id: template?.id,
      detector: template?.detector
    };

    try {
      // Lưu danh sách mã đề
      localStorage.setItem("examCodes", JSON.stringify([...new Set([...examCodes, selectedCode])]));
      
      // Gửi API
      await axios.post("http://127.0.0.1:8000/save_exam", data);

      // Cập nhật state nội bộ
      setAnswersData(prev => ({
        ...prev,
        [selectedCode]: { mcq: mcqAnswers, tf: tfAnswers, essay: essayAnswers }
      }));

      if (!examCodes.includes(selectedCode)) {
        setExamCodes(prev => [...prev, selectedCode]);
      }
      
      alert("Lưu thành công!");
      return true; 
    } catch (err) {
      console.error("Lỗi khi lưu bài thi:", err);
      alert("Không thể kết nối đến Backend. Hãy kiểm tra lại server Python!");
      return false; 
    }
  };

  const addExamCode = () => {
    if (!selectedCode.trim()) return;
    if (examCodes.includes(selectedCode)) {
      alert("Mã đề đã tồn tại");
      return;
    }
    setExamCodes(prev => [...prev, selectedCode]);
    setSelectedCode("");
  };

  const loadExam = (code) => {
    setSelectedCode(code);
    const exam = answersData[code];
    if (!exam) {
      alert("Không tìm thấy đáp án");
      return;
    }
    setMcqAnswers(exam.mcq || {});
    setTfAnswers(exam.tf || {});
    setEssayAnswers(exam.essay || {});
  };

  const removeExamCode = (codeToRemove) => {
    setExamCodes(prev => prev.filter(c => c !== codeToRemove));
  };

  // --- SỬA LỖI 2: RENDER ROUTING CHUẨN ---
  
  // 1. Hiển thị trang chọn Template
  if (currentView === "template") {
    return (
      <TemplatePage
        onSelect={(template) => {
          setNumMCQ(template.mcq);
          setNumTF(template.tf);
          setNumEssay(template.essay);
          localStorage.setItem("selectedTemplate", JSON.stringify(template));
          // Chuyển sang màn hình nhập mã đề (main)
          setCurrentView("main");
        }}
      />
    );
  }

  // 2. Hiển thị trang Upload Ảnh
  if (currentView === "upload") {
    return (
      <UploadPage
        onBack={() => setCurrentView("main")} // Nút quay lại sẽ về màn hình nhập mã đề
      />
    );
  }

  // 3. Hiển thị màn hình CHÍNH (main) - Nhập mã đề & đáp án
  return (
    <div className="flex h-screen bg-[#fff0f3] font-sans overflow-hidden text-stone-800">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-[#ffe4e9] shadow-lg lg:shadow-none transform transition-transform duration-300 ease-in-out flex flex-col
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-3">
            <BookHeart className="w-10 h-10 text-pink-500" />
          </div>
          <h1 className="font-bold text-lg text-stone-800 tracking-wide text-center uppercase">Chấm Thi</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
          <SidebarItem icon={<LayoutDashboard />} label="Bảng Điều Khiển" />
          <SidebarItem icon={<FileSignature />} label="Quản Lý Mã Đề" active />
          <SidebarItem icon={<CheckSquare />} label="Bài Đã Chấm" />
          <SidebarItem icon={<Users />} label="Danh Sách Lớp Học" />
          <SidebarItem icon={<UserCog />} label="Quản Lý Học Sinh" />
          <SidebarItem icon={<BarChart />} label="Báo Cáo Thống Kê" />
          <SidebarItem icon={<Settings />} label="Cài Đặt" />
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="bg-[#fff0f3] px-4 lg:px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center">
            <button 
              className="p-2 mr-4 rounded-lg bg-pink-100 text-pink-600 lg:hidden hover:bg-pink-200"
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:flex items-center space-x-2 text-stone-500 text-sm">
              <span className="cursor-pointer hover:text-pink-500">Quản Lý Mã Đề Chi Tiết</span>
              <span>-</span>
              <span className="text-pink-600 font-medium">[Tên Bài Chấm Mới]</span>
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
              <div className="w-8 h-8 rounded-full bg-pink-200 border-2 border-white overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=Minh&backgroundColor=ffdfed`} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <span className="font-medium text-sm text-stone-700 hidden sm:block">Cô Phước</span>
              <ChevronDown className="w-4 h-4 text-stone-400 hidden sm:block" />
            </div>
          </div>
        </header>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Header Mã Đề */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-stone-800">Quản Lý Mã Đề & Đáp Án Chi Tiết</h2>
              <div className="flex items-center space-x-3 bg-white p-2 rounded-2xl shadow-sm border border-pink-100">
                <span className="font-medium text-stone-600 whitespace-nowrap pl-2">Thêm Mã Đề:</span>
                <input
                  type="text"
                  value={selectedCode}
                  onChange={(e) => setSelectedCode(e.target.value)}
                  placeholder="VD: 101"
                  className="bg-transparent border-none outline-none text-pink-700 font-bold w-20"
                />
                <button
                  onClick={addExamCode}
                  className="bg-pink-400 hover:bg-pink-500 text-white px-4 py-1.5 rounded-lg font-medium transition shadow-sm"
                >
                  + Thêm
                </button>
              </div>
            </div>

            {/* Bảng Mã Đề */}
            <div className="bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-center">
                  <thead className="bg-[#ffe4e9] text-stone-700">
                    <tr>
                      <th className="py-3 px-4 font-semibold border-b border-pink-200">Mã Đề</th>
                      <th className="py-3 px-4 font-semibold border-b border-pink-200">Cấu Trúc (Số Câu)</th>
                      <th className="py-3 px-4 font-semibold border-b border-pink-200">Trạng Thái Đáp Án</th>
                      <th className="py-3 px-4 font-semibold border-b border-pink-200">Hành Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-50">
                    {examCodes.map((code) => (
                      <tr key={code} className="hover:bg-pink-50/50 transition">
                        <td className="py-3 px-4 font-medium">{code}</td>
                        <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                          (Trắc nghiệm: {numMCQ} | Đúng Sai: {numTF} | Tự luận: {numEssay})
                        </td>
                        <td className="py-3 px-4">
                          {answersData[code] ? (
                            <span className="text-green-600 font-medium">Đã nhập đáp án</span>
                          ) : (
                            <span className="text-red-500">Chưa nhập</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center space-x-2">
                            <button onClick={() => loadExam(code)} className="text-stone-400 hover:text-pink-600">
                              <Edit size={18}/>
                            </button>
                            <button onClick={() => removeExamCode(code)} className="text-stone-400 hover:text-red-500">
                              <Trash2 size={18}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Form Nhập Đáp Án */}
            <div className="bg-white rounded-3xl shadow-md border border-pink-100 p-5 sm:p-6 lg:p-8 relative">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-pink-100 pb-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 w-full">
                  <h3 className="text-xl font-bold text-stone-800">2. Nhập Đáp Án Chi Tiết - Mã Đề</h3>
                  <div className="flex items-center gap-2 bg-pink-50 px-3 py-1.5 rounded-lg border border-pink-200">
                    <span className="text-sm font-medium text-stone-600 whitespace-nowrap">Mã Đề:</span>
                    <input
                      type="text"
                      value={selectedCode}
                      onChange={(e) => setSelectedCode(e.target.value)}
                      placeholder="Nhập mã đề"
                      className="w-32 px-2 py-1 bg-white rounded border border-pink-200"
                    />
                  </div>
                </div>
              </div>

              {/* Tag Mã đề đã lưu */}
              <div className="mb-6">
                <h4 className="font-bold mb-3">Mã đề đã lưu</h4>
                <div className="flex flex-wrap gap-3">
                  {examCodes.map(code => (
                    <button
                      key={code}
                      onClick={() => loadExam(code)}
                      className={`px-5 py-2 rounded-xl transition ${
                        selectedCode === code ? "bg-[#723340] text-white" : "bg-pink-100 hover:bg-pink-200"
                      }`}
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>

              <h4 className="font-semibold text-lg mb-4 text-stone-700">Cấu Trúc Đề Thi Cần Nhập Đáp Án</h4>
              
              {/* Vùng lưới đáp án */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <MCQGrid num={numMCQ} answers={mcqAnswers} setAnswers={setMcqAnswers} />
                <TFGrid num={numTF} answers={tfAnswers} setAnswers={setTfAnswers} />
                <EssayGrid num={numEssay} answers={essayAnswers} setAnswers={setEssayAnswers} />
              </div>

              <div className="mb-8">
                <label className="block font-bold text-stone-700 mb-2">Ghi chú cho Mã Đề :</label>
                <textarea 
                  className="w-full border border-pink-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-pink-400 min-h-[80px]"
                  placeholder="Nhập ghi chú hoặc hướng dẫn chấm điểm đặc biệt..."
                ></textarea>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-pink-100 gap-4">
                <button 
                  onClick={() => setCurrentView("template")}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-full border-2 border-pink-200 text-pink-500 font-bold hover:bg-pink-50 transition"
                >
                  Hủy
                </button>
                <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
                  <button className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#723340] hover:bg-[#5a2732] text-white font-bold transition shadow-sm">
                    Tiếp Theo
                  </button>
                  <button
                    onClick={async () => {
                      // Chờ hàm lưu chạy và trả về kết quả
                      const isSuccess = await saveExam();
                      
                      if (isSuccess) {
                        // NẾU API LƯU THÀNH CÔNG -> Lưu xuống localStorage
                        localStorage.setItem("selectedCode", selectedCode);
                        localStorage.setItem("mcqAnswers", JSON.stringify(mcqAnswers));
                        localStorage.setItem("tfAnswers", JSON.stringify(tfAnswers));
                        localStorage.setItem("essayAnswers", JSON.stringify(essayAnswers));
                        
                        // ĐỔI TRẠNG THÁI RENDER ĐỂ SANG TRANG GỬI ẢNH
                        setCurrentView("upload");
                      }
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-full bg-[#723340] text-white"
                  >
                    Lưu Lại & Tiếp Theo
                  </button>
                </div>
              </div>

            </div>
            <div className="h-10"></div>
          </div>
        </div>
      </main>

      {/* Global Scrollbar Styles */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #fff0f3; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #fbcfe8; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #f472b6; }
      `}} />
    </div>
  );
};

// =========================================
//            SUB COMPONENTS
// =========================================

const SidebarItem = ({ icon, label, active }) => (
  <button className={`
    w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-200
    ${active ? 'bg-white text-pink-600 shadow-sm font-semibold' : 'text-stone-600 hover:bg-white/50 hover:text-pink-500'}
  `}>
    {React.cloneElement(icon, { className: `w-5 h-5 ${active ? 'text-pink-500' : ''}` })}
    <span>{label}</span>
  </button>
);

const MCQGrid = ({ num, answers, setAnswers }) => (
  <div className="bg-[#fff5f7] border border-pink-200 rounded-2xl p-4 flex flex-col h-full">
    <h5 className="font-bold text-stone-800 mb-3 border-b border-pink-200 pb-2">1. Trắc nghiệm (ABCD)</h5>
    <div className="flex items-center space-x-2 mb-4">
      <span className="text-sm text-stone-600">Số câu:</span>
      <input type="number" value={num} disabled className="w-16 border border-pink-200 rounded px-4 py-2 text-center bg-gray-100 cursor-not-allowed"/>
    </div>
    <div className="bg-white border border-dashed border-pink-700 rounded-xl p-4 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
      <div className="flex justify-center space-x-4 mb-2 text-xs font-bold text-stone-500 pl-8">
        {["A", "B", "C", "D"].map(o => <span key={o} className="w-4 text-center">{o}</span>)}
      </div>
      {Array.from({ length: num }).map((_, i) => (
        <div key={`mcq-${i}`} className="flex items-center space-x-2 text-sm justify-center mb-2">
          <span className="w-6 text-right font-medium text-stone-600">{i + 1}:</span>
          {["A", "B", "C", "D"].map((opt) => (
            <label key={opt} className="flex items-center space-x-1 cursor-pointer hover:bg-pink-50 p-1 rounded">
              <input
                type="radio"
                name={`mcq-${i}`}
                value={opt}
                checked={answers[i + 1] === opt}
                onChange={() => setAnswers((prev) => ({ ...prev, [i + 1]: opt }))}
                className="w-6 h-6 text-pink-500 border-gray-300 focus:ring-pink-500 accent-pink-500"
              />
              <span className="text-gray-700">{opt}</span>
            </label>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const TFGrid = ({ num, answers, setAnswers }) => (
  <div className="bg-[#fff5f7] border border-pink-200 rounded-2xl p-4 flex flex-col h-full">
    <h5 className="font-bold text-stone-800 mb-3 border-b border-pink-200 pb-2">2. Đúng Sai (abcd)</h5>
    <div className="flex items-center space-x-2 mb-4">
      <span className="text-sm text-stone-600">Số câu:</span>
      <input type="number" value={num} disabled className="w-16 border border-pink-200 rounded px-2 py-1 text-center bg-gray-100 cursor-not-allowed"/>
    </div>
    <div className="bg-white border border-dashed border-pink-300 rounded-xl p-4 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
      <div className="flex justify-center space-x-2 mb-2 text-xs font-bold text-stone-500 pl-8">
        {["a", "b", "c", "d"].map(o => <span key={o} className="w-4 text-center">{o}</span>)}
      </div>
      {Array.from({ length: num }).map((_, i) => (
        <div key={`tf-${i}`} className="flex items-center space-x-2 text-sm justify-center mb-2">
          <span className="w-6 text-right font-medium text-stone-600">{i + 1}:</span>
          {["a", "b", "c", "d"].map((opt) => (
            <label key={opt} className="flex items-center space-x-1 cursor-pointer flex-col">
              <input 
                type="checkbox" 
                checked={answers[i + 1]?.[opt] || false} 
                onChange={(e) => setAnswers(prev => ({
                  ...prev,
                  [i + 1]: { ...prev[i + 1], [opt]: e.target.checked }
                }))}
                className="w-6 h-6 text-pink-800 border-gray-300 rounded focus:ring-pink-500 accent-pink-800"
              />
            </label>
          ))}
        </div>
      ))}
    </div>
  </div>
);

const EssayGrid = ({ num, answers, setAnswers }) => (
  <div className="bg-[#fff5f7] border border-pink-200 rounded-2xl p-4 flex flex-col h-full">
    <h5 className="font-bold text-stone-800 mb-3 border-b border-pink-200 pb-2">3. Tự luận/Điền đáp án</h5>
    <div className="flex items-center space-x-2 mb-4">
      <span className="text-sm text-stone-600">Số câu:</span>
      <input type="number" value={num} disabled className="w-16 border border-pink-200 rounded px-2 py-1 text-center bg-gray-100 cursor-not-allowed"/>
    </div>
    <div className="bg-white border border-dashed border-pink-300 rounded-xl p-4 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
      {Array.from({ length: num }).map((_, i) => (
        <div key={`essay-${i}`} className="flex items-center space-x-2 text-sm mb-2">
          <span className="w-6 text-right font-medium text-stone-600">{i + 1}</span>
          <input 
            type="text" 
            value={answers[i + 1] || ""}
            onChange={(e) => setAnswers(prev => ({ ...prev, [i + 1]: e.target.value }))}
            className="flex-1 border border-pink-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
          />
        </div>
      ))}
    </div>
  </div>
);

export default App;