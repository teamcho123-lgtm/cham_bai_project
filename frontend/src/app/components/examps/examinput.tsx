"use client";

import { handleCreateAnswerCode } from "@/app/action";
import { Input, Modal } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

interface IAnswer {
    mcq: Record<string, string>;

    trueFalse: Record<string, Record<string, boolean>>;

    shortAnswer: Record<string,
        {
            answer: string;
            numericValue: number;
            tolerance: number;
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

    const [mcqCount, setMcqCount] = useState<number>(10)
    const [trueFalseCount, setTrueFalseCount] = useState<number>(2)
    const [shortAnswerCount, setShortAnswerCount] = useState<number>(2)
    const [answerCode, setAnswerCode] = useState<string>("")

    const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({});

    const [trueFalseAnswers, setTrueFalseAnswers] = useState<Record<string, Record<string, boolean>>>({});

    const [shortAnswer, setShortAnswer] = useState<Record<string, string>>({});

    const trueFalseOptions = ["a", "b", "c", "d"];

    console.log(defaultAnswerExam)

    useEffect(() => {
        setTrueFalseAnswers((previous) => {
            const newAnswers: Record<
                number,
                Record<string, boolean>
            > = {};

            for (
                let question = 1;
                question <= trueFalseCount;
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
    }, [trueFalseCount]);

    useEffect(() => {
        if (!show) {
            return;
        }

        // Thêm mới
        if (!defaultAnswerCode) {
            setAnswerCode("");
            setMcqAnswers({});
            setShortAnswer({});

            setMcqCount(allCodeExams.questionCount?.mcq ?? 10);
            setTrueFalseCount(allCodeExams.questionCount?.trueFalse ?? 2);
            setShortAnswerCount(allCodeExams.questionCount?.shortAnswer ?? 2);

            return;
        }

        // Chỉnh sửa
        const oldAnswers = allCodeExams.answerKeys?.[defaultAnswerCode];
        if (!oldAnswers) {
            return;
        }
        setAnswerCode(defaultAnswerCode);
        setMcqAnswers(defaultAnswerExam?.mcq ?? {});
        setTrueFalseAnswers(defaultAnswerExam?.trueFalse ?? {});

        setShortAnswer(
            defaultAnswerExam?.shortAnswer
                ? Object.fromEntries(
                    Object.entries(defaultAnswerExam.shortAnswer).map(
                        ([question, value]) => [question, value.answer]
                    )
                )
                : {}
        );

    }, [
        show,
        defaultAnswerCode,
        allCodeExams,
    ]);

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

        const shortAnswerData = Object.fromEntries(
            Object.entries(shortAnswer).map(
                ([question, answer]) => {
                    const normalizedAnswer = answer.replace(",", ".");

                    return [
                        question,
                        { answer },
                    ];
                }
            )
        );

        const newAnswerData = {
            mcq: mcqAnswers,
            trueFalse: trueFalseAnswers,
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
        updatedAnswerKeys[examCode] =
            newAnswerData;

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
            dataUpdate
        );

        if (res?.success === true) {
            toast.success(
                isUpdate
                    ? "Cập nhật mã đề thành công :)"
                    : "Thêm mã đề thành công :)"
            );

            setAnswerCode("");
            setMcqAnswers({});
            setTrueFalseAnswers({});
            setShortAnswer({});

            closeModal();
        } else {
            toast.error(
                res?.message ??
                (isUpdate
                    ? "Cập nhật mã đề thất bại :("
                    : "Thêm mã đề thất bại :(")
            );
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
                                min={1}
                                value={mcqCount}
                                onChange={(event) => setMcqCount(Number(event.target.value))}
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
                                onChange={(event) => setTrueFalseCount(Number(event.target.value))}
                                type="number"
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
                                onChange={(event) => setShortAnswerCount(Number(event.target.value))}
                                type="number"
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