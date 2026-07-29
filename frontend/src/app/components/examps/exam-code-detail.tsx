"use client";

import { ArrowLeft, ScanLine, UploadCloud, X, } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, useEffect, useMemo, useState, } from "react";
import { toast } from "react-toastify";
import RenderUploadImage from "../image/upload-img";

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
    examCode: string;
    templateId: string;
}

const ExamCodeDetail = ({ exam: answerKey, examCode, templateId }: IProps) => {
    const router = useRouter();

    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] =
        useState<boolean>(false);

    const mcqAnswers = Object.entries(answerKey.mcq ?? {});

    const trueFalseAnswers = Object.entries(answerKey.trueFalse ?? {});

    const shortAnswers = Object.entries(answerKey.shortAnswer ?? {});

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

                                <div className="space-y-4">
                                    <div className="flex justify-between gap-4 border-b border-gray-100 pb-3">
                                        <span className="text-gray-500"> Mã đề </span>
                                        <span className="font-bold text-pink-700"> {examCode}</span>
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
                                <h4 className="font-bold text-lg text-gray-800 mb-5"> Đáp án đã lưu</h4>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Trắc nghiệm */}
                                    <div className="rounded-xl border border-pink-100 bg-pink-50/40 p-4">
                                        <h5 className="font-bold text-pink-700 mb-3">  Trắc nghiệm </h5>

                                        {mcqAnswers.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {mcqAnswers.map(([question, answer]) => (
                                                    <span key={question} className="px-2.5 py-1 rounded-lg bg-white border border-pink-100 text-sm">{question}:{" "}
                                                        <strong>
                                                            {answer}
                                                        </strong>
                                                    </span>
                                                )
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400">
                                                Không có câu trắc nghiệm
                                            </p>
                                        )}
                                    </div>

                                    {/* Đúng sai */}
                                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                                        <h5 className="font-bold text-blue-700 mb-3"> Đúng/Sai</h5>
                                        {trueFalseAnswers.length >
                                            0 ? (
                                            <div className="space-y-3">
                                                {trueFalseAnswers.map(
                                                    ([question, statements,]) => (
                                                        <div key={question} className="text-sm bg-white rounded-lg p-2 border border-blue-100" >
                                                            <p className="font-semibold mb-1">
                                                                Câu{" "} {question}
                                                            </p>

                                                            <div className="flex flex-wrap gap-2">
                                                                {Object.entries(
                                                                    statements
                                                                ).map(
                                                                    ([statement, value,]) =>
                                                                    (
                                                                        <span key={statement}
                                                                            className={value ? "text-green-600" : "text-red-500"}
                                                                        >{statement} :{" "} {value ? "Đ" : "S"}
                                                                        </span>
                                                                    )
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400">
                                                Không có câu đúng/sai
                                            </p>
                                        )}
                                    </div>

                                    {/* Trả lời ngắn */}
                                    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
                                        <h5 className="font-bold text-amber-700 mb-3">
                                            Trả lời ngắn
                                        </h5>

                                        {shortAnswers.length > 0 ? (
                                            <div className="space-y-2">
                                                {shortAnswers.map(
                                                    ([question, answerData,]) => (
                                                        <div key={question} className="bg-white rounded-lg border border-amber-100 px-3 py-2 text-sm" >
                                                            Câu{" "} {question}:{" "}
                                                            <strong>{answerData.answer} </strong>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-400">
                                                Không có câu trả lời ngắn
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Khu vực tải ảnh */}
                        {/* <RenderUploadImage /> */}
                        <RenderUploadImage
                            templateId={templateId}
                            answerKeys={{ [examCode]: answerKey }}
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