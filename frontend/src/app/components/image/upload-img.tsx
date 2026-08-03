"use client";

import { Image, Table, Tag, type TableColumnsType, } from "antd";
import { UploadCloud } from "lucide-react";
import React, { useState } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";

type ImageStatus =
    | "Chưa chấm"
    | "Đang chấm"
    | "Đã chấm"
    | "Lỗi";

interface IImageRow {
    id: string;
    index: number;

    file: File;

    previewUrl: string;

    stuCode: string;
    examCode: string;
    name: string;

    fileAnswer: string | null;

    correctAnswers: number;
    inCorrectAnswers: number;
    score: number;

    status: ImageStatus;
}

interface IGradeData {
    stuCode?: string;
    examCode?: string;
    name?: string;

    correctAnswers?: number;
    inCorrectAnswers?: number;
    score?: number;

    resultImageName?: string;
    resultImageUrl?: string | null;
}

interface IGradeResult {
    index: number;
    fileName: string;
    success: boolean;
    data?: IGradeData;
    error?: string;
}

interface IGradeResponse {
    success: boolean;
    templateId?: string;
    detector?: string;
    data: IGradeResult[];
    detail?: string;
}

interface IProps {
    templateId: string;
    answerKeys: Record<string, IAnswer>;
    targetClass: IClassRoom | null;
}

interface IShortAnswerDetail {
    answer: string;
    acceptedAnswers?: string[];
    numericValue?: number;
    tolerance?: number;
}

interface IAnswer {
    mcq: Record<string, string>;

    trueFalse: Record<
        string,
        Record<string, boolean>
    >;

    shortAnswer: Record<
        string,
        IShortAnswerDetail
    >;
}


