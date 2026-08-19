"use client";

import { AutoComplete, Button, Form, Image, Input, InputNumber, Modal, Popconfirm, Select, Table, Tag, Upload, type TableColumnsType, } from "antd";
import { Camera, Copy, ExternalLink, Smartphone, UploadCloud } from "lucide-react";
import QRCode from "qrcode";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import type { IPointSettings } from "@/app/types/grading";


type ImageStatus =
    | "Chưa chấm"
    | "Đang chấm"
    | "Đã chấm"
    | "Lỗi";

type CaptureMode = "append" | "replace";

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

interface ICaptureSessionResponse {
    success: boolean;
    sessionId: string;
    lanIp: string;
    cameraOrigin?: string | null;
    detail?: string;
}

interface ICaptureOriginResponse {
    success: boolean;
    cameraOrigin: string | null;
    detail?: string;
}

interface ICapturedImage {
    id: string;
    fileName: string;
    contentType: string;
    downloadUrl: string;
}

interface ICapturedImageListResponse {
    success: boolean;
    images: ICapturedImage[];
}

interface IProps {
    templateId: string;
    answerKeys: Record<string, IAnswer>;
    targetClass: IClassRoom | null;
    pointSettings: IPointSettings;
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

interface IManualGradeValues {
    stuCode: string;
    examCode: string;
    name: string;
    correctAnswers: number;
    inCorrectAnswers: number;
    score: number;
}

const countAnswers = (answerKey?: IAnswer) => {
    if (!answerKey) {
        return 0;
    }

    const trueFalseAnswerCount = Object.values(
        answerKey.trueFalse ?? {}
    ).reduce(
        (total, statements) => total + Object.keys(statements).length,
        0
    );

    return (
        Object.keys(answerKey.mcq ?? {}).length
        + trueFalseAnswerCount
        + Object.keys(answerKey.shortAnswer ?? {}).length
    );
};

const getGradingApiUrl = () =>
    `http://${window.location.hostname}:8001/cham_bai`;

const getUrlOrigin = (url: string) => {
    try {
        return new URL(url).origin;
    } catch {
        return "";
    }
};

const RenderUploadImage = ({ templateId, answerKeys, targetClass, pointSettings }: IProps) => {
    const [imageRows, setImageRows] = useState<IImageRow[]>([]);

    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const [show, setShow] = useState<boolean>(false);

    const [defaultImg, setDefaultImg] = useState<IImageRow | null>(null)

    const [manualGradeForm] = Form.useForm<IManualGradeValues>();
    const [manualGradeOpen, setManualGradeOpen] = useState(false);
    const [manualGradeRow, setManualGradeRow] = useState<IImageRow | null>(null);
    const [manualAnswerTotal, setManualAnswerTotal] = useState(0);

    const replacementCameraInputRef = useRef<HTMLInputElement>(null);

    const [captureModalOpen, setCaptureModalOpen] = useState(false);
    const [captureSessionId, setCaptureSessionId] = useState("");
    const [capturePageUrl, setCapturePageUrl] = useState("");
    const [captureQrCode, setCaptureQrCode] = useState("");
    const [isCreatingCaptureSession, setIsCreatingCaptureSession] = useState(false);
    const [receivedCaptureCount, setReceivedCaptureCount] = useState(0);
    const [captureMode, setCaptureMode] = useState<CaptureMode>("append");
    const [replacementRowId, setReplacementRowId] = useState<string | null>(null);
    const capturedImageIdsRef = useRef<Set<string>>(new Set());
    const isCaptureSyncingRef = useRef(false);
    const isCreatingCaptureSessionRef = useRef(false);

    const handleShowModal = (prop: IImageRow) => {
        setDefaultImg(prop)
        setShow(true)
    }

    const handleCloseModal = () => {
        setShow(false)
    }

    const replaceImageRow = useCallback((targetRowId: string, file: File) => {
        setImageRows((previousRows) =>
            previousRows.map((row) => {
                if (row.id !== targetRowId) {
                    return row;
                }

                URL.revokeObjectURL(row.previewUrl);

                return {
                    ...row,
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
                };
            })
        );
        setDefaultImg(null);
        setShow(false);
    }, []);

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
                console.log(previousRows)

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


    const appendImageFiles = useCallback((selectedFiles: File[]) => {
        if (selectedFiles.length === 0) {
            return;
        }

        if (isSubmitting) {
            toast.warning("Vui lòng chờ quá trình chấm bài hoàn tất");
            return;
        }

        const supportedTypes: Record<string, string> = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
        };
        const existingFileKeys = new Set(
            imageRows.map((row) =>
                `${row.file.name}-${row.file.size}-${row.file.lastModified}`
            )
        );
        const selectedFileKeys = new Set<string>();
        const validFiles: File[] = [];
        let invalidFileCount = 0;
        let duplicateFileCount = 0;

        selectedFiles.forEach((selectedFile) => {
            const extension = selectedFile.name
                .slice(selectedFile.name.lastIndexOf("."))
                .toLowerCase();
            const normalizedType = supportedTypes[extension];

            if (!normalizedType || selectedFile.size === 0) {
                invalidFileCount += 1;
                return;
            }

            const fileKey = `${selectedFile.name}-${selectedFile.size}-${selectedFile.lastModified}`;

            if (existingFileKeys.has(fileKey) || selectedFileKeys.has(fileKey)) {
                duplicateFileCount += 1;
                return;
            }

            selectedFileKeys.add(fileKey);

            // Một số trình duyệt trả file.type rỗng. Tạo lại File để backend
            // luôn nhận đúng content-type image/jpeg hoặc image/png.
            validFiles.push(
                selectedFile.type === normalizedType
                    ? selectedFile
                    : new File([selectedFile], selectedFile.name, {
                        type: normalizedType,
                        lastModified: selectedFile.lastModified,
                    })
            );
        });

        if (invalidFileCount > 0) {
            toast.warning(
                `Đã bỏ qua ${invalidFileCount} file rỗng hoặc không phải JPG, JPEG, PNG`
            );
        }

        if (duplicateFileCount > 0) {
            toast.info(`Đã bỏ qua ${duplicateFileCount} ảnh bị trùng`);
        }

        if (validFiles.length === 0) {
            return;
        }

        setImageRows((previousRows) => {
            const newRows: IImageRow[] = validFiles.map((file, index) => ({
                id: crypto.randomUUID(),
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
    }, [imageRows, isSubmitting]);

    const handleSelectFile = (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const input = event.currentTarget;
        const selectedFiles = Array.from(input.files ?? []);

        // Cho phép chọn lại chính file vừa chọn ở lần sau.
        input.value = "";
        appendImageFiles(selectedFiles);
    };

    const clearCaptureSession = useCallback(() => {
        setCaptureSessionId("");
        setCapturePageUrl("");
        setCaptureQrCode("");
        setReceivedCaptureCount(0);
        capturedImageIdsRef.current.clear();
    }, []);

    const createCaptureSession = useCallback(async () => {
        if (isCreatingCaptureSessionRef.current) {
            return false;
        }

        isCreatingCaptureSessionRef.current = true;
        setIsCreatingCaptureSession(true);

        try {
            const response = await fetch(
                "/api/capture-sessions",
                { method: "POST" }
            );
            const result: ICaptureSessionResponse = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.detail ?? "Không tạo được phiên chụp ảnh"
                );
            }

            if (!result.cameraOrigin) {
                throw new Error(
                    "HTTPS camera chưa sẵn sàng. Vui lòng đợi Cloudflare tạo URL mới."
                );
            }

            const cameraOrigin = result.cameraOrigin;
            const cameraUrl = (
                `${cameraOrigin}/camera/${result.sessionId}`
                + `?templateId=${encodeURIComponent(templateId)}`
            );
            const qrCode = await QRCode.toDataURL(cameraUrl, {
                width: 280,
                margin: 1,
                color: {
                    dark: "#8f3c4a",
                    light: "#ffffff",
                },
            });

            capturedImageIdsRef.current.clear();
            setReceivedCaptureCount(0);
            setCaptureSessionId(result.sessionId);
            setCapturePageUrl(cameraUrl);
            setCaptureQrCode(qrCode);
            return true;
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Không kết nối được backend camera"
            );
            setCaptureModalOpen(false);
            return false;
        } finally {
            isCreatingCaptureSessionRef.current = false;
            setIsCreatingCaptureSession(false);
        }
    }, [templateId]);

    const handleOpenRemoteCamera = async () => {
        setCaptureMode("append");
        setReplacementRowId(null);
        setCaptureModalOpen(true);

        if (captureSessionId) {
            try {
                const [sessionResponse, originResponse] = await Promise.all([
                    fetch(
                        `/api/capture-sessions/${captureSessionId}/images`,
                        { cache: "no-store" }
                    ),
                    fetch("/api/capture-sessions", { cache: "no-store" }),
                ]);
                const originResult: ICaptureOriginResponse = (
                    await originResponse.json()
                );

                if (
                    sessionResponse.ok
                    && originResponse.ok
                    && originResult.cameraOrigin === getUrlOrigin(capturePageUrl)
                ) {
                    return;
                }
            } catch (error) {
                console.error("Không kiểm tra được phiên camera:", error);
            }

            clearCaptureSession();
            toast.info("Phiên camera cũ không còn khả dụng. Đang tạo QR mới...");
        }

        await createCaptureSession();
    };

    const handleOpenReplacementCamera = async (targetRowId: string) => {
        setCaptureMode("replace");
        setReplacementRowId(targetRowId);
        setShow(false);
        setDefaultImg(null);
        setCaptureModalOpen(true);

        // Phiên riêng giúp ảnh đầu tiên nhận được chắc chắn thuộc thao tác sửa,
        // không bị lẫn với những ảnh đã chụp ở chế độ thêm mới.
        clearCaptureSession();
        const isSessionCreated = await createCaptureSession();

        if (!isSessionCreated) {
            setCaptureMode("append");
            setReplacementRowId(null);
        }
    };

    const handleCloseCaptureModal = () => {
        setCaptureModalOpen(false);

        if (captureMode === "replace") {
            clearCaptureSession();
            setCaptureMode("append");
            setReplacementRowId(null);
        }
    };

    useEffect(() => {
        if (!captureSessionId) {
            return;
        }

        const syncCapturedImages = async () => {
            if (isCaptureSyncingRef.current || isSubmitting) {
                return;
            }

            isCaptureSyncingRef.current = true;

            try {
                if (captureModalOpen && capturePageUrl) {
                    try {
                        const originResponse = await fetch(
                            "/api/capture-sessions",
                            { cache: "no-store" }
                        );
                        const originResult: ICaptureOriginResponse = (
                            await originResponse.json()
                        );

                        if (
                            originResponse.ok
                            && originResult.cameraOrigin
                            && originResult.cameraOrigin !== getUrlOrigin(capturePageUrl)
                        ) {
                            clearCaptureSession();
                            toast.info("Đường dẫn HTTPS đã thay đổi. Đang tạo QR mới...");
                            void createCaptureSession();
                            return;
                        }
                    } catch (error) {
                        console.error("Không kiểm tra được HTTPS camera:", error);
                    }
                }

                const response = await fetch(
                    `/api/capture-sessions/${captureSessionId}/images`,
                    { cache: "no-store" }
                );

                if (response.status === 404) {
                    clearCaptureSession();

                    if (captureModalOpen) {
                        toast.info("Phiên camera đã hết hạn. Đang tạo QR mới...");
                        void createCaptureSession();
                    }

                    return;
                }

                if (!response.ok) {
                    return;
                }

                const result: ICapturedImageListResponse = await response.json();
                const newImages = result.images.filter(
                    (image) => !capturedImageIdsRef.current.has(image.id)
                );

                if (newImages.length === 0) {
                    return;
                }

                const imagesToDownload = captureMode === "replace"
                    ? newImages.slice(0, 1)
                    : newImages;

                const downloadedFiles = (
                    await Promise.all(
                        imagesToDownload.map(async (image) => {
                            const imageResponse = await fetch(image.downloadUrl, {
                                cache: "no-store",
                            });

                            if (!imageResponse.ok) {
                                return null;
                            }

                            const imageBlob = await imageResponse.blob();
                            capturedImageIdsRef.current.add(image.id);

                            return new File(
                                [imageBlob],
                                image.fileName,
                                {
                                    type: image.contentType,
                                    lastModified: Date.now(),
                                }
                            );
                        })
                    )
                ).filter((file): file is File => file !== null);

                if (downloadedFiles.length > 0) {
                    if (captureMode === "replace" && replacementRowId) {
                        replaceImageRow(replacementRowId, downloadedFiles[0]);
                        setCaptureModalOpen(false);
                        clearCaptureSession();
                        setCaptureMode("append");
                        setReplacementRowId(null);
                        toast.success("Đã thay ảnh bài thi từ camera iPhone");
                        return;
                    }

                    appendImageFiles(downloadedFiles);
                    setReceivedCaptureCount((count) => count + downloadedFiles.length);
                    toast.success(
                        `Đã nhận ${downloadedFiles.length} ảnh từ điện thoại`
                    );
                }
            } catch (error) {
                console.error("Không đồng bộ được ảnh từ điện thoại:", error);
            } finally {
                isCaptureSyncingRef.current = false;
            }
        };

        void syncCapturedImages();
        const intervalId = window.setInterval(syncCapturedImages, 2000);

        return () => window.clearInterval(intervalId);
    }, [
        appendImageFiles,
        captureMode,
        captureModalOpen,
        capturePageUrl,
        captureSessionId,
        clearCaptureSession,
        createCaptureSession,
        isSubmitting,
        replaceImageRow,
        replacementRowId,
    ]);

    const handleCopyCaptureUrl = async () => {
        try {
            await navigator.clipboard.writeText(capturePageUrl);
            toast.success("Đã sao chép đường dẫn camera");
        } catch {
            toast.error("Không sao chép được đường dẫn");
        }
    };

    const handleRemoveAllImages = () => {
        imageRows.forEach((row) => {
            URL.revokeObjectURL(row.previewUrl);
        });

        setImageRows([]);
        setDefaultImg(null);
        setShow(false);
    };

    const handleRemoveImage = (targetRow: IImageRow) => {
        URL.revokeObjectURL(targetRow.previewUrl);

        setImageRows((previousRows) =>
            previousRows
                .filter((row) => row.id !== targetRow.id)
                .map((row, index) => ({
                    ...row,
                    index,
                }))
        );

        if (defaultImg?.id === targetRow.id) {
            setDefaultImg(null);
            setShow(false);
        }

        toast.success("Đã xóa ảnh bài làm");
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
            formData.append("gradingConfig", JSON.stringify(pointSettings));

            const response = await fetch(
                getGradingApiUrl(),
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

    const handleOpenManualGrade = (targetRow: IImageRow) => {
        const examCodes = Object.keys(answerKeys);
        const selectedExamCode = targetRow.examCode && answerKeys[targetRow.examCode]
            ? targetRow.examCode
            : examCodes[0] ?? "";
        const totalAnswers = countAnswers(answerKeys[selectedExamCode]);
        const matchedStudent = targetClass?.students.find(
            (student) => String(student.sbd) === String(targetRow.stuCode)
        );
        const correctAnswers = targetRow.status === "Đã chấm"
            ? Math.min(targetRow.correctAnswers, totalAnswers)
            : 0;

        setManualGradeRow(targetRow);
        setManualAnswerTotal(totalAnswers);
        manualGradeForm.setFieldsValue({
            stuCode: targetRow.stuCode,
            examCode: selectedExamCode,
            name: targetRow.name || matchedStudent?.name || "",
            correctAnswers,
            inCorrectAnswers: Math.max(totalAnswers - correctAnswers, 0),
            score: targetRow.status === "Đã chấm" ? targetRow.score : 0,
        });
        setManualGradeOpen(true);
    };

    const handleCloseManualGrade = () => {
        setManualGradeOpen(false);
        setManualGradeRow(null);
        setManualAnswerTotal(0);
        manualGradeForm.resetFields();
    };

    const handleManualStudentCodeChange = (studentCode: string) => {
        const matchedStudent = targetClass?.students.find(
            (student) => String(student.sbd) === String(studentCode)
        );

        manualGradeForm.setFieldValue("name", matchedStudent?.name ?? "");
    };

    const handleManualExamCodeChange = (examCode: string) => {
        const totalAnswers = countAnswers(answerKeys[examCode]);
        const currentCorrectAnswers = Math.min(
            Number(manualGradeForm.getFieldValue("correctAnswers") ?? 0),
            totalAnswers
        );

        setManualAnswerTotal(totalAnswers);
        manualGradeForm.setFieldsValue({
            correctAnswers: currentCorrectAnswers,
            inCorrectAnswers: Math.max(totalAnswers - currentCorrectAnswers, 0),
        });
    };

    const handleManualCorrectAnswersChange = (value: number | null) => {
        const correctAnswers = Math.max(Number(value ?? 0), 0);

        manualGradeForm.setFieldValue(
            "inCorrectAnswers",
            Math.max(manualAnswerTotal - correctAnswers, 0)
        );
    };

    const handleSaveManualGrade = async () => {
        if (!manualGradeRow) {
            return;
        }

        try {
            const values = await manualGradeForm.validateFields();
            const totalAnswers = countAnswers(answerKeys[values.examCode]);

            if (values.correctAnswers > totalAnswers) {
                toast.warning(`Số câu đúng không được vượt quá ${totalAnswers}`);
                return;
            }

            const matchedStudent = targetClass?.students.find(
                (student) => String(student.sbd) === String(values.stuCode).trim()
            );

            setImageRows((previousRows) =>
                previousRows.map((row) =>
                    row.id === manualGradeRow.id
                        ? {
                            ...row,
                            stuCode: String(values.stuCode).trim(),
                            examCode: String(values.examCode).trim(),
                            name: String(values.name || matchedStudent?.name || "").trim(),
                            correctAnswers: values.correctAnswers,
                            inCorrectAnswers: Math.max(totalAnswers - values.correctAnswers, 0),
                            score: Number(values.score.toFixed(2)),
                            status: "Đã chấm",
                        }
                        : row
                )
            );

            handleCloseManualGrade();
            toast.success("Đã lưu kết quả chấm tay");
        } catch {
            // Ant Design tự hiển thị lỗi tại các trường chưa hợp lệ.
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
                        alt="Ảnh kết quả chấm"
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
        {
            title: "Thao tác",
            align: "center",
            width: 210,

            render: (_value: unknown, record: IImageRow) => {
                return (
                    <div className="grid min-w-[180px] grid-cols-2 gap-3" >
                        <Button
                            onClick={() => handleShowModal(record)}
                            style={{ fontWeight: "bold" }} block size="large" color="blue" variant="filled">
                            Sửa ảnh
                        </Button>

                        <Button
                            onClick={() => handleOpenManualGrade(record)}
                            disabled={isSubmitting}
                            style={{ fontWeight: "bold" }}
                            block
                            size="large"
                            color="purple"
                            variant="filled"
                        >
                            Chấm tay
                        </Button>

                        <Button onClick={() => handleSubmitGradeOne(record)}
                            style={{ fontWeight: "bold" }} block size="large" color="green" variant="filled">
                            Chấm lại
                        </Button>

                        <Popconfirm
                            title="Xóa ảnh bài làm"
                            description={`Thầy/cô có chắc muốn xóa ${record.file.name}?`}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => handleRemoveImage(record)}
                            disabled={isSubmitting}
                        >
                            <Button
                                disabled={isSubmitting}
                                style={{ fontWeight: "bold" }}
                                block
                                size="large"
                                color="danger"
                                variant="filled"
                            >
                                Xóa
                            </Button>
                        </Popconfirm>
                    </div>
                );
            },
        },
    ];


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

    const showUpdateRowImg = (defaultImg: IImageRow | null) => {
        const handleReplaceImg = (file: File) => {
            if (!defaultImg) {
                return false;
            }

            replaceImageRow(defaultImg.id, file);

            return false;
        }

        const handleCaptureReplacement = (
            event: React.ChangeEvent<HTMLInputElement>
        ) => {
            const input = event.currentTarget;
            const file = input.files?.[0];

            input.value = "";

            if (file) {
                handleReplaceImg(file);
            }
        };

        return (
            <Modal
                title="Chọn phương thức thay đổi ảnh"
                open={show}
                onCancel={handleCloseModal}
                width={620}
                footer={[
                    <Button key="cancel" onClick={handleCloseModal}>
                        Hủy
                    </Button>,
                ]}
            >
                <div className="grid gap-3 pt-5 sm:grid-cols-3">
                    <Button
                        block
                        icon={<Camera size={17} />}
                        onClick={() => replacementCameraInputRef.current?.click()}
                    >
                        Camera thiết bị
                    </Button>

                    <input
                        ref={replacementCameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleCaptureReplacement}
                        className="hidden"
                    />

                    <Upload
                        beforeUpload={handleReplaceImg}
                        showUploadList={false}
                        accept=".jpg,.png,.jpeg"
                        className="block"
                    >
                        <Button block icon={<UploadCloud size={17} />}>
                            Import ảnh
                        </Button>
                    </Upload>

                    <Button
                        block
                        icon={<Smartphone size={17} />}
                        disabled={!defaultImg}
                        onClick={() => {
                            if (defaultImg) {
                                void handleOpenReplacementCamera(defaultImg.id);
                            }
                        }}
                    >
                        Camera iPhone
                    </Button>
                </div>
            </Modal >
        )
    }

    const handleSubmitGradeOne = async (targetRow: IImageRow) => {
        if (!templateId) {
            toast.warning("Không xác định được mẫu phiếu chấm");
            return;
        }

        setIsSubmitting(true);

        setImageRows((previousRows) =>
            previousRows.map((row) =>
                row.id === targetRow.id
                    ? { ...row, status: "Đang chấm" }
                    : row
            )
        );

        try {
            const formData = new FormData();

            // Chỉ gửi một file
            formData.append("files", targetRow.file);

            formData.append("templateId", templateId);
            formData.append(
                "answerKeys",
                JSON.stringify(answerKeys)
            );
            formData.append(
                "gradingConfig",
                JSON.stringify(pointSettings)
            );

            const response = await fetch(
                getGradingApiUrl(),
                {
                    method: "POST",
                    body: formData,
                }
            );

            const result: IGradeResponse =
                await response.json();


            // Vì chỉ gửi một ảnh nên lấy kết quả đầu tiên
            const gradeResult = result.data[0];

            if (
                !gradeResult ||
                !gradeResult.success ||
                !gradeResult.data
            ) {
                throw new Error(
                    gradeResult?.error ?? "Không nhận được kết quả chấm"
                );
            }

            const gradeData = gradeResult.data;

            const matchedStudent =
                targetClass?.students.find(
                    (student) =>
                        student.sbd == gradeData.stuCode
                );

            // Chỉ cập nhật đúng dòng được chấm
            setImageRows((previousRows) =>
                previousRows.map((row) =>
                    row.id === targetRow.id
                        ? {
                            ...row,
                            stuCode: gradeData.stuCode ?? "",
                            examCode: gradeData.examCode ?? "",
                            name: matchedStudent?.name ?? "",
                            correctAnswers:
                                gradeData.correctAnswers ?? 0,
                            inCorrectAnswers:
                                gradeData.inCorrectAnswers ?? 0,
                            score: gradeData.score ?? 0,
                            fileAnswer:
                                gradeData.resultImageUrl ?? null,
                            status: "Đã chấm",
                        }
                        : row
                )
            );

            toast.success("Chấm lại ảnh thành công");
        } catch (error) {
            console.error("Lỗi chấm ảnh:", error);

            // Chỉ đặt trạng thái lỗi cho ảnh đang chấm
            setImageRows((previousRows) =>
                previousRows.map((row) =>
                    row.id === targetRow.id
                        ? { ...row, status: "Lỗi" }
                        : row
                )
            );

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Chấm ảnh thất bại"
            );
        } finally {
            setIsSubmitting(false);
        }
    };

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

                <div className="grid gap-4 md:grid-cols-2">
                    <button
                        type="button"
                        onClick={handleOpenRemoteCamera}
                        disabled={isSubmitting}
                        className="border-2 border-dashed border-pink-300 bg-pink-50/30 rounded-2xl min-h-52 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-50 hover:border-pink-400 transition-all group px-4 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                            <Smartphone
                                size={32}
                                className="text-pink-500"
                            />
                        </div>

                        <p className="font-semibold text-gray-700 text-lg mb-1 text-center">
                            Dùng iPhone chụp từ xa
                        </p>

                        <p className="text-gray-400 text-sm font-medium text-center">
                            Quét QR, ảnh tự chuyển về máy tính
                        </p>
                    </button>

                    <label className="border-2 border-dashed border-pink-300 bg-pink-50/30 rounded-2xl min-h-52 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-50 hover:border-pink-400 transition-all group px-4">
                        <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                            <UploadCloud
                                size={32}
                                className="text-pink-500"
                            />
                        </div>

                        <p className="font-semibold text-gray-700 text-lg mb-1 text-center">
                            Chọn ảnh từ thiết bị
                        </p>

                        <p className="text-gray-400 text-sm font-medium text-center">
                            Hỗ trợ nhiều ảnh JPG, PNG, JPEG
                        </p>

                        <input
                            type="file"
                            multiple
                            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                            onChange={handleSelectFile}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>

            <Modal
                title="Chấm tay bài thi"
                open={manualGradeOpen}
                onCancel={handleCloseManualGrade}
                onOk={() => void handleSaveManualGrade()}
                okText="Lưu kết quả"
                cancelText="Hủy"
                width={1120}
                okButtonProps={{
                    style: {
                        backgroundColor: "#9f3f50",
                        fontWeight: 600,
                    },
                }}
            >
                <div className="grid gap-6 pt-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
                    <section className="overflow-hidden rounded-2xl border border-rose-100 bg-[#fff8f9] p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="font-semibold text-gray-800">
                                    Ảnh bài thi gốc
                                </p>
                                <p className="truncate text-xs text-gray-500">
                                    {manualGradeRow?.file.name ?? "Chưa chọn ảnh"}
                                </p>
                            </div>
                            {manualGradeRow && (
                                <Tag color={manualGradeRow.status === "Đã chấm" ? "success" : "default"}>
                                    {manualGradeRow.status}
                                </Tag>
                            )}
                        </div>

                        <div className="flex min-h-[420px] items-center justify-center overflow-auto rounded-xl border border-rose-100 bg-gray-100 p-3 lg:h-[65vh] lg:max-h-[680px]">
                            {manualGradeRow ? (
                                <Image
                                    src={manualGradeRow.previewUrl}
                                    alt={manualGradeRow.file.name}
                                    preview={{ mask: "Phóng lớn" }}
                                    className="!max-h-[640px] !w-auto !max-w-full !object-contain"
                                />
                            ) : (
                                <span className="text-sm text-gray-400">
                                    Không có ảnh bài thi
                                </span>
                            )}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
                        <div className="mb-5 border-b border-rose-100 pb-4">
                            <h4 className="text-lg font-bold text-[#8f3c4a]">
                                Nhập kết quả bài làm
                            </h4>
                            <p className="mt-1 text-sm text-gray-500">
                                Chọn đúng thí sinh và mã đề trước khi lưu kết quả.
                            </p>
                        </div>

                        <Form<IManualGradeValues>
                            form={manualGradeForm}
                            layout="vertical"
                            requiredMark={false}
                        >
                            <Form.Item
                                label="Số báo danh"
                                name="stuCode"
                                rules={[{ required: true, message: "Vui lòng nhập số báo danh" }]}
                            >
                                <AutoComplete
                                    placeholder="Nhập hoặc chọn số báo danh"
                                    options={(targetClass?.students ?? []).map((student) => ({
                                        value: String(student.sbd),
                                        label: `${student.sbd} - ${student.name}`,
                                    }))}
                                    onChange={handleManualStudentCodeChange}
                                    filterOption={(inputValue, option) =>
                                        String(option?.label ?? "")
                                            .toLowerCase()
                                            .includes(inputValue.toLowerCase())
                                    }
                                />
                            </Form.Item>

                            <Form.Item
                                label="Họ và tên"
                                name="name"
                                rules={[{ required: true, message: "Vui lòng nhập họ và tên" }]}
                            >
                                <Input placeholder="Họ và tên thí sinh" />
                            </Form.Item>

                            <Form.Item
                                label="Mã đề"
                                name="examCode"
                                rules={[{ required: true, message: "Vui lòng chọn mã đề" }]}
                            >
                                <Select
                                    placeholder="Chọn mã đề"
                                    onChange={handleManualExamCodeChange}
                                    options={Object.keys(answerKeys).map((examCode) => ({
                                        value: examCode,
                                        label: `Mã đề ${examCode}`,
                                    }))}
                                />
                            </Form.Item>

                            <div className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-[#8f3c4a]">
                                Mã đề đang chọn có <strong>{manualAnswerTotal}</strong> đáp án cần chấm.
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Form.Item
                                    label="Số câu đúng"
                                    name="correctAnswers"
                                    rules={[
                                        { required: true, message: "Nhập số câu đúng" },
                                        {
                                            validator: (_, value) =>
                                                Number(value) <= manualAnswerTotal
                                                    ? Promise.resolve()
                                                    : Promise.reject(
                                                        new Error(`Tối đa ${manualAnswerTotal} câu`)
                                                    ),
                                        },
                                    ]}
                                >
                                    <InputNumber
                                        min={0}
                                        max={manualAnswerTotal}
                                        precision={0}
                                        className="!w-full"
                                        onChange={handleManualCorrectAnswersChange}
                                    />
                                </Form.Item>

                                <Form.Item
                                    label="Số câu sai"
                                    name="inCorrectAnswers"
                                >
                                    <InputNumber
                                        min={0}
                                        precision={0}
                                        readOnly
                                        className="!w-full"
                                    />
                                </Form.Item>
                            </div>

                            <Form.Item
                                label="Điểm bài thi"
                                name="score"
                                rules={[{ required: true, message: "Vui lòng nhập điểm" }]}
                            >
                                <InputNumber
                                    min={0}
                                    max={10}
                                    step={0.25}
                                    precision={2}
                                    className="!w-full"
                                />
                            </Form.Item>

                            <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
                                Chấm tay chỉ cập nhật kết quả của ảnh này. Ảnh gốc vẫn được giữ để giáo viên kiểm tra lại khi cần.
                            </p>
                        </Form>
                    </section>
                </div>
            </Modal>

            <Modal
                title={captureMode === "replace"
                    ? "Chụp ảnh thay thế bằng iPhone"
                    : "Kết nối camera iPhone"
                }
                open={captureModalOpen}
                onCancel={handleCloseCaptureModal}
                footer={null}
                width={520}
            >
                {isCreatingCaptureSession ? (
                    <div className="py-12 text-center text-gray-500">
                        Đang tạo phiên chụp ảnh...
                    </div>
                ) : (
                    <div className="pt-2 text-center">
                        <p className="mb-4 text-sm leading-6 text-gray-500">
                            {captureMode === "replace"
                                ? "Quét QR bằng Camera iPhone rồi chụp và gửi. Ảnh đầu tiên nhận được sẽ thay thế đúng bài thi đang sửa."
                                : "Quét QR bằng Camera iPhone, chụp phiếu rồi bấm gửi. Ảnh sẽ tự chuyển về danh sách trên máy tính."
                            }
                        </p>

                        {captureQrCode && (
                            <Image
                                src={captureQrCode}
                                alt="QR mở trang camera iPhone"
                                preview={false}
                                width={256}
                                height={256}
                                rootClassName="mx-auto"
                                className="rounded-2xl border border-rose-100 bg-white p-2"
                            />
                        )}

                        <div className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-[#8f3c4a]">
                            {captureMode === "replace"
                                ? "Đang chờ ảnh thay thế"
                                : `Đang chờ ảnh · Đã nhận ${receivedCaptureCount} ảnh`
                            }
                        </div>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={handleCopyCaptureUrl}
                                disabled={!capturePageUrl}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-3 font-semibold text-[#8f3c4a] disabled:opacity-50"
                            >
                                <Copy size={17} />
                                Sao chép đường dẫn
                            </button>

                            <a
                                href={capturePageUrl || undefined}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#9f3f50] px-4 py-3 font-semibold text-white ${capturePageUrl ? "" : "pointer-events-none opacity-50"
                                    }`}
                            >
                                <ExternalLink size={17} />
                                Mở thử trang camera
                            </a>
                        </div>
                    </div>
                )}
            </Modal>

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
            {showUpdateRowImg(defaultImg)}
        </>
    );
};

export default RenderUploadImage;
