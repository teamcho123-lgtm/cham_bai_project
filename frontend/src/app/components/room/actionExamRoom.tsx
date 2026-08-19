"use client";

import { Alert, Button, Col, DatePicker, Divider, Empty, Form, Image, Input, InputNumber, Modal, Row, Select, Tag, Upload, type UploadProps, } from "antd";
import { DeleteTwoTone, DiffOutlined, FileExcelOutlined, UserAddOutlined, UserOutlined, } from "@ant-design/icons";
import { useMemo, useState } from "react";
import dayjs from "dayjs";
import * as XLSX from "xlsx";

import { toast } from "react-toastify";
import { handleCreateExamRoom, handleUpdateExamRoom } from "@/app/action";


const examTemplates: IExamModel[] = [
    {
        id: "template-000",
        name: "Mẫu App5 - Phiếu OMR B",
        image: "/Image/image.png",
        mcq: 40,
        tf: 8,
        essay: 12,
        detector: "app",
    },
    {
        id: "template-001",
        name: "Mẫu App1 - THPT Quốc Gia",
        image: "/Image/image1.png",
        mcq: 40,
        tf: 8,
        essay: 6,
        detector: "app1",
    },
    {
        id: "template-002",
        name: "Mẫu App2 - Đánh Giá Năng Lực",
        image: "/Image/image2.png",
        mcq: 24,
        tf: 6,
        essay: 16,
        detector: "app2",
    },
    {
        id: "template-003",
        name: "Mẫu App3 - Cuối Kỳ",
        image: "/Image/image3.png",
        mcq: 120,
        tf: 0,
        essay: 0,
        detector: "app3",
    },
    {
        id: "template-004",
        name: "Mẫu App4 - Phiếu OMR A",
        image: "/Image/image4.png",
        mcq: 40,
        tf: 8,
        essay: 8,
        detector: "app4",
    },
];

const normalizeRoomStatusValue = (status: string) => {
    const normalizedStatus = status.trim().toLocaleLowerCase("vi");

    if (normalizedStatus === "completed" || normalizedStatus === "đã kết thúc") {
        return "completed";
    }

    if (normalizedStatus === "in_progress" || normalizedStatus === "đang thi") {
        return "in_progress";
    }

    return "ready";
};

interface Iprops {
    show: boolean;
    handleClose: () => void;
    dataExam: IExam[]
    dataExamRooms: IExamRoom[];
    dataExamPeriods: IExamPeriod[];
    examCandidates: IExamCandidates[];
    defaultExamRoom: IExamRoom | null
}

interface ImportedStudentRow {
    "Họ Tên"?: unknown;
    "Họ và tên"?: unknown;
    "Tên"?: unknown;
    ten?: unknown;
    SBD?: unknown;
    sbd?: unknown;
    "Lớp"?: unknown;
    Lop?: unknown;
    lop?: unknown;
    className?: unknown;
}

