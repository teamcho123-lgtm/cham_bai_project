import ExamCodeDetail from "@/app/components/examps/exam-code-detail";
import type { IGradingConfig } from "@/app/types/grading";

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

interface IAnswerSheetTemplate {
    answerKeys?: Record<string, IAnswer>;
    templateId?: string;
    classId?: string;
}

interface IExamData {
    gradingConfig?: IGradingConfig;
}

interface IPageProps {
    params: Promise<{
        classId: string;
        examId: string;
        code: string;
    }>;
}

const ExamCodePage = async ({ params }: IPageProps) => {
    const { classId, examId, code } = await params;

    console.log("ID đợt thi:", classId);       // exam-002
    console.log("Mã đề:", code);        // 101

    const res = await fetch(`http://localhost:8000/answerSheetTemplates/${examId}`,
        {
            cache: "no-store",
        }
    );

    if (!res.ok) {
        return <div>Không tìm thấy đợt thi {examId}</div>;
    }

    const answerSheet: IAnswerSheetTemplate = await res.json();
    const allAnswerKeys = answerSheet.answerKeys ?? {};
    const examCodes = Object.keys(allAnswerKeys);

    const isGradingAllCodes = code === "all";

    const answerKey = isGradingAllCodes
        ? allAnswerKeys[examCodes[0]]
        : allAnswerKeys[code];

    const gradingAnswerKeys = isGradingAllCodes
        ? allAnswerKeys
        : answerKey ? { [code]: answerKey } : {};

    const templateId = answerSheet.templateId;


    if (isGradingAllCodes && examCodes.length === 0) {
        return <div>Chưa có mã đề nào để chấm</div>;
    }

    if (!answerKey) {
        return (
            <div>
                Không tìm thấy mã đề {code}
            </div>
        );
    }


    const resClass = await fetch(`http://localhost:8000/classes/${classId}`,
        {
            cache: "no-store",
        }
    );

    if (!resClass.ok) {
        return <div>Không tìm thấy lớp thi {classId}</div>;
    }

    const targetClass: IClassRoom = await resClass.json();

    const resExam = await fetch(`http://localhost:8000/exams/${examId}`, {
        cache: "no-store",
    });

    const examData: IExamData = resExam.ok ? await resExam.json() : {};



    return (
        <ExamCodeDetail
            exam={answerKey}
            examId={examId}
            examCode={code}
            answerKeys={gradingAnswerKeys}
            templateId={templateId as string}
            targetClass={targetClass}
            initialGradingConfig={examData.gradingConfig}
        />
    );
};

export default ExamCodePage;
