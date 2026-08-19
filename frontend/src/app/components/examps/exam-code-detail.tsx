"use client";

import { Button, Image, Input, Modal, Space, Switch, Tabs } from "antd";
import { ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { handleUpdatePointSettings } from "@/app/action";
import {
    getPointSettings,
    type IGradingConfig,
    type IPointSettings,
} from "@/app/types/grading";
import RenderUploadImage from "../image/upload-img";

const templateImages: Record<string, { name: string; image: string }> = {
    "template-000": { name: "Mẫu App5 - Phiếu OMR B", image: "/Image/image.png" },
    "template-001": { name: "Mẫu App1 - THPT Quốc Gia", image: "/Image/image1.png" },
    "template-002": { name: "Mẫu App2 - Đánh Giá Năng Lực", image: "/Image/image2.png" },
    "template-003": { name: "Mẫu App3 - Cuối Kỳ", image: "/Image/image3.png" },
    "template-004": { name: "Mẫu App4 - Phiếu OMR A", image: "/Image/image4.png" },
};

const normalizePointInput = (value: string) => {
    const parsedValue = Number(value);

    if (!Number.isFinite(parsedValue)) {
        return 0;
    }

    return Math.min(Math.max(parsedValue, 0), 10);
};

interface IAnswer {
    mcq: Record<string, string>;

    trueFalse: Record<
        string,
        Record<string, boolean>
    >;

    shortAnswer: Record<
        string,
        {
            answer: string;
            acceptedAnswers: string[];
            numericValue: number;
            tolerance: number;
        }
    >;
}

interface IProps {
    exam: IAnswer;
    examId: string;
    examCode: string;
    answerKeys: Record<string, IAnswer>;
    templateId: string;
    targetClass: IClassRoom | null;
    initialGradingConfig?: IGradingConfig;

}

const ExamCodeDetail = ({ exam: answerKey, examId, examCode, answerKeys, templateId, targetClass, initialGradingConfig, }: IProps) => {
    const examCodes = Object.keys(answerKeys);
    const isGradingAllCodes = examCode === "all";
    const selectedTemplate = templateImages[templateId] ?? templateImages["template-000"];
    const [selectedExamCodeIndex, setSelectedExamCodeIndex] = useState(0);
    const selectedExamCode = isGradingAllCodes
        ? examCodes[selectedExamCodeIndex]
        : examCode;
    const displayedAnswerKey = isGradingAllCodes
        ? answerKeys[selectedExamCode] ?? answerKey
        : answerKey;

    const mcqAnswers = Object.entries(displayedAnswerKey.mcq ?? {});
    const trueFalseAnswers = Object.entries(displayedAnswerKey.trueFalse ?? {});
    const shortAnswers = Object.entries(displayedAnswerKey.shortAnswer ?? {});

    const trueFalseAnswerCount = trueFalseAnswers.reduce(
        (total, [, statements]) => total + Object.keys(statements).length,
        0
    );

    const totalAnswerCount = mcqAnswers.length + trueFalseAnswerCount + shortAnswers.length;
    const defaultPointsPerAnswer = totalAnswerCount > 0 ? 10 / totalAnswerCount : 0;
    const defaultPart2PointsPerQuestion = trueFalseAnswers.length > 0 ? defaultPointsPerAnswer * (trueFalseAnswerCount / trueFalseAnswers.length) : 0;

    console.log(trueFalseAnswerCount)

    const [showPointSettings, setShowPointSettings] = useState(false);
    const [isSavingPointSettings, setIsSavingPointSettings] = useState(false);
    const [pointSettings, setPointSettings] = useState<IPointSettings>(() =>
        getPointSettings(
            initialGradingConfig,
            defaultPointsPerAnswer,
            defaultPart2PointsPerQuestion
        )
    );
    const [draftPointSettings, setDraftPointSettings] = useState<IPointSettings>(() =>
        getPointSettings(
            initialGradingConfig,
            defaultPointsPerAnswer,
            defaultPart2PointsPerQuestion
        )
    );

    const handleOpenPointSettings = () => {
        setDraftPointSettings({ ...pointSettings });
        setShowPointSettings(true);
    };

    const handleClosePointSettings = () => {
        if (!isSavingPointSettings) {
            setShowPointSettings(false);
        }
    };

    const handleSavePointSettings = async () => {
        setIsSavingPointSettings(true);

        const result = await handleUpdatePointSettings(
            examId,
            draftPointSettings
        );

        setIsSavingPointSettings(false);

        if (!result.success) {
            toast.error(result.message);
            return;
        }

        setPointSettings({ ...draftPointSettings });
        setShowPointSettings(false);
        toast.success(result.message);
    };

    const part1MaximumScore = Number(
        (mcqAnswers.length * draftPointSettings.part1PointsPerQuestion).toFixed(2)
    );
    const part2MaximumScore = Number(
        (trueFalseAnswers.length * draftPointSettings.part2PointsPerQuestion).toFixed(2)
    );
    const part3MaximumScore = Number(
        (shortAnswers.length * draftPointSettings.part3PointsPerQuestion).toFixed(2)
    );



    return (
        <div className="min-h-screen bg-[#fff0f3] font-sans text-gray-800">
            <main className="min-w-0">
                <div className="p-4 md:p-8">
                    <div className="max-w-6xl mx-auto space-y-6">
                        {/* Thông tin mã đề và đáp án */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            {/* Thông tin mẫu đề */}
                            <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <h4 className="font-bold text-lg text-gray-800 mb-5">
                                    Thông tin mẫu đề
                                </h4>

                                <div className="mb-5 overflow-hidden rounded-xl border border-pink-100 bg-pink-50/30 p-3">
                                    <Image
                                        src={selectedTemplate.image}
                                        alt={selectedTemplate.name}
                                        width="100%"
                                        height={230}
                                        className="!object-contain"
                                        preview={{ mask: "Xem ảnh mẫu" }}
                                    />
                                    <div className="mt-3 text-center">
                                        <p className="text-sm font-semibold text-gray-700">
                                            {selectedTemplate.name}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-400">
                                            {templateId} · Bấm vào ảnh để phóng lớn
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                                        <span className="text-gray-500">
                                            {isGradingAllCodes ? "Phạm vi chấm" : "Mã đề"}
                                        </span>
                                        <span className="text-right font-bold text-pink-700">
                                            {isGradingAllCodes
                                                ? `Tất cả (${examCodes.length} mã)`
                                                : examCode}
                                        </span>
                                    </div>

                                    <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                                        <span className="text-gray-500"> Trắc nghiệm</span>
                                        <span className="font-semibold"> {mcqAnswers.length} câu</span>
                                    </div>

                                    <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                                        <span className="text-gray-500">Đúng/Sai</span>
                                        <span className="font-semibold">{trueFalseAnswers.length} câu</span>
                                    </div>

                                    <div className="flex justify-between gap-4">
                                        <span className="text-gray-500">Trả lời ngắn</span>
                                        <span className="font-semibold"> {shortAnswers.length} câu </span>
                                    </div>
                                </div>
                            </div>

                            {/* Đáp án đã lưu */}
                            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h4 className="font-bold text-lg text-gray-800">Đáp án đã lưu</h4>
                                        <p className="mt-1 text-sm text-gray-500">
                                            {isGradingAllCodes
                                                ? `Đang hiển thị đáp án mã ${selectedExamCode}. Khi chấm, hệ thống vẫn tự nhận diện và chọn đúng đáp án của toàn bộ mã đề.`
                                                : `Cấu hình hiện tại: Phần 1 ${Number(pointSettings.part1PointsPerQuestion.toFixed(6))} điểm/câu, Phần 2 ${Number(pointSettings.part2PointsPerQuestion.toFixed(6))} điểm/câu, Phần 3 ${Number(pointSettings.part3PointsPerQuestion.toFixed(6))} điểm/câu`}
                                        </p>
                                    </div>

                                    <Button
                                        icon={<Settings2 size={16} />}
                                        onClick={handleOpenPointSettings}
                                        style={{
                                            borderColor: "#f9a8d4",
                                            color: "#be185d",
                                            fontWeight: 600,
                                        }}
                                    >
                                        Thiết lập điểm
                                    </Button>
                                </div>

                                <Tabs
                                    type="card"
                                    defaultActiveKey="part-1"
                                    className="[&_.ant-tabs-nav]:!mb-4 [&_.ant-tabs-tab]:!font-semibold"
                                    items={[
                                        {
                                            key: "part-1",
                                            label: `1 · Phần 1 (${mcqAnswers.length})`,
                                            children: (
                                                <div className="min-h-48 rounded-xl border border-pink-100 bg-pink-50/40 p-4">
                                                    <h5 className="mb-3 font-bold text-pink-700">
                                                        Đáp án trắc nghiệm
                                                    </h5>

                                                    {mcqAnswers.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {mcqAnswers.map(([question, answer]) => (
                                                                <span
                                                                    key={question}
                                                                    className="rounded-lg border border-pink-100 bg-white px-2.5 py-1 text-sm"
                                                                >
                                                                    Câu {question}: <strong>{answer}</strong>
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-400">
                                                            Không có câu trắc nghiệm
                                                        </p>
                                                    )}
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "part-2",
                                            label: `2 · Phần 2 (${trueFalseAnswers.length})`,
                                            children: (
                                                <div className="min-h-48 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                                                    <h5 className="mb-3 font-bold text-blue-700">
                                                        Đáp án đúng/sai
                                                    </h5>

                                                    {trueFalseAnswers.length > 0 ? (
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            {trueFalseAnswers.map(([question, statements]) => (
                                                                <div
                                                                    key={question}
                                                                    className="rounded-lg border border-blue-100 bg-white p-3 text-sm"
                                                                >
                                                                    <p className="mb-2 font-semibold">Câu {question}</p>
                                                                    <div className="flex flex-wrap gap-3">
                                                                        {Object.entries(statements).map(([statement, value]) => (
                                                                            <span
                                                                                key={statement}
                                                                                className={value ? "font-medium text-green-600" : "font-medium text-red-500"}
                                                                            >
                                                                                {statement}: {value ? "Đ" : "S"}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-400">
                                                            Không có câu đúng/sai
                                                        </p>
                                                    )}
                                                </div>
                                            ),
                                        },
                                        {
                                            key: "part-3",
                                            label: `3 · Phần 3 (${shortAnswers.length})`,
                                            children: (
                                                <div className="min-h-48 rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                                                    <h5 className="mb-3 font-bold text-amber-700">
                                                        Đáp án trả lời ngắn
                                                    </h5>

                                                    {shortAnswers.length > 0 ? (
                                                        <div className="grid gap-2 sm:grid-cols-2">
                                                            {shortAnswers.map(([question, answerData]) => (
                                                                <div
                                                                    key={question}
                                                                    className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm"
                                                                >
                                                                    Câu {question}: <strong>{answerData.answer}</strong>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-400">
                                                            Không có câu trả lời ngắn
                                                        </p>
                                                    )}
                                                </div>
                                            ),
                                        },
                                    ]}
                                />

                                {isGradingAllCodes && (
                                    <div className="mt-5 flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
                                        <span className="ml-1 text-xs text-gray-400">
                                            {selectedExamCodeIndex + 1}/{examCodes.length} mã đề
                                        </span>
                                        <button
                                            type="button"
                                            aria-label="Xem mã đề trước"
                                            disabled={selectedExamCodeIndex === 0}
                                            onClick={() => setSelectedExamCodeIndex((index) => index - 1)}
                                            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-pink-50 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-30"
                                        >
                                            <ChevronLeft size={18} />
                                        </button>

                                        <span className="flex h-10 min-w-10 items-center justify-center rounded-full border border-pink-500 bg-white px-2 text-sm font-bold text-pink-600 shadow-sm">
                                            {selectedExamCode}
                                        </span>

                                        <button
                                            type="button"
                                            aria-label="Xem mã đề tiếp theo"
                                            disabled={selectedExamCodeIndex === examCodes.length - 1}
                                            onClick={() => setSelectedExamCodeIndex((index) => index + 1)}
                                            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-pink-50 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-30"
                                        >
                                            <ChevronRight size={18} />
                                        </button>


                                    </div>
                                )}
                            </div>
                        </div>

                        <Modal
                            title={
                                <div>
                                    <div className="text-lg font-bold text-gray-800">
                                        Thiết lập điểm từng phần
                                    </div>
                                    <div className="mt-1 text-sm font-normal text-gray-500">
                                        Cấu hình này áp dụng cho toàn bộ mã đề trong đợt thi.
                                    </div>
                                </div>
                            }
                            open={showPointSettings}
                            width={720}
                            centered
                            destroyOnHidden
                            okText="Lưu cấu hình"
                            cancelText="Hủy"
                            confirmLoading={isSavingPointSettings}
                            onOk={handleSavePointSettings}
                            onCancel={handleClosePointSettings}
                            okButtonProps={{
                                style: {
                                    backgroundColor: "#ec4899",
                                    borderColor: "#ec4899",
                                    fontWeight: 600,
                                },
                            }}
                            cancelButtonProps={{
                                disabled: isSavingPointSettings,
                                style: { fontWeight: 600 },
                            }}
                            styles={{
                                container: {
                                    borderRadius: 20,
                                    overflow: "hidden",
                                },
                                header: {
                                    borderBottom: "1px solid #fce7f3",
                                    paddingBottom: 16,
                                },
                                body: {
                                    paddingTop: 20,
                                },
                            }}
                        >
                            <div className="space-y-4">
                                <section className="rounded-2xl border border-pink-200 bg-pink-50/50 p-5">
                                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500 font-bold text-white">
                                                    1
                                                </span>
                                                <div>
                                                    <h5 className="font-bold text-pink-800">Phần 1 - Trắc nghiệm</h5>
                                                    <p className="text-sm text-pink-700/70">
                                                        {mcqAnswers.length} câu · tối đa {part1MaximumScore} điểm
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <label className="flex min-w-210px flex-col gap-1.5">
                                            <span className="text-sm font-semibold text-gray-700">
                                                Điểm cho mỗi câu đúng
                                            </span>
                                            <Space.Compact className="w-full">
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    min={0}
                                                    max={10}
                                                    step={0.000001}
                                                    size="large"
                                                    className="!w-full"
                                                    value={draftPointSettings.part1PointsPerQuestion}
                                                    onChange={(event) =>
                                                        setDraftPointSettings((previous) => ({
                                                            ...previous,
                                                            part1PointsPerQuestion:
                                                                normalizePointInput(event.target.value),
                                                        }))
                                                    }
                                                />

                                                <Button size="large" className="pointer-events-none">
                                                    điểm
                                                </Button>
                                            </Space.Compact>
                                        </label>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
                                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 font-bold text-white">
                                                2
                                            </span>
                                            <div>
                                                <h5 className="font-bold text-blue-800">Phần 2 - Đúng/Sai</h5>
                                                <p className="text-sm text-blue-700/70">
                                                    {trueFalseAnswers.length} câu · {trueFalseAnswerCount} ý · tối đa {part2MaximumScore} điểm
                                                </p>
                                            </div>
                                        </div>

                                        <label className="flex min-w-[210px] flex-col gap-1.5">
                                            <span className="text-sm font-semibold text-gray-700">
                                                Điểm tối đa mỗi câu
                                            </span>
                                            <Space.Compact className="w-full">
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    min={0}
                                                    max={10}
                                                    step={0.000001}
                                                    size="large"
                                                    className="!w-full"
                                                    value={draftPointSettings.part2PointsPerQuestion}
                                                    onChange={(event) =>
                                                        setDraftPointSettings((previous) => ({
                                                            ...previous,
                                                            part2PointsPerQuestion:
                                                                normalizePointInput(event.target.value),
                                                        }))
                                                    }
                                                />
                                                <Button size="large" className="pointer-events-none">
                                                    điểm
                                                </Button>
                                            </Space.Compact>
                                        </label>
                                    </div>

                                    <div className="my-5 h-px bg-blue-200/70" />

                                    <div className="flex items-center justify-between gap-4 rounded-xl bg-white p-4">
                                        <div>
                                            <p className="font-semibold text-gray-800">Chế độ đặc biệt cho Phần 2</p>
                                            <p className="mt-1 text-sm text-gray-500">
                                                Chọn mức điểm trừ theo số ý a, b, c, d bị sai trong từng câu.
                                            </p>
                                        </div>

                                        <Switch
                                            checked={draftPointSettings.part2SpecialMode}
                                            onChange={(checked) =>
                                                setDraftPointSettings((previous) => ({
                                                    ...previous,
                                                    part2SpecialMode: checked,
                                                }))
                                            }
                                        />
                                    </div>

                                    {draftPointSettings.part2SpecialMode && (
                                        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                                            <div className="mb-3">
                                                <span className="font-semibold text-red-700">
                                                    Bảng điểm trừ cho một câu Đúng/Sai
                                                </span>
                                                <p className="mt-1 text-sm text-red-600/70">
                                                    Giáo viên tự nhập từng mức; muốn sai hết bị trừ toàn bộ thì nhập bằng điểm tối đa của câu.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                {(["1", "2", "3", "4"] as const).map((wrongCount) => (
                                                    <label
                                                        key={wrongCount}
                                                        className="rounded-xl border border-red-100 bg-white p-3"
                                                    >
                                                        <span className="mb-1.5 block text-sm font-semibold text-gray-700">
                                                            Sai {wrongCount}/4 ý — trừ
                                                        </span>
                                                        <Space.Compact className="w-full">
                                                            <Input
                                                                type="number"
                                                                inputMode="decimal"
                                                                min={0}
                                                                max={10}
                                                                step={0.000001}
                                                                size="large"
                                                                className="!w-full"
                                                                value={draftPointSettings.part2PenaltyByWrongCount[wrongCount]}
                                                                onChange={(event) =>
                                                                    setDraftPointSettings((previous) => ({
                                                                        ...previous,
                                                                        part2PenaltyByWrongCount: {
                                                                            ...previous.part2PenaltyByWrongCount,
                                                                            [wrongCount]: normalizePointInput(
                                                                                event.target.value
                                                                            ),
                                                                        },
                                                                    }))
                                                                }
                                                            />
                                                            <Button size="large" className="pointer-events-none">
                                                                điểm
                                                            </Button>
                                                        </Space.Compact>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </section>

                                <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
                                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                        <div className="flex items-center gap-2">
                                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 font-bold text-white">
                                                3
                                            </span>
                                            <div>
                                                <h5 className="font-bold text-amber-800">Phần 3 - Trả lời ngắn</h5>
                                                <p className="text-sm text-amber-700/70">
                                                    {shortAnswers.length} câu · tối đa {part3MaximumScore} điểm
                                                </p>
                                            </div>
                                        </div>

                                        <label className="flex min-w-[210px] flex-col gap-1.5">
                                            <span className="text-sm font-semibold text-gray-700">
                                                Điểm cho mỗi câu đúng
                                            </span>
                                            <Space.Compact className="w-full">
                                                <Input
                                                    type="number"
                                                    inputMode="decimal"
                                                    min={0}
                                                    max={10}
                                                    step={0.000001}
                                                    size="large"
                                                    className="!w-full"
                                                    value={draftPointSettings.part3PointsPerQuestion}
                                                    onChange={(event) =>
                                                        setDraftPointSettings((previous) => ({
                                                            ...previous,
                                                            part3PointsPerQuestion:
                                                                normalizePointInput(event.target.value),
                                                        }))
                                                    }
                                                />
                                                <Button size="large" className="pointer-events-none">
                                                    điểm
                                                </Button>
                                            </Space.Compact>
                                        </label>
                                    </div>
                                </section>

                                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                                    <p>
                                        Tổng điểm tối đa của cả ba phần theo cấu hình hiện tại:{" "}
                                        <strong className="text-pink-700">
                                            {Number((part1MaximumScore + part2MaximumScore + part3MaximumScore).toFixed(2))} điểm
                                        </strong>
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Mặc định: 10 điểm / {totalAnswerCount} đáp án ={" "}
                                        {Number(defaultPointsPerAnswer.toFixed(6))} điểm cho mỗi đáp án đúng.
                                    </p>
                                </div>
                            </div>
                        </Modal>

                        {/* Khu vực tải ảnh */}
                        {/* <RenderUploadImage /> */}
                        <RenderUploadImage
                            templateId={templateId}
                            answerKeys={answerKeys}
                            targetClass={targetClass}
                            pointSettings={pointSettings}
                        />
                        {/* Danh sách ảnh */}


                        {/* Các nút thao tác */}

                    </div>
                </div>
            </main>
        </div>
    );
};

export default ExamCodeDetail;
