"use client"

import { handleCreateExamInClassAction, handleUpdateExamInClassAction } from "@/app/action";
import { DiffOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface IExamBasic {
    id: string;
    name: string;

    classId: string;
    subjectId: string;
    teacherId: string;
    templateId: string;

    createdAt: string;
    updatedAt: string;

    note: string;

    status: "draft";
}

interface IProps {
    show: boolean;
    handleClose: () => void;
    classroom: IClassRoom;
    listDefaultExams: IExamBasic | null;
    listAllExamps: IExam[] | [];
}

interface IExamModel {
    id: string;
    name: string;
    image: string;
    mcq: number;
    tf: number;
    essay: number;
    detector: string;
}

const showActionListExamps = (props: IProps) => {
    const { show, handleClose, classroom, listDefaultExams, listAllExamps } = props

    const [showTemplates, setShowTemplates] = useState<boolean>(false)

    const [exampModelSelect, setExampModelSelect] = useState<IExamModel | null>(null);

    const [newExamId, setNewExamId] = useState<string>("")
    const [examName, setExamName] = useState<string>("")
    const [templateID, setTemplateID] = useState<string>("")
    const [subjectId, setSubjectId] = useState<string>("")

    const templates = [
        {
            id: "template-000",
            name: "Mẫu App5 - Phiếu OMR B",
            image: "/Image/image.png",

            mcq: 40,
            tf: 8,
            essay: 12,

            detector: "app"
        },
        {
            id: "template-001",
            name: "Mẫu App1 - THPT Quốc Gia",
            image: "/Image/image1.png",

            mcq: 40,
            tf: 8,
            essay: 6,

            detector: "app1" // file xử lý
        },

        {
            id: "template-002",
            name: "Mẫu App2 - Đánh Giá Năng Lực",
            image: "/Image/image2.png",

            mcq: 24,
            tf: 6,
            essay: 16,

            detector: "app2"
        },

        {
            id: "template-003",
            name: "Mẫu App3 - Cuối Kỳ",
            image: "/Image/image3.png",

            mcq: 120,
            tf: 0,
            essay: 0,

            detector: "app3"
        },

        {
            id: "template-004",
            name: "Mẫu App4 - Phiếu OMR A",
            image: "/Image/image4.png",

            mcq: 40,
            tf: 8,
            essay: 8,

            detector: "app4"
        },


    ];

    useEffect(() => {
        if (listDefaultExams) {
            return;
        }

        // Luôn bắt đầu kiểm tra từ exam-001
        let nextNumber = 1;

        let nextId = `exam-${String(nextNumber).padStart(3, "0")}`;

        while (
            listAllExamps.some((exam) => {
                return exam.id === nextId;
            })
        ) {
            nextNumber = nextNumber + 1;

            nextId = `exam-${String(nextNumber).padStart(3, "0")}`;
        }

        setNewExamId(nextId);
    }, [listDefaultExams, listAllExamps]);

    useEffect(() => {
        if (listDefaultExams) {
            const templateSelected = templates.find(
                (temp) =>
                    temp.id === listDefaultExams?.templateId
            );

            setExamName(listDefaultExams.name)
            setTemplateID(listDefaultExams.templateId)
            setExampModelSelect(templateSelected ? templateSelected : null)
        } else {
            setExamName("")
            setTemplateID("")
        }
    }, [listDefaultExams])

    const showExampsModel = () => {
        return (
            <Modal
                open={showTemplates}
                onCancel={() => handleCloseExampsModel()}
                footer={null}
                width="calc(100vw - 32px)"
                style={{ top: 16, maxWidth: "1400px", paddingBottom: 0, }}
                styles={{ body: { padding: 0, maxHeight: "calc(100vh - 32px)", overflowY: "auto", }, }}
                destroyOnHidden
            >
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-stone-700">Danh sách mẫu đề thi</h3>
                    <p className="text-gray-500">Chọn một mẫu phiếu để tạo đáp án </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {templates.map((temp, index) => {
                        return (
                            <div key={index} className="bg-[#fff5f7] border border-pink-200 rounded-xl overflow-hidden hover:shadow-xl transition cursor-pointer">
                                <img src={temp.image} className="w-full h-[400px] object-cover" />
                                <div className="p-5">
                                    <h2 className="font-bold text-lg mb-3 text-blue-600">{temp.name}</h2>
                                    <div className="space-y-1 text-gray-500">
                                        <p>Trắc nghiệm: {temp.mcq} </p>
                                        <p>Đúng/Sai: {temp.tf}</p>
                                        <p>Tự luận: {temp.essay}</p>
                                    </div>
                                    <button className="w-full mt-5 bg-[#723340] hover:bg-[#5a2732] text-white py-3 rounded-xl font-semibold"
                                        onClick={() => handleSelectModal(temp)}
                                    >
                                        Chọn mẫu này
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </Modal>
        )
    }

    const handleSelectModal = (temp: IExamModel) => {
        setExampModelSelect(null)
        setExampModelSelect(temp)
        setShowTemplates(false)

    }

    const handleCloseCreateModel = () => {
        handleClose()
        setExampModelSelect(null)
    }

    const handleCloseExampsModel = () => {
        setShowTemplates(false)
    }

    const showModelSelect = (temp: IExamModel) => {
        return (
            <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <span className="mb-2 inline-block rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-600">Mẫu đã chọn</span>
                        <h2 className="mb-4 text-lg font-bold text-stone-800">{temp.name}</h2>
                        <div className="grid max-w-md grid-cols-1 gap-2 text-sm text-stone-600 sm:grid-cols-3">
                            <div className="rounded-lg bg-stone-50 px-3 py-2">
                                <p className="m-0 text-xs text-stone-400">Trắc nghiệm</p>
                                <p className="m-0 font-semibold text-stone-700">{temp.mcq} câu</p>
                            </div>
                            <div className="rounded-lg bg-stone-50 px-3 py-2">
                                <p className="m-0 text-xs text-stone-400">Đúng/Sai</p>
                                <p className="m-0 font-semibold text-stone-700">{temp.tf} câu</p>
                            </div>
                            <div className="rounded-lg bg-stone-50 px-3 py-2">
                                <p className="m-0 text-xs text-stone-400">Tự luận</p>
                                <p className="m-0 font-semibold text-stone-700">{temp.essay} câu</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex shrink-0 justify-center rounded-xl bg-[#fff5f7] p-3">
                        <img src={temp.image} className="h-[260px] w-[220px] rounded-lg object-contain" />
                    </div>
                </div>
            </div>
        )
    }

    const handleCreateListExams = async () => {

        if (!examName) {
            toast.error("Vui lòng nhập tên đợt thi !")
            return
        }

        if (!exampModelSelect?.id) {
            toast.error("Vui lòng chọn mẫu đề để chấm bài !")
            return
        }

        const currentTime = dayjs().format(
            "YYYY-MM-DDTHH:mm:ssZ"
        );

        const isUpdate = listDefaultExams !== null;
        const examId = isUpdate ? listDefaultExams.id : newExamId;
        const answerSheetId = isUpdate ? listDefaultExams.id : examId;

        const dataNewLE = {
            id: newExamId,
            name: examName,
            classId: classroom.id,
            subjectId: subjectId,
            teacherId: classroom.createdByTeacherId,
            templateId: exampModelSelect?.id,
            createdAt: listDefaultExams?.createdAt || currentTime,
            updatedAt: currentTime,
            note: "",
            status: "draft",
        };

        const answerSheetData = {
            id: answerSheetId,
            templateId: exampModelSelect?.id,
            classId: classroom.id,
            name: examName,
            description: "",

            detector: {
                name: exampModelSelect?.detector ?? "",
                version: "1.0.0",
            },

            questionCount: {
                mcq: exampModelSelect.mcq,
                trueFalse: exampModelSelect.tf,
                shortAnswer:
                    exampModelSelect.essay,
            },

            answerKeys: {},

            createdAt: currentTime,
            updatedAt: currentTime,
        };

        if (listDefaultExams === null) {
            const res = await handleCreateExamInClassAction(dataNewLE, answerSheetData);
            res?.success == true ? toast.success("Thêm đợt thi thành công :)") : toast.error("Thêm đợt thi thất bại :(")
        } else {
            const res = await handleUpdateExamInClassAction(listDefaultExams.id, dataNewLE);
            res?.success == true ? toast.success("Update đợt thi thành công :)") : toast.error("Update đợt thi thất bại :(")
        }

        setExamName("")
        setTemplateID("")
        setExampModelSelect(null)
        handleClose()
    }

    // console.log(classroom.id)


    return (
        <>
            <Modal
                title="Thêm danh sách đợt thi"
                open={show}
                onOk={handleCreateListExams}
                width={exampModelSelect !== null ? "calc(100vw - 32px)" : undefined}
                styles={{ body: { padding: 0, maxHeight: "calc(100vh - 32px)", overflowY: "auto", }, }}
                onCancel={() => handleCloseCreateModel()}
                okText="Đồng ý"
                cancelText="Hủy"
            >
                <Form layout="vertical" >
                    <Form.Item label="Tên đợt thi">
                        <Input
                            placeholder="Nhập tên đợt thi"
                            value={examName}
                            onChange={(event) => {
                                setExamName(event.target.value);
                            }}
                        />
                    </Form.Item>

                    <Form.Item label="Chọn mẫu đề chấm">
                        <Button icon={<DiffOutlined />}
                            style={{ background: "#97616c", color: "white" }}
                            onClick={() => setShowTemplates(true)}>Chọn mẫu phiếu chấm bài</Button>
                    </Form.Item>

                </Form>
                {exampModelSelect && showModelSelect(exampModelSelect)}
            </Modal>
            {showExampsModel()}


        </>
    )
}

export default showActionListExamps;

// 60038578
// 73525912
// 69017856
// 72510513
// 71290581
// 30171135
// 71387251
// 22001162
// 22110037