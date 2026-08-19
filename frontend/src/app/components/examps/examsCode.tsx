"use client"

import { Button, ConfigProvider, Empty, Modal, Table, Upload, UploadProps } from "antd";
import dayjs from "dayjs";
import { Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import ShowExamsInput from "./examinput";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import * as XLSX from 'xlsx';
import { handleCreateAnswerCode } from "@/app/action";
import HandleDeleteExamsCode from "./codeExampsDelete";

interface IAnswer {
    mcq: Record<string, string>;

    trueFalse: Record<string, Record<string, boolean>>;

    shortAnswer: Record<string,
        {
            answer: string;
        }
    >;
}

interface IAnswerSheetTemplates {
    allCodeExams: IAnswerSheetTemplate;
    detailBasePath?: string | null;
}

interface ExcelAnswerRow {
    "Mã đề"?: string | number;
    "MD"?: string | number;
    "md"?: string | number;
    "Phần 1"?: string;
    "Phần 2"?: string;
    "Phần 3"?: string;

}


const ShowExamsCode = (props: IAnswerSheetTemplates) => {
    const { allCodeExams, detailBasePath } = props;

    const router = useRouter();

    const allAnswer = Object.entries(allCodeExams.answerKeys ?? {}) as [string, IAnswer][];

    const [openModel, setOpenModal] = useState<boolean>(false)

    const [showInputModel, setShowInputModel] = useState<boolean>(false)

    const [defaultAnswerCode, setDefaultAnswerCode] = useState<string | null>(null);

    const [defaultAnswerExam, setDefaultAnswerExam] = useState<IAnswer | null>(null);

    const [showModalDeleteExamCode, setShowModalDeleteExamCode] = useState<boolean>(false)

    const [targetCode, setTargetCode] = useState<string>("")


    const tableData = allAnswer.map(([code, answers]) => ({
        id: code,
        code,
        answers,
    }));

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
                        <div className="flex flex-wrap gap-2 mt-1" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
                            {Object.entries(record.answers.mcq ?? {}).map(([question, answer]) => (
                                <span key={question} className="text-xs px-1 py-1 rounded-md bg-pink-50 text-pink-900">{question}{answer}</span>
                            ))}
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

    const handleUpdateAnswerCode = (code: string, answer: IAnswer) => {
        setDefaultAnswerExam(answer);
        setDefaultAnswerCode(code);
        setShowInputModel(true);
    };

    const handleCloseModelInput = () => {
        setShowInputModel(false);
        setDefaultAnswerCode(null);
        setDefaultAnswerExam(null);
    };



    const handleFileUpload: NonNullable<UploadProps["beforeUpload"]> = async (file) => {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];

            if (!sheetName) {
                toast.error("File Excel không có sheet dữ liệu.");
                return false;
            }

            const worksheet = workbook.Sheets[sheetName];
            const parsedData = XLSX.utils.sheet_to_json<ExcelAnswerRow>(worksheet, {
                defval: "",
                raw: false,
            });

            const parsePart1 = (value: unknown): Record<string, string> => {
                const text = String(value ?? "");
                return Object.fromEntries(
                    [...text.matchAll(/(\d+)\s*([ABCD])/gi)]
                        .map((match) => [match[1], match[2].toUpperCase(),])
                );
            };

            const parsePart2 = (value: unknown): Record<string, Record<string, boolean>> => {
                const text = String(value ?? "");
                const options = ["a", "b", "c", "d"];
                return Object.fromEntries(
                    [...text.matchAll(/(\d+)\s*([SĐD]{4})/giu)]
                        .map((match) => {
                            const question = match[1]; const answers = [...match[2]];
                            return [
                                question,
                                Object.fromEntries(
                                    answers.map((answer, index) => [options[index], answer.toUpperCase() !== "S",])
                                ),
                            ];
                        })
                );
            };

            const parsePart3 = (value: unknown): Record<string, { answer: string; }> => {
                const text = String(value ?? "");
                return Object.fromEntries(
                    [...text.matchAll(/(\d+)-(.+?)(?=\s+\d+-|$)/g)]
                        .map((match) => [match[1], { answer: match[2].trim() },])
                );
            };

            const importedAnswerKeys = parsedData.reduce<Record<string, IAnswer>>(
                (result, row) => {
                    const examCode = String(row["Mã đề"] ?? "").trim();

                    if (!examCode) {
                        return result;
                    }

                    result[examCode] = {
                        mcq: parsePart1(row["Phần 1"]),
                        trueFalse: parsePart2(row["Phần 2"]),
                        shortAnswer: parsePart3(row["Phần 3"]),
                    };
                    return result;
                }, {}
            );

            const currentTime = dayjs().format(
                "YYYY-MM-DDTHH:mm:ssZ"
            );

            const dataUpdate = {
                answerKeys: {
                    ...(allCodeExams.answerKeys ?? {}),
                    ...importedAnswerKeys,
                },
                updatedAt: currentTime,
            };

            console.log(dataUpdate)

            const res = await handleCreateAnswerCode(
                allCodeExams.id,
                dataUpdate,
                allCodeExams,
            );

            if (res?.success) {
                toast.success("Đã nhập mã đề từ Excel.");
                router.refresh();
            } else {
                toast.error(res?.message ?? "Nhập mã đề thất bại.");
            }
        } catch (error) {
            console.error("Không thể đọc file Excel:", error);
            toast.error("Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file.");
        }

        // Ngăn Ant Design tự động tải file lên server.
        return false;
    }

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
                        onClick={() => {
                            setOpenModal(false);
                            setDefaultAnswerCode(null);
                            setDefaultAnswerExam(null);
                            setShowInputModel(true);
                        }}
                    >Hiện bảng và thêm thủ công</Button>

                    <Upload
                        accept=".xlsx,.xls"
                        beforeUpload={handleFileUpload}
                        showUploadList={false}
                    >
                        <Button>Import File từng mã đề</Button>
                    </Upload>
                </div>
            </Modal>
        )
    }

    const handleShowModalDeleteExamCode = (prop: string) => {
        setShowModalDeleteExamCode(true)
        setTargetCode(prop)

    }

    const closeHandleDeleteExampCode = () => {
        setShowModalDeleteExamCode(false)
    }

    const handleOpenExamCode = (code: string) => {
        const targetBasePath = detailBasePath === undefined
            ? `/class/${allCodeExams.id}/exams`
            : detailBasePath;

        if (targetBasePath) {
            router.push(`${targetBasePath}/${code}`);
        }
    };

    const handleOpenAllExamCode = () => {
        const examCodes = Object.keys(allCodeExams.answerKeys ?? {});

        if (examCodes.length === 0) {
            toast.warning("Chưa có mã đề để chấm");
            return;
        }

        const targetBasePath = detailBasePath === undefined
            ? `/class/${allCodeExams.id}/exams`
            : detailBasePath;

        if (!targetBasePath) {
            toast.error("Không xác định được đường dẫn chấm bài");
            return;
        }

        router.push(`${targetBasePath}/all`);
    };

    return (
        <>
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h2 className="text-xl font-semibold tracking-[-0.02em] text-stone-800 md:text-2xl">
                        Quản lý mã đề và đáp án
                    </h2>
                    <p className="mt-1 text-sm font-normal leading-6 text-stone-500">
                        Thêm mã đề thủ công hoặc nhập nhanh danh sách đáp án từ Excel.
                    </p>
                </div>
                <button
                    onClick={() => setOpenModal(true)}
                    className="rounded-xl bg-[#8f3c4a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#74313d]"
                >
                    + Thêm mã đề
                </button>
            </div>

            {/* <div className="bg-white rounded-2xl shadow-sm border border-pink-100 overflow-hidden"></div> */}

            {/* Bảng Mã Đề */}
            <div className="mt-5 overflow-hidden rounded-2xl border border-pink-100 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-center">
                        <thead className="bg-[#ffe4e9] text-sm text-stone-700">
                            <tr style={{ color: "#9d174d" }} >
                                <th className="border-b border-pink-200 px-4 py-3 font-semibold">Mã đề</th>
                                <th className="border-b border-pink-200 px-4 py-3 font-semibold">Cấu trúc câu hỏi</th>
                                <th className="border-b border-pink-200 px-4 py-3 font-semibold">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-pink-50">
                            {allAnswer.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-8">
                                        <Empty
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                            description="Chưa có mã đề nào"
                                            className="!my-2"
                                        />
                                    </td>
                                </tr>
                            )}
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
                                                    <Trash2 size={18} onClick={() => handleShowModalDeleteExamCode(code)} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            <HandleDeleteExamsCode
                                show={showModalDeleteExamCode}
                                handleClose={closeHandleDeleteExampCode}
                                targetCode={targetCode}
                                allCodeExams={allCodeExams.answerKeys}
                                answerSheetTemplatesId={allCodeExams.id}
                            />
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="relative mt-6 rounded-3xl border border-pink-100 bg-white p-5 shadow-md sm:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4 border-b border-pink-100 pb-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 w-full">
                        <h3 className="text-lg font-semibold tracking-[-0.01em] text-stone-800">Chi tiết đáp án theo mã đề</h3>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <button
                            onClick={handleOpenAllExamCode}
                            className="rounded-xl bg-[#8f3c4a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#74313d]"
                            style={{ width: "160px" }}
                        >
                            Chấm tất cả mã đề
                        </button>
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
                        rowClassName={() => detailBasePath === null
                            ? "transition-colors"
                            : "cursor-pointer transition-colors"
                        }
                        scroll={{ x: 500 }}
                        onRow={(record) => ({
                            onClick: () => {
                                if (detailBasePath !== null) {
                                    handleOpenExamCode(record.code)
                                }
                            }
                        })}
                        footer={() => (
                            <div style={{ textAlign: "right" }}>
                                <button
                                    onClick={handleOpenAllExamCode}
                                    className="rounded-xl bg-[#8f3c4a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#74313d]"
                                >
                                    Chấm tất cả mã đề
                                </button>
                            </div>
                        )}
                    />
                </ConfigProvider>
            </div>
            {handleShowInput()}
            {showInputModel && (
                <ShowExamsInput
                    key={defaultAnswerCode ?? "new-answer-code"}
                    show={showInputModel}
                    closeModal={handleCloseModelInput}
                    allCodeExams={allCodeExams}
                    defaultAnswerCode={defaultAnswerCode}
                    defaultAnswerExam={defaultAnswerExam}
                />
            )}
        </>
    )
}

export default ShowExamsCode;