const ShowActionExamRoom = ({ show, handleClose, dataExam, dataExamRooms, dataExamPeriods, examCandidates, defaultExamRoom }: Iprops) => {
    const defaultExam = defaultExamRoom
        ? dataExam.find((exam) => exam.id === defaultExamRoom.examId)
        : undefined

    //KHAI BAO BIEN
    const [name, setName] = useState<string>(defaultExamRoom?.name ?? "")
    const [subjects, setSubjects] = useState<string>(defaultExamRoom?.subjects ?? "")
    const [grade, setGrade] = useState<number>(defaultExamRoom?.grade ?? 0)
    const [status, setStatus] = useState<string>(
        defaultExamRoom ? normalizeRoomStatusValue(defaultExamRoom.status) : ""
    )
    const [durationMinutes, setDurationMinutes] = useState<number | null>(
        defaultExamRoom?.durationMinutes ?? null
    )
    const [showTemplates, setShowTemplates] = useState<boolean>(false)
    const [startAt, setStartAt] = useState<dayjs.Dayjs | null>(
        defaultExamRoom ? dayjs(defaultExamRoom.startAt) : null
    )
    const [examTemplateSelected, setExamTemplateSelected] = useState<IExamModel | null>(
        examTemplates.find((template) => template.id === defaultExam?.templateId) ?? null
    )
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

    const [stuName, setStuName] = useState<string>("")
    const [stuCode, setStuCode] = useState<string>("")
    const [stuClass, setStuClass] = useState<string>("")
    const [stulist, setStuList] = useState<IExamCandidates[]>(
        defaultExamRoom
            ? examCandidates.filter((candidate) => candidate.examRoomId === defaultExamRoom.id)
            : []
    )

    const resetForm = () => {
        setName("")
        setSubjects("")
        setGrade(0)
        setStatus("")
        setDurationMinutes(null)
        setStartAt(null)
        setExamTemplateSelected(null)
        setShowTemplates(false)
        setStuName("")
        setStuCode("")
        setStuClass("")
        setStuList([])
    }

    const closeModal = () => {
        resetForm()
        handleClose()
    }

    //USEMEMO
    const { examRoomId, examId } = useMemo(() => {

        if (defaultExamRoom) {
            return {
                examRoomId: defaultExamRoom.id,
                examId: defaultExamRoom.examId,
            }
        }

        //id
        let nextId = dataExamRooms.length + 1;
        let nextExamRoomId = `room-${String(nextId).padStart(3, "0")}`;
        while (
            dataExamRooms.some((data) => data.id === nextExamRoomId)
        ) {
            nextId += 1;
            nextExamRoomId = `room-${String(nextId).padStart(3, "0")}`;
        }

        // exams
        let nextNumberExam = dataExam.length + 1;
        let nextExamId = `exam-${String(nextNumberExam).padStart(3, "0")}`;
        while (
            dataExam.some((data) => data.id === nextExamId)
        ) {
            nextNumberExam += 1;
            nextExamId = `exam-${String(nextNumberExam).padStart(3, "0")}`;
        }

        return {
            examRoomId: nextExamRoomId,
            examId: nextExamId,
        }
    }, [dataExamRooms, dataExam, defaultExamRoom])

    //SHOWSTUDENTLIST 
    const showCreateStudent = () => {
        return stulist.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 py-6">
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Chưa có học sinh nào"
                />
            </div>) : (<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {stulist.map((stu, index) =>
                    <div key={stu.id} className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200 bg-[#fffafa] p-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#d75d73] shadow-sm">
                                <UserOutlined />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="m-0 text-xs text-stone-400">Học sinh {index + 1}</p>
                                <p className="m-0 truncate font-semibold text-stone-700">{stu.studentName}</p>
                                <p className="m-0 truncate text-xs text-stone-500">SBD: {stu.sbd} · Lớp: {stu.className}</p>
                            </div>
                            <Button
                                type="text"
                                aria-label={`Xóa ${stu.studentName}`}
                                onClick={() => handleDeleteStudent(stu.id)}
                            >
                                <DeleteTwoTone twoToneColor="#ff0000" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>)
    }


    //HANDLE ACTION
    const handleCreateStudent = () => {
        const studentName = stuName.trim();
        const studentCode = stuCode.trim();
        const studentClass = stuClass.trim();

        if (!studentName || !studentCode || !studentClass) {
            toast.error("Vui lòng nhập đầy đủ thông tin Học sinh nếu muốn thêm !")
            return
        }

        if (!/^\d+$/.test(studentCode)) {
            toast.error("Số báo danh chỉ được chứa chữ số")
            return
        }

        const allCandidates = [...examCandidates, ...stulist];
        const isDuplicateSbd = allCandidates.some(
            (student) => student.sbd.trim() === studentCode
        );

        if (isDuplicateSbd) {
            toast.error("Số báo danh đã tồn tại trong danh sách thí sinh !")
            return
        }

        let nextCandidateNumber = 1;
        let nextCandidateId = `candidate-${String(nextCandidateNumber).padStart(3, "0")}`;

        while (allCandidates.some((student) => student.id === nextCandidateId)) {
            nextCandidateNumber += 1;
            nextCandidateId = `candidate-${String(nextCandidateNumber).padStart(3, "0")}`;
        }

        const newStudent: IExamCandidates = {
            id: nextCandidateId,
            examRoomId: examRoomId,
            studentId: `student-${String(nextCandidateNumber).padStart(3, "0")}`,
            studentName,
            className: studentClass,
            sbd: studentCode,
            status: "registered"
        }

        setStuList((previousStudents) => [...previousStudents, newStudent])
        setStuName("")
        setStuCode("")
        setStuClass("")
        toast.success("Đã thêm học sinh vào phòng thi")
    }

    const handleDeleteStudent = (studentId: string) => {
        setStuList((previousStudents) =>
            previousStudents.filter((student) => student.id !== studentId)
        )
    }

    const handleSubmtActionExamRoom = async () => {
        const currentPeriod = dataExamPeriods[0];
        const normalizedName = name.trim();
        const normalizedSubject = subjects.trim();

        if (!currentPeriod) {
            toast.error("Không tìm thấy thông tin kỳ thi")
            return
        }

        if (!normalizedName) {
            toast.error("Vui lòng nhập tên phòng thi")
            return
        }

        if (!normalizedSubject) {
            toast.error("Vui lòng nhập môn thi")
            return
        }

        if (!grade || !currentPeriod.gradeLevels.includes(grade)) {
            toast.error("Vui lòng chọn khối thi hợp lệ")
            return
        }

        if (!status) {
            toast.error("Vui lòng chọn trạng thái phòng thi")
            return
        }

        if (!startAt || !startAt.isValid()) {
            toast.error("Vui lòng chọn ngày và giờ bắt đầu")
            return
        }

        if (!durationMinutes || durationMinutes <= 0) {
            toast.error("Thời lượng thi phải lớn hơn 0 phút")
            return
        }

        if (!examTemplateSelected) {
            toast.error("Vui lòng chọn mẫu phiếu chấm bài")
            return
        }

        if (stuName.trim() || stuCode.trim() || stuClass.trim()) {
            toast.error("Thông tin học sinh đang nhập chưa được thêm vào danh sách")
            return
        }

        const periodStart = dayjs(currentPeriod.startDate).startOf("day");
        const periodEnd = dayjs(currentPeriod.endDate).endOf("day");

        // if (
        //     !periodStart.isValid()
        //     || !periodEnd.isValid()
        //     || startAt.isBefore(periodStart)
        //     || startAt.isAfter(periodEnd)
        // ) {
        //     toast.error("Thời gian thi phải nằm trong thời gian diễn ra kỳ thi")
        //     return
        // }

        const newEndAt = startAt.add(durationMinutes, "minute");

        if (!defaultExamRoom && startAt.isBefore(dayjs())) {
            toast.error("Không thể tạo ca thi có thời gian bắt đầu trong quá khứ")
            return
        }

        if (newEndAt.isAfter(periodEnd)) {
            toast.error("Thời gian kết thúc ca thi vượt quá thời gian của kỳ thi")
            return
        }

        const hasScheduleConflict = dataExamRooms.some((room) => {
            if (
                room.periodId !== currentPeriod.id
                || room.id === defaultExamRoom?.id
                || room.name.trim().toLocaleLowerCase("vi") !== normalizedName.toLocaleLowerCase("vi")
            ) {
                return false;
            }

            const existingStartAt = dayjs(room.startAt);
            const existingEndAt = existingStartAt.add(room.durationMinutes, "minute");

            return existingStartAt.isBefore(newEndAt) && existingEndAt.isAfter(startAt);
        });

        if (hasScheduleConflict) {
            toast.error("Phòng thi này đã có ca thi trùng thời gian")
            return
        }

        const currentTime = dayjs().format("YYYY-MM-DDTHH:mm:ssZ");
        const formattedStartAt = startAt.format("YYYY-MM-DDTHH:mm:ssZ");
        const currentExam = dataExam.find((exam) => exam.id === examId)

        const newExamRoom = {
            id: examRoomId,
            examId: examId,
            periodId: currentPeriod.id,
            grade: grade,
            name: normalizedName,
            subjects: normalizedSubject,
            startAt: formattedStartAt,
            durationMinutes: durationMinutes,
            status: status
        }

        const newExam = {
            id: examId,
            name: normalizedName,
            scopeType: "school",
            examPeriodId: currentPeriod.id,
            examRoomId: examRoomId,
            subjects: normalizedSubject,
            teacherId: "teacher-001",
            templateId: examTemplateSelected.id,
            gradeLevel: grade,
            examDate: formattedStartAt,
            durationMinutes: durationMinutes,
            note: "",
            status: currentExam?.status ?? "draft",
            createdAt: currentExam?.createdAt ?? currentTime,
            updatedAt: currentTime
        }

        const newAnswerSheetTemplate: IAnswerSheetTemplate = {
            id: examId,
            examId: examId,
            templateId: examTemplateSelected.id,
            examPeriodId: currentPeriod.id,
            name: `Phiếu đáp án - ${normalizedName}`,
            description: "Mẫu đáp án của bài thi toàn trường",
            detector: {
                name: examTemplateSelected.detector,
                version: "1.0.0",
            },
            questionCount: {
                mcq: examTemplateSelected.mcq,
                trueFalse: examTemplateSelected.tf,
                shortAnswer: examTemplateSelected.essay,
            },
            answerKeys: {},
            createdAt: currentExam?.createdAt ?? currentTime,
            updatedAt: currentTime,
        }

        setIsSubmitting(true)

        try {
            const res = defaultExamRoom
                ? await handleUpdateExamRoom(defaultExamRoom.id, newExamRoom, newExam, newAnswerSheetTemplate, stulist)
                : await handleCreateExamRoom(newExamRoom, newExam, newAnswerSheetTemplate, stulist)

            if (res?.success === true) {
                toast.success(res.message)
                closeModal()
            } else {
                toast.error(
                    res?.message
                    ?? (defaultExamRoom ? "Cập nhật phòng thi thất bại" : "Thêm phòng thi thất bại")
                )
            }
        } finally {
            setIsSubmitting(false)
        }
    }

    ///HANDLE SELECT FILE
    const handleFileUpload: NonNullable<UploadProps["beforeUpload"]> = async (file) => {
        const fileExtension = file.name
            .slice(file.name.lastIndexOf("."))
            .toLowerCase();

        if (fileExtension !== ".xlsx" && fileExtension !== ".xls") {
            toast.error("Chỉ hỗ trợ file Excel .xlsx hoặc .xls");
            return false;
        }

        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];

            if (!sheetName) {
                toast.error("File Excel không có sheet dữ liệu.");
                return false;
            }

            const worksheet = workbook.Sheets[sheetName];
            const parsedData = XLSX.utils.sheet_to_json<ImportedStudentRow>(worksheet, {
                defval: "",
                raw: false,
            });

            const importedStudents = parsedData
                .map((row) => ({
                    name: String(
                        row["Họ Tên"] ??
                        row["Họ và tên"] ??
                        row["Tên"] ??
                        row.ten ??
                        ""
                    ).trim(),
                    sbd: String(row.SBD ?? row.sbd ?? "").trim(),
                    className: String(
                        row["Lớp"] ??
                        row.Lop ??
                        row.lop ??
                        row.className ??
                        ""
                    ).trim(),
                }))
                .filter(
                    (student) =>
                        student.name &&
                        student.sbd &&
                        student.className &&
                        /^\d+$/.test(student.sbd)
                );

            if (importedStudents.length === 0) {
                toast.warning("Không tìm thấy dữ liệu Họ tên, SBD và Lớp hợp lệ trong file Excel.");
                return false;
            }

            const knownCandidates = [...examCandidates, ...stulist];
            const usedCandidateIds = new Set(
                knownCandidates.map((candidate) => candidate.id)
            );
            const usedStudentIds = new Set(
                knownCandidates.map((candidate) => candidate.studentId)
            );
            const usedSbds = new Set(
                knownCandidates.map((candidate) => candidate.sbd.trim())
            );
            let nextCandidateNumber = 1;
            let duplicateCount = 0;
            const newStudents: IExamCandidates[] = [];

            importedStudents.forEach((student) => {
                if (usedSbds.has(student.sbd)) {
                    duplicateCount += 1;
                }

                let candidateId = "";
                let studentId = "";

                do {
                    const suffix = String(nextCandidateNumber).padStart(3, "0");
                    candidateId = `candidate-${suffix}`;
                    studentId = `student-${suffix}`;
                    nextCandidateNumber += 1;
                } while (
                    usedCandidateIds.has(candidateId) ||
                    usedStudentIds.has(studentId)
                );

                usedCandidateIds.add(candidateId);
                usedStudentIds.add(studentId);
                usedSbds.add(student.sbd);

                newStudents.push({
                    id: candidateId,
                    examRoomId,
                    studentId,
                    studentName: student.name,
                    className: student.className,
                    sbd: student.sbd,
                    status: "registered",
                });
            });

            setStuList((previousStudents) => [
                ...previousStudents,
                ...newStudents,
            ]);

            toast.success(`Đã nhập ${newStudents.length} học sinh từ Excel.`);

            if (duplicateCount > 0) {
                toast.info(`Đã bỏ qua ${duplicateCount} số báo danh bị trùng.`);
            }
        } catch (error) {
            console.error("Không thể đọc file Excel:", error);
            toast.error("Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file.");
        }

        // Ngăn Ant Design tự động tải file lên server.
        return false;
    }
    // console.log(defaultExamRoom)

    return (
        <Modal
            title={defaultExamRoom ? "Cập nhật ca thi và phòng thi" : "Tạo ca thi và phòng thi"}
            onCancel={() => {
                if (!isSubmitting) closeModal()
            }}
            open={show}
            footer={null}
            width={900}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 4 } }}
        >
            <Form layout="vertical" autoComplete="off">
                <Divider titlePlacement="start">Thông tin ca thi</Divider>

                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Form.Item label="Tên phòng thi">
                            <Input
                                value={name}
                                placeholder="Ví dụ: Phòng 101 "
                                onChange={(event) => setName(event.target.value)}
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                        <Form.Item label="Môn thi">
                            <Input
                                value={subjects}
                                placeholder="Chọn môn thi"
                                onChange={(event) => setSubjects(event.target.value)}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col xs={24} md={12}>
                        <Form.Item label="Khối thi">
                            <Select
                                value={grade ?? undefined}
                                onChange={setGrade}
                                placeholder="Chọn khối thi"
                                options={(dataExamPeriods[0]?.gradeLevels ?? []).map((grade) => ({
                                    value: grade,
                                    label: `Khối ${grade}`,
                                }))}
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} md={12}>
                        <Form.Item label="Trạng thái">
                            <Select
                                value={status ?? undefined}
                                onChange={setStatus}
                                placeholder="Chọn trạng thái"
                                options={
                                    [
                                        { value: "ready", label: "Sẵn sàng" },
                                        { value: "in_progress", label: "Đang thi" },
                                        { value: "completed", label: "Đã kết thúc" },
                                    ]
                                }
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col xs={24} md={16}>
                        <Form.Item label="Ngày và giờ bắt đầu">
                            <DatePicker
                                value={startAt}
                                showTime
                                className="w-full"
                                format="DD/MM/YYYY HH:mm"
                                placeholder="Chọn ngày và giờ thi"
                                onChange={(value) => setStartAt(value)}
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} md={8}>
                        <Form.Item label="Thời lượng">
                            <InputNumber
                                value={durationMinutes}
                                onChange={(value) => setDurationMinutes(value)}
                                className="w-full"
                                min={1}
                                placeholder="90"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Divider titlePlacement="start">Mẫu phiếu chấm bài</Divider>

                {examTemplateSelected ? (
                    <div className="rounded-2xl border border-pink-100 bg-[#fff9fa] p-4 shadow-sm">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 flex-1">
                                <Tag color="success" className="!mb-2 !rounded-full">
                                    Mẫu đã chọn
                                </Tag>
                                <h3 className="mb-3 text-lg font-bold text-stone-800">
                                    {examTemplateSelected.name}
                                </h3>

                                <div className="grid grid-cols-3 gap-2 text-sm">
                                    <div className="rounded-lg bg-white px-3 py-2">
                                        <div className="text-xs text-stone-400">Trắc nghiệm</div>
                                        <div className="font-semibold text-stone-700">{examTemplateSelected.mcq} câu</div>
                                    </div>
                                    <div className="rounded-lg bg-white px-3 py-2">
                                        <div className="text-xs text-stone-400">Đúng/Sai</div>
                                        <div className="font-semibold text-stone-700">{examTemplateSelected.tf} câu</div>
                                    </div>
                                    <div className="rounded-lg bg-white px-3 py-2">
                                        <div className="text-xs text-stone-400">Trả lời ngắn</div>
                                        <div className="font-semibold text-stone-700">{examTemplateSelected.essay} câu</div>
                                    </div>
                                </div>

                                <Button
                                    className="!mt-4 !border-[#8f3c4a] !text-[#8f3c4a]"
                                    icon={<DiffOutlined />}
                                    onClick={() => setShowTemplates(true)}
                                >
                                    Đổi mẫu phiếu
                                </Button>
                            </div>

                            <div className="flex shrink-0 justify-center rounded-xl bg-white p-2">
                                <Image
                                    src={examTemplateSelected.image}
                                    alt={examTemplateSelected.name}
                                    width={130}
                                    height={170}
                                    loading="eager"
                                    className="h-[170px] w-[130px] rounded-lg object-contain"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowTemplates(true)}
                        className="flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#dca4ad] bg-[#fff7f8] px-5 py-7 text-center transition hover:border-[#8f3c4a] hover:bg-[#fff0f2]"
                    >
                        <DiffOutlined className="mb-3 text-3xl text-[#8f3c4a]" />
                        <span className="font-semibold text-stone-700">Chọn mẫu phiếu chấm bài</span>
                        <span className="mt-1 text-sm text-stone-400">Chọn mẫu OMR phù hợp với cấu trúc đề thi</span>
                    </button>
                )}

                <Divider titlePlacement="start">Danh sách thí sinh</Divider>

                <Upload.Dragger
                    accept=".xlsx,.xls"
                    beforeUpload={handleFileUpload}
                    showUploadList={false}
                    className="!block !rounded-2xl [&_.ant-upload-drag]:!border-[#e6b8c1] [&_.ant-upload-drag]:!bg-[#fff7f8]"
                >
                    <FileExcelOutlined className="mb-3 text-3xl text-[#8f3c4a]" />
                    <div className="font-semibold text-stone-700">
                        Tải danh sách học sinh từ Excel
                    </div>
                    <div className="mt-1 text-sm text-stone-400">
                        File gồm các cột: Họ tên, SBD và Lớp
                    </div>
                </Upload.Dragger>

                <Alert
                    className="!mt-4 !rounded-xl"
                    type="error"
                    showIcon
                    description="Nếu file bị lỗi hoặc thiếu học sinh, thầy/cô có thể thêm học sinh thủ công bên dưới."
                />

                <Row gutter={[12, 12]} className="mt-4">
                    <Col xs={24} md={8}>
                        <Form.Item className="!mb-0">
                            <Input
                                value={stuName}
                                onChange={(event) => setStuName(event.target.value)}
                                onPressEnter={handleCreateStudent}
                                placeholder="Nhập họ và tên học sinh"
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12} md={5}>
                        <Form.Item className="!mb-0">
                            <Input
                                value={stuCode}
                                onChange={(event) => setStuCode(event.target.value)}
                                onPressEnter={handleCreateStudent}
                                placeholder="Nhập SBD"
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12} md={5}>
                        <Form.Item className="!mb-0">
                            <Input
                                value={stuClass}
                                onChange={(event) => setStuClass(event.target.value)}
                                onPressEnter={handleCreateStudent}
                                placeholder="Nhập lớp, ví dụ 10A1"
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} md={6}>
                        <Button
                            block
                            onClick={handleCreateStudent}
                            icon={<UserAddOutlined />}
                            className="!border-none !bg-[#8f3c4a] !text-white hover:!bg-[#74313d]"
                        >
                            Thêm học sinh
                        </Button>
                    </Col>
                </Row>

                <div className="mt-4 min-h-32 rounded-2xl border border-stone-200 bg-white p-4">
                    {showCreateStudent()}
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-stone-100 pt-4">
                    <Button disabled={isSubmitting} onClick={closeModal}>Hủy</Button>
                    <Button
                        onClick={() => handleSubmtActionExamRoom()}
                        loading={isSubmitting}
                        type="primary"
                        className="!border-none !bg-[#8f3c4a] hover:!bg-[#74313d]"
                    >
                        {defaultExamRoom ? "Cập nhật ca thi" : "Lưu ca thi"}
                    </Button>
                </div>
            </Form>

            <Modal
                title="Danh sách mẫu phiếu chấm bài"
                open={showTemplates}
                onCancel={() => setShowTemplates(false)}
                footer={null}
                width="calc(100vw - 32px)"
                style={{ top: 16, maxWidth: 1400 }}
                styles={{ body: { maxHeight: "calc(100vh - 110px)", overflowY: "auto" } }}
                destroyOnHidden
            >
                <p className="mb-6 text-stone-500">
                    Chọn mẫu phiếu phù hợp với cấu trúc đề thi của ca này.
                </p>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {examTemplates.map((template) => (
                        <div
                            key={template.id}
                            className={`overflow-hidden rounded-2xl border bg-[#fff9fa] transition hover:-translate-y-1 hover:shadow-xl ${examTemplateSelected?.id === template.id
                                ? "border-[#8f3c4a] ring-2 ring-[#8f3c4a]/20"
                                : "border-pink-100"
                                }`}
                        >
                            <div className="flex h-[310px] items-center justify-center bg-white p-4">
                                <Image
                                    src={template.image}
                                    alt={template.name}
                                    width={230}
                                    height={290}
                                    loading="eager"
                                    className="h-full w-full object-contain"
                                />
                            </div>

                            <div className="p-5">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#d75d73]">
                                    {template.id}
                                </div>
                                <h3 className="mb-4 text-lg font-bold text-stone-800">
                                    {template.name}
                                </h3>

                                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                                    <div className="rounded-lg bg-white px-2 py-2">
                                        <div className="text-xs text-stone-400">Trắc nghiệm</div>
                                        <strong>{template.mcq}</strong>
                                    </div>
                                    <div className="rounded-lg bg-white px-2 py-2">
                                        <div className="text-xs text-stone-400">Đúng/Sai</div>
                                        <strong>{template.tf}</strong>
                                    </div>
                                    <div className="rounded-lg bg-white px-2 py-2">
                                        <div className="text-xs text-stone-400">Trả lời ngắn</div>
                                        <strong>{template.essay}</strong>
                                    </div>
                                </div>

                                <Button
                                    block
                                    type="primary"
                                    className="!mt-5 !h-10 !border-none !bg-[#8f3c4a] hover:!bg-[#74313d]"
                                    onClick={() => {
                                        setExamTemplateSelected(template);
                                        setShowTemplates(false);
                                    }}
                                >
                                    {examTemplateSelected?.id === template.id
                                        ? "Đang sử dụng mẫu này"
                                        : "Chọn mẫu này"}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>
        </Modal>
    );
};

export default ShowActionExamRoom;
