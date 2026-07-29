"use client"

import { DeleteTwoTone, EditTwoTone } from "@ant-design/icons";
import { Button, ConfigProvider, Modal, Popconfirm, Space, Table } from "antd";
import dayjs from "dayjs";
import { Edit, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import ShowExamsInput from "./examinput";
import { useRouter } from "next/navigation";

interface IAnswer {
    mcq: Record<string, string>;

    trueFalse: Record<string, Record<string, boolean>>;

    shortAnswer: Record<string,
        {
            answer: string;
            acceptedAnswers: string[];
            numericValue: number;
            tolerance: number;
        }
    >;
}

interface IAnswerSheetTemplates {
    allCodeExams: IAnswerSheetTemplate;
}

const ShowExamsCode = (props: IAnswerSheetTemplates) => {
    const { allCodeExams } = props;

    const router = useRouter();

    const [allAnswer, setAllAnswer] = useState<[string, IAnswer][]>([]);

    const [openModel, setOpenModal] = useState<boolean>(false)

    const [showInputModel, setShowInputModel] = useState<boolean>(false)

    const [defaultAnswerCode, setDefaultAnswerCode] = useState<string | null>(null);

    const [defaultAnswerExam, setDefaultAnswerExam] = useState<IAnswer | null>(null);


    const tableData = allAnswer.map(([code, answers]) => ({
        id: code,
        code,
        answers,
    }));

    useEffect(() => {
        if (!allCodeExams?.answerKeys) {
            return;
        }

        const answers = Object.entries(allCodeExams.answerKeys) as [string, IAnswer][];
        setAllAnswer(answers)
    }, [allCodeExams])

    const columns = [
        {
            title: "Mã đề",
            dataIndex: "code",
            align: "center" as const,
            render: (code: string) => (
                <span className="font-bold text-pink-700">{code}</span>
            ),
        },
        {
            title: "Đáp án",
            dataIndex: "structure",
            align: "center" as const,
            render: (_value: unknown, record: {
                id: string;
                code: string;
                answers: IAnswer;
            }) => (
                <div className="space-y-4">
                    <div>
                        <div className="flex gap-2 mt-1" style={{ display: "flex", justifyContent: "center" }}>
                            {Object.entries(record.answers.mcq ?? {}).map(([question, answer]) => (
                                <span key={question} className="text-xs px-1 py-1 rounded-md bg-pink-50 text-pink-900">{question} : {answer}</span>))}
                        </div>
                    </div>
                    <div>
                        {Object.entries(
                            record.answers.trueFalse ?? {}).map(([question, statements]) => (
                                <p key={question} className="px-2 py-1 rounded-md text-stone-700 mt-1" >
                                    {question} : {" "}
                                    {Object.entries(statements).map(([statement, value]) => `${statement} : ${value ? "Đúng" : "Sai"}`).join(" , ")}
                                </p>
                            ))}
                    </div>
                    <div>
                        {Object.entries(record.answers.shortAnswer ?? {}).map(([question, answerData]) => (
                            <div key={question} className="text-stone-700 mt-1">
                                <p>{question} :{"  "} <span> {answerData.answer}</span></p>
                            </div>
                        ))}
                    </div>
                </div>
            ),
        }
    ];

    const handleCreateAnswerCode = () => {
        setDefaultAnswerCode(null);
        setOpenModal(false);
        setShowInputModel(true);
    };

    const handleUpdateAnswerCode = (code: string, answer: IAnswer) => {
        setDefaultAnswerExam(answer);
        setDefaultAnswerCode(code);
        setShowInputModel(true);
    };

    const handleCloseModelInput = () => {
        setShowInputModel(false);
        setDefaultAnswerCode(null);
    };


    const handleShowInput = () => {
        return (
            <Modal
                title="Chọn phương thức Import đối với mã đề "
                open={openModel}
                // onOk={() => handleSubmitDelete()}
                styles={{ body: { padding: 0, height: "70px", overflowY: "auto", }, }}
                onCancel={() => setOpenModal(false)}
                footer={[<Button key="cancel" onClick={() => setOpenModal(false)}>Hủy</Button>]}
            >
                <div style={{ display: "flex", justifyContent: "center", marginTop: "20px", gap: "20px" }}>
                    <Button
                        onClick={() => setShowInputModel(true)}
                    >Hiện bảng và thêm thủ công</Button>
                    <Button>Import File đáp án từng mã đề</Button>
                </div>
            </Modal>
        )
    }

    const handleOpenExamCode = (code: string) => {
        router.push(`/class/${allCodeExams.id}/exams/${code}`);
    };

    return (
        <>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-stone-800">Quản Lý Mã Đề & Đáp Án Chi Tiết</h2>
                <button
                    onClick={() => setOpenModal(true)}
                    className="bg-pink-400 hover:bg-pink-500 text-white px-4 py-1.5 rounded-lg font-medium transition shadow-sm"
                > + Thêm mã đề</button>
            </div>

            {/* <div className="bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden"></div> */}

            {/* Bảng Mã Đề */}
            <div className="bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-center">
                        <thead className="bg-[#ffe4e9] text-stone-700">
                            <tr style={{ color: "#9d174d" }} >
                                <th className="py-3 px-4 font-semibold border-b border-pink-200">Mã Đề</th>
                                <th className="py-3 px-4 font-semibold border-b border-pink-200">Cấu Trúc (Số Câu)</th>
                                <th className="py-3 px-4 font-semibold border-b border-pink-200">Hành Động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-pink-50">
                            {allAnswer.map(([code, answers]) => {
                                const mcqCount = Object.keys(answers.mcq ?? {}).length;
                                const trueFalseCount = Object.keys(answers.trueFalse ?? {}).length;
                                const shortAnswerCounnt = Object.keys(answers.shortAnswer ?? {}).length;

                                return (
                                    <tr key={code}
                                        className="hover:bg-pink-50/50 transition">
                                        <td className="py-3 px-4 font-medium">{code}</td>
                                        <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                                            (Trắc nghiệm: {mcqCount} | Đúng Sai: {trueFalseCount} | Tự luận: {shortAnswerCounnt} )
                                        </td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-center space-x-2" onClick={(event) => event.stopPropagation()}>
                                                <button onClick={() => handleUpdateAnswerCode(code, answers)} className="text-stone-400 hover:text-pink-600">
                                                    <Edit size={18} />
                                                </button>
                                                <button className="text-stone-400 hover:text-red-500">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-3xl shadow-md border border-pink-100 p-5 sm:p-6 lg:p-8 relative">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 border-b border-pink-100 pb-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 w-full">
                        <h3 className="text-xl font-bold text-stone-800">Danh sách các mã đề trong bài kiểm tra</h3>
                    </div>
                </div>

                <ConfigProvider
                    theme={{
                        token: { colorPrimary: "#ec4899", colorBorder: "#fbcfe8", borderRadius: 12, },
                        components: { Table: { headerBg: "#ffe4e9", headerColor: "#9d174d", headerSplitColor: "#f9a8d4", rowHoverBg: "#fdf2f8", borderColor: "#fbcfe8", colorBgContainer: "#ffffff", colorText: "#57534e", }, },
                    }}
                >
                    <Table
                        rowKey="id"
                        columns={columns}
                        dataSource={tableData}
                        style={{ width: "100%", }}
                        rowClassName={() => "cursor-pointer transition-colors"}
                        scroll={{ x: 500 }}
                        onRow={(record) => ({
                            onClick: () => handleOpenExamCode(record.code)
                        })}
                    />
                </ConfigProvider>
            </div>
            {handleShowInput()}
            <ShowExamsInput
                show={showInputModel}
                closeModal={handleCloseModelInput}
                allCodeExams={allCodeExams}
                defaultAnswerCode={defaultAnswerCode}
                defaultAnswerExam={defaultAnswerExam}
            />
        </>
    )
}

export default ShowExamsCode;