const RenderUploadImage = ({ templateId, answerKeys, targetClass }: IProps) => {
    const [imageRows, setImageRows] = useState<IImageRow[]>([]);

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);


    const updateGradeResult = (
        gradeResults: IGradeResult[]
    ) => {
        setImageRows((previousRows) =>


            previousRows.map((row, index) => {

                const gradeResult = gradeResults.find((item) => item.index === index);

                if (!gradeResult || !gradeResult.success || !gradeResult.data) {
                    return { ...row, status: "Lỗi", };
                }

                const matchedStudent = targetClass?.students.find((stu) => stu.sbd == gradeResult.data?.stuCode);

                return {
                    ...row,

                    stuCode: gradeResult.data.stuCode ?? "",

                    examCode: gradeResult.data.examCode ?? "",

                    name: matchedStudent?.name ?? "",

                    correctAnswers: gradeResult.data.correctAnswers ?? 0,

                    inCorrectAnswers: gradeResult.data.inCorrectAnswers ?? 0,

                    score: gradeResult.data.score ?? 0,

                    fileAnswer: gradeResult.data.resultImageUrl ?? null,

                    status: "Đã chấm",
                };
            })
        );
    };

    console.log(targetClass)


    const handleUploadFile = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const selectedFiles = Array.from(
            event.target.files ?? []
        );

        if (selectedFiles.length === 0) {
            return;
        }

        const validFiles = selectedFiles.filter(
            (file) => file.type === "image/jpeg" || file.type === "image/png"
        );

        if (
            validFiles.length !== selectedFiles.length
        ) {
            toast.warning("Chỉ hỗ trợ ảnh JPG, JPEG và PNG");
        }

        if (validFiles.length === 0) {
            event.target.value = "";
            return;
        }

        setImageRows((previousRows) => {
            const newRows: IImageRow[] =
                validFiles.map((file, index) => ({
                    id: `${Date.now()}-${file.name}-${index}`,
                    index: previousRows.length + index,
                    file,

                    previewUrl: URL.createObjectURL(file),

                    stuCode: "",
                    examCode: "",
                    name: "",

                    fileAnswer: null,

                    correctAnswers: 0,
                    inCorrectAnswers: 0,
                    score: 0,

                    status: "Chưa chấm",
                }));

            return [
                ...previousRows,
                ...newRows,
            ];
        });

        // Cho phép chọn lại cùng một file
        event.target.value = "";
    };


    const handleRemoveAllImages = () => {
        imageRows.forEach((row) => {
            URL.revokeObjectURL(
                row.previewUrl
            );
        });

        setImageRows([]);

    };

    const handleSubmitGrade = async () => {
        if (imageRows.length === 0) {
            toast.warning("Vui lòng chọn ít nhất một ảnh bài thi");
            return;
        }

        if (!templateId) {
            toast.warning("Không xác định được mẫu phiếu chấm");
            return;
        }

        setIsSubmitting(true);

        setImageRows((previousRows) =>
            previousRows.map((row) => ({
                ...row,
                status: "Đang chấm",
            }))
        );

        try {
            const formData = new FormData();

            // Gửi nhiều ảnh với cùng key "files"
            imageRows.forEach((row) => {
                formData.append("files", row.file);
            });

            // Gửi template để main.py chọn app chấm
            formData.append("templateId", templateId);
            formData.append("answerKeys", JSON.stringify(answerKeys));

            const response = await fetch(
                "http://127.0.0.1:8001/cham_bai",
                {
                    method: "POST",
                    body: formData,
                }
            );

            const result: IGradeResponse = await response.json();

            if (!response.ok) {
                throw new Error(result.detail ?? "Chấm bài thất bại");
            }

            console.log("Kết quả main.py:", result);

            updateGradeResult(result.data);

            toast.success("Chấm bài thành công");
        } catch (error) {
            console.error("Lỗi chấm bài:", error);

            setImageRows((previousRows) =>
                previousRows.map((row) => ({ ...row, status: "Lỗi" }))
            );

            toast.error(
                error instanceof Error ? error.message : "Chấm bài thất bại"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns: TableColumnsType<IImageRow> = [
        {
            title: "STT",
            width: 60,
            align: "center",

            render: (
                _value,
                _record,
                index
            ) => index + 1,
        },
        {
            title: "Bài thi",
            dataIndex: "previewUrl",
            width: 120,
            align: "center",

            render: (
                previewUrl: string,
                record: IImageRow
            ) => (
                <Image
                    src={previewUrl}
                    alt={record.file.name}
                    width={60}
                    height={80}
                    className="object-cover rounded-lg border border-gray-200"
                    preview={{
                        mask: "Xem",
                    }}
                />
            ),
        },
        {
            title: "Số báo danh",
            dataIndex: "stuCode",
            width: 120,

            render: (stuCode: string) =>
                stuCode || "-",
        },
        {
            title: "Mã đề thi",
            dataIndex: "examCode",
            width: 100,

            render: (examCode: string) =>
                examCode || "-",
        },
        {
            title: "Họ và tên",
            dataIndex: "name",
            width: 150,

            render: (name: string) =>
                name || "-",
        },
        {
            title: "Ảnh kết quả",
            dataIndex: "fileAnswer",
            width: 120,
            align: "center",

            render: (
                fileAnswer: string | null
            ) =>
                fileAnswer ? (
                    <Image
                        src={fileAnswer}
                        width={60}
                        height={80}
                        className="object-cover rounded-lg"
                        preview={{
                            mask: "Xem",
                        }}
                    />
                ) : (
                    <span className="text-gray-400">
                        Chưa có
                    </span>
                ),
        },
        {
            title: "Số câu đúng",
            dataIndex: "correctAnswers",
            width: 100,
            align: "center",
        },
        {
            title: "Số câu sai",
            dataIndex: "inCorrectAnswers",
            width: 100,
            align: "center",
        },
        {
            title: "Điểm",
            dataIndex: "score",
            width: 100,
            align: "center",

            render: (
                score: number,
                record: IImageRow
            ) =>
                record.status === "Đã chấm"
                    ? score
                    : "-",
        },
        {
            title: "Trạng thái",
            dataIndex: "status",
            width: 120,
            align: "center",

            render: (status: ImageStatus) => {
                let color = "default";

                if (status === "Đang chấm") {
                    color = "processing";
                }

                if (status === "Đã chấm") {
                    color = "success";
                }

                if (status === "Lỗi") {
                    color = "error";
                }

                return (
                    <Tag color={color}>
                        {status}
                    </Tag>
                );
            },
        },
    ];


    // console.log(imageRows)
    const handleCreateExcelFile = () => {
        const gradedRows = imageRows.filter(
            (row) => row.name !== ""
        ).filter(
            (row, index, rows) =>
                index === rows.findIndex(
                    (item) =>
                        String(item.stuCode).trim() ===
                        String(row.stuCode).trim()
                )
        );

        if (gradedRows.length === 0) {
            toast.warning("Chưa có kết quả chấm để xuất Excel");
            return;
        }

        const excelData = gradedRows.map(
            (row, index) => ({
                "STT": index + 1,

                "Số báo danh":
                    row.stuCode || "",

                "Họ và tên":
                    row.name || "",

                "Mã đề":
                    row.examCode || "",

                "Số câu đúng":
                    row.correctAnswers,

                "Số câu sai":
                    row.inCorrectAnswers,

                "Điểm":
                    row.score,
            })
        );
        console.log(excelData)

        const workSheet = XLSX.utils.json_to_sheet(excelData)
        workSheet["!cols"] = [
            { wch: 8 },   // STT
            { wch: 18 },  // Số báo danh
            { wch: 30 },  // Họ và tên
            { wch: 15 },  // Mã đề
            { wch: 15 },  // Số câu đúng
            { wch: 15 },  // Số câu sai
            { wch: 12 },  // Điểm
        ];
        workSheet["!autofilter"] = { ref: `A1:G${excelData.length + 1}`, };
        const workBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workBook, workSheet, "Kết quả chấm");
        const currentDate = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workBook, `ket-qua-cham-${currentDate}.xlsx`)
        toast.success(`Đã xuất ${gradedRows.length} kết quả`);
    }

    return (
        <>
            {/* Khu vực chọn ảnh */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-xl mb-1 text-gray-800">
                    Import ảnh bài làm
                </h3>

                <p className="text-gray-500 text-sm mb-5">
                    Kéo thả hoặc chọn một/nhiều ảnh để
                    bắt đầu hệ thống nhận diện.
                </p>

                <label className="border-2 border-dashed border-pink-300 bg-pink-50/30 rounded-2xl min-h-56 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-50 hover:border-pink-400 transition-all group px-4">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                        <UploadCloud
                            size={32}
                            className="text-pink-500"
                        />
                    </div>

                    <p className="font-semibold text-gray-700 text-lg mb-1 text-center">
                        Nhấn để tải ảnh lên
                    </p>

                    <p className="text-gray-400 text-sm font-medium text-center">
                        Hỗ trợ định dạng: JPG, PNG,
                        JPEG
                    </p>

                    <input
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                        onChange={handleUploadFile}
                        className="hidden"
                    />
                </label>
            </div>

            {/* Bảng ảnh */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-5">
                    <h4 className="font-bold text-lg text-gray-800">
                        Ảnh đã tải lên

                        <span className="text-pink-600 bg-pink-100 px-2 py-0.5 rounded-md ml-2 text-sm">
                            {imageRows.length}
                        </span>
                    </h4>

                    <div className="flex items-center gap-3">
                        {imageRows.length > 0 && (
                            <button
                                type="button"
                                onClick={
                                    handleRemoveAllImages
                                }
                                disabled={isSubmitting}
                                className="text-sm text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                                Xóa tất cả
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={
                                handleSubmitGrade
                            }
                            disabled={
                                imageRows.length === 0 ||
                                isSubmitting
                            }
                            className="bg-pink-400 hover:bg-pink-500 text-white px-4 py-1.5 rounded-lg font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Đang chấm..." : "Chấm bài"}
                        </button>

                        <button
                            style={{ cursor: "pointer" }}
                            disabled={
                                imageRows.length === 0 ||
                                isSubmitting
                            }
                            type="button"
                            onClick={handleCreateExcelFile}
                            className=" bg-green-600 hover:bg-green-700 text-white  px-4 py-1.5 rounded-lg font-medium transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Xuất Excel
                        </button>
                    </div>
                </div>

                <Table<IImageRow>
                    rowKey="id"
                    columns={columns}
                    dataSource={imageRows}
                    pagination={false}
                    scroll={{ x: 1250 }}
                    locale={{ emptyText: "Chưa có ảnh bài làm nào", }}
                    style={{ background: "transparent", borderRadius: "16px", }}
                    rowClassName={() =>
                        "transition-colors"
                    }
                />
            </div>
        </>
    );
};

export default RenderUploadImage;