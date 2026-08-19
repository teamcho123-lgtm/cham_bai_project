"use client";

import { handleCreateAnswerCode } from "@/app/action";
import { Input, Modal } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

interface IAnswer {
    mcq: Record<string, string>;

    trueFalse: Record<string, Record<string, boolean>>;

    shortAnswer: Record<string,
        {
            answer: string;
        }
    >;
}

interface IProps {
    show: boolean;
    closeModal: () => void;
    allCodeExams: IAnswerSheetTemplate;
    defaultAnswerCode: string | null;
    defaultAnswerExam: IAnswer | null;
}

const ShowExamsInput = (prop: IProps) => {
    const { show, closeModal, allCodeExams, defaultAnswerCode, defaultAnswerExam } = prop

    const [mcqCount, setMcqCount] = useState<number>(
        defaultAnswerCode
            ? Object.keys(defaultAnswerExam?.mcq ?? {}).length
            : (allCodeExams.questionCount?.mcq ?? 10)
    )
    const [trueFalseCount, setTrueFalseCount] = useState<number>(
        defaultAnswerCode
            ? Object.keys(defaultAnswerExam?.trueFalse ?? {}).length
            : (allCodeExams.questionCount?.trueFalse ?? 2)
    )
    const [shortAnswerCount, setShortAnswerCount] = useState<number>(
        defaultAnswerCode
            ? Object.keys(defaultAnswerExam?.shortAnswer ?? {}).length
            : (allCodeExams.questionCount?.shortAnswer ?? 2)
    )
    const [answerCode, setAnswerCode] = useState<string>(defaultAnswerCode ?? "")

    const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>(
        defaultAnswerExam?.mcq ?? {}
    );

    const [trueFalseAnswers, setTrueFalseAnswers] = useState<Record<string, Record<string, boolean>>>(
        defaultAnswerExam?.trueFalse ?? {}
    );

    const [shortAnswer, setShortAnswer] = useState<Record<string, string>>(
        defaultAnswerExam?.shortAnswer
            ? Object.fromEntries(
                Object.entries(defaultAnswerExam.shortAnswer).map(
                    ([question, value]) => [question, value.answer]
                )
            )
            : {}
    );
    const router = useRouter();

    const trueFalseOptions = ["a", "b", "c", "d"];

    const normalizeQuestionCount = (value: number) =>
        Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

    const handleTrueFalseCountChange = (nextCount: number) => {
        const normalizedCount = normalizeQuestionCount(nextCount);
        setTrueFalseCount(normalizedCount);
        setTrueFalseAnswers((previous) => {
            const newAnswers: Record<
                number,
                Record<string, boolean>
            > = {};

            for (
                let question = 1;
                question <= normalizedCount;
                question++
            ) {
                newAnswers[question] = {
                    a: previous[question]?.a ?? false,
                    b: previous[question]?.b ?? false,
                    c: previous[question]?.c ?? false,
                    d: previous[question]?.d ?? false,
                };
            }

            return newAnswers;
        });
    };

    const showMcqModal = () => {
        const handleChangeMCQ = (question: number, option: string) => {
            setMcqAnswers((previous) => ({
                ...previous,
                [question]: option,
            }));
        };
        return (
            <div className="bg-white border border-dashed border-pink-700 rounded-xl p-4 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                {/* Render theo số lượng câu */}
                {Array.from({ length: mcqCount }).map(
                    (_, index) => {
                        const question = index + 1;
                        return (
                            <div key={question} className="flex items-center space-x-2 text-sm justify-center mb-2" >
                                <span className="w-6 text-right font-medium text-stone-600"> {question}: </span>
                                {["A", "B", "C", "D"].map(
                                    (option) => (
                                        <label key={option} className="flex items-center space-x-1 cursor-pointer hover:bg-pink-50 p-1 rounded">
                                            <input
                                                type="radio"
                                                name={`mcq-${question}`}
                                                value={option}
                                                checked={mcqAnswers[question] === option}
                                                onChange={() => handleChangeMCQ(question, option)}
                                                className="w-6 h-6 accent-pink-500" />
                                            <span className="text-gray-700">{option}</span>
                                        </label>
                                    )
                                )}
                            </div>
                        );
                    }
                )}
            </div>
        );

    };

    const showTrueFalseModal = () => {
        return (
            <div className="bg-white border border-dashed border-pink-300 rounded-xl p-4 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                <div className="flex justify-center space-x-2 mb-2 text-xs font-bold text-stone-500 pl-8">
                    {trueFalseOptions.map((option) => (
                        <span
                            key={option}
                            className="w-4 text-center"
                        >
                            {option}
                        </span>
                    ))}
                </div>

                {Array.from({
                    length: trueFalseCount,
                }).map((_, index) => {
                    const question = index + 1;

                    return (
                        <div
                            key={`tf-${question}`}
                            className="flex items-center space-x-2 text-sm justify-center mb-2"
                        >
                            <span className="w-6 text-right font-medium text-stone-600">{question}:</span>

                            {trueFalseOptions.map((option) => (
                                <label
                                    key={option}
                                    className="flex items-center space-x-1 cursor-pointer flex-col"
                                >
                                    <input
                                        type="checkbox"
                                        checked={trueFalseAnswers[question]?.[option] ?? false}
                                        onChange={(event) =>
                                            setTrueFalseAnswers(
                                                (previous) => ({
                                                    ...previous, [question]: {
                                                        ...previous[question], [option]: event.target.checked,
                                                    },
                                                })
                                            )
                                        }
                                        className="w-6 h-6 text-pink-800 border-gray-300 rounded focus:ring-pink-500 accent-pink-800"
                                    />
                                </label>
                            ))}
                        </div>
                    );
                })}
            </div>
        );
    };

    const showShortAnswerModal = () => {
        return (
            <div className="bg-white border border-dashed border-pink-300 rounded-xl p-4 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                {Array.from({ length: shortAnswerCount }).map((_, i) => (
                    <div key={`essay-${i}`} className="flex items-center space-x-2 text-sm mb-2">
                        <span className="w-6 text-right font-medium text-stone-600">{i + 1}</span>
                        <input
                            type="text"
                            value={shortAnswer[i + 1] || ""}
                            onChange={(e) => setShortAnswer(prev => ({ ...prev, [i + 1]: e.target.value }))}
                            className="flex-1 border border-pink-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                        />
                    </div>
                ))}
            </div>
        )
    }

    const handleSubmitAction = async () => {
        const examCode = answerCode.trim();
        const isUpdate = defaultAnswerCode !== null;

        if (!examCode) {
            toast.warning("Vui lòng nhập mã đề");
            return;
        }

        const codeExists = allCodeExams.answerKeys?.[examCode];

        // Thêm mới nhưng mã đề đã tồn tại
        if (!isUpdate && codeExists) {
            toast.warning(`Mã đề ${examCode} đã tồn tại`);
            return;
        }

        // Đang sửa và đổi sang một mã đề khác đã tồn tại
        if (isUpdate && examCode !== defaultAnswerCode && codeExists) {
            toast.warning(`Mã đề ${examCode} đã tồn tại`);
            return;
        }

        const normalizedMcqAnswers = Object.fromEntries(
            Object.entries(mcqAnswers).filter(([question]) => {
                const questionNumber = Number(question);
                return questionNumber >= 1 && questionNumber <= mcqCount;
            })
        );

        const normalizedTrueFalseAnswers = Object.fromEntries(
            Object.entries(trueFalseAnswers).filter(([question]) => {
                const questionNumber = Number(question);
                return questionNumber >= 1 && questionNumber <= trueFalseCount;
            })
        );

        const shortAnswerData = Object.fromEntries(
            Object.entries(shortAnswer)
                .filter(([question]) => {
                    const questionNumber = Number(question);
                    return questionNumber >= 1 && questionNumber <= shortAnswerCount;
                })
                .map(
                    ([question, answer]) => {
                        return [
                            question,
                            { answer: answer.trim() },
                        ];
                    }
                )
        );

        const newAnswerData = {
            mcq: normalizedMcqAnswers,
            trueFalse: normalizedTrueFalseAnswers,
            shortAnswer: shortAnswerData,
        };

        // Sao chép toàn bộ mã đề hiện tại
        const updatedAnswerKeys = {
            ...(allCodeExams.answerKeys ?? {}),
        };

        // Nếu đang đổi mã đề, ví dụ 102 thành 104,
        // phải xóa mã 102 cũ
        if (
            isUpdate &&
            defaultAnswerCode !== examCode
        ) {
            delete updatedAnswerKeys[
                defaultAnswerCode
            ];
        }

        // Thêm mới hoặc ghi đè mã đề đang sửa
        updatedAnswerKeys[examCode] = newAnswerData;

        const currentTime = dayjs().format(
            "YYYY-MM-DDTHH:mm:ssZ"
        );

        const dataUpdate = {
            answerKeys: updatedAnswerKeys,

            questionCount: {
                mcq: mcqCount,
                trueFalse: trueFalseCount,
                shortAnswer: shortAnswerCount,
            },

            updatedAt: currentTime,
        };

        console.log(
            isUpdate
                ? "Dữ liệu cập nhật mã đề:"
                : "Dữ liệu thêm mã đề:",
            dataUpdate
        );

        const res = await handleCreateAnswerCode(
            allCodeExams.id,
            dataUpdate,
            allCodeExams,
        );

        if (res?.success === true) {
            toast.success(isUpdate ? "Cập nhật mã đề thành công :)" : "Thêm mã đề thành công :)"
            );

            setAnswerCode("");
            setMcqAnswers({});
            setTrueFalseAnswers({});
            setShortAnswer({});

            closeModal();
            router.refresh();
        } else {
            toast.error(res?.message ?? (isUpdate ? "Cập nhật mã đề thất bại :(" : "Thêm mã đề thất bại :("));
        }
    };

    return (
        <Modal
            open={show}
            onCancel={() => closeModal()}
            onOk={handleSubmitAction}
            width="calc(100vw - 32px)"
            style={{ top: 16, maxWidth: "1400px", paddingBottom: 0, }}
            styles={{ body: { padding: 0, maxHeight: "calc(100vh - 32px)", overflowY: "auto", }, }}
            destroyOnHidden
        >
            <div className="bg-white rounded-3xl border border-pink-100 shadow-md p-5 sm:p-6">
                {/* Tiêu đề */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-pink-100 pb-4">
                    <div>
                        <h3 className="text-xl font-bold text-stone-800"> Nhập đáp án mã đề</h3>
                        <p className="text-sm text-stone-500 mt-1">Thiết lập đáp án cho từng phần của bài kiểm tra</p>
                    </div>
                    <Input
                        placeholder="Nhập mã đề"
                        value={answerCode}
                        onChange={(event) => {
                            setAnswerCode(event.target.value);
                        }}
                        style={{ width: "100px" }}
                        className="w-16 border border-pink-200 rounded px-2 py-1 text-center"
                    />
                </div>

                {/* Khu vực nhập đáp án */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
                    {/* Phần trắc nghiệm */}
                    <div className="bg-[#fff5f7] border border-pink-200 rounded-2xl p-4">
                        <h5 className="font-bold text-stone-800 mb-3 border-b border-pink-200 pb-2"> 1. Trắc nghiệm</h5>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm text-stone-600"> Số câu: </span>
                            <input
                                type="number"
                                min={0}
                                value={mcqCount}
                                onChange={(event) =>
                                    setMcqCount(normalizeQuestionCount(Number(event.target.value)))
                                }
                                className="w-20 border border-pink-200 rounded px-2 py-1 text-center outline-none" />
                        </div>
                        <div className="bg-white border border-dashed border-pink-300 rounded-xl p-4 min-h-[250px]">
                            {/* Thêm danh sách câu trắc nghiệm tại đây */}
                            {showMcqModal()}
                        </div>
                    </div>
                    <div className="bg-[#fff5f7] border border-pink-200 rounded-2xl p-4">
                        <h5 className="font-bold text-stone-800 mb-3 border-b border-pink-200 pb-2">2. Đúng/Sai</h5>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm text-stone-600"> Số câu:</span>
                            <input
                                value={trueFalseCount}
                                onChange={(event) => handleTrueFalseCountChange(Number(event.target.value))}
                                type="number"
                                min={0}
                                className="w-16 border border-pink-200 rounded px-2 py-1 text-center"
                            />
                        </div>
                        <div className="bg-white border border-dashed border-pink-300 rounded-xl p-4 min-h-[250px]">
                            {/* Thêm danh sách câu đúng sai tại đây */}
                            {showTrueFalseModal()}
                        </div>
                    </div>
                    <div className="bg-[#fff5f7] border border-pink-200 rounded-2xl p-4">
                        <h5 className="font-bold text-stone-800 mb-3 border-b border-pink-200 pb-2">  3. Trả lời ngắn</h5>
                        <div className="flex items-center gap-2 mb-4">
                            <span className="text-sm text-stone-600"> Số câu:</span>

                            <input
                                value={shortAnswerCount}
                                onChange={(event) =>
                                    setShortAnswerCount(normalizeQuestionCount(Number(event.target.value)))
                                }
                                type="number"
                                min={0}
                                className="w-16 border border-pink-200 rounded px-2 py-1 text-center"
                            />
                        </div>
                        <div className="bg-white border border-dashed border-pink-300 rounded-xl p-4 min-h-[250px]">
                            {/* Thêm danh sách câu trả lời ngắn tại đây */}
                            {showShortAnswerModal()}
                        </div>
                    </div>
                </div>
            </div>
        </Modal>

    );
};

export default ShowExamsInput;
