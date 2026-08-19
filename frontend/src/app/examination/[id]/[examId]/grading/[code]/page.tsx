import ExamCodeDetail from "@/app/components/examps/exam-code-detail";
import type { IGradingConfig } from "@/app/types/grading";

interface IAnswer {
    mcq: Record<string, string>;
    trueFalse: Record<string, Record<string, boolean>>;
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

interface IAnswerSheetData {
    answerKeys?: Record<string, IAnswer>;
    templateId?: string;
}

interface IPageProps {
    params: Promise<{
        id: string;
        examId: string;
        code: string;
    }>;
}

const SchoolExamGradingPage = async ({ params }: IPageProps) => {
    const { id, examId, code } = await params;

    const [answerSheetResponse, examResponse, periodResponse, candidatesResponse] =
        await Promise.all([
            fetch(`http://localhost:8000/answerSheetTemplates/${examId}`, {
                cache: "no-store",
            }),
            fetch(`http://localhost:8000/exams/${examId}`, {
                cache: "no-store",
            }),
            fetch(`http://localhost:8000/examPeriods/${id}`, {
                cache: "no-store",
            }),
            fetch("http://localhost:8000/examCandidates", {
                cache: "no-store",
            }),
        ]);

    if (!answerSheetResponse.ok || !examResponse.ok || !periodResponse.ok || !candidatesResponse.ok) {
        return <div>Không thể tải dữ liệu chấm thi</div>;
    }

    const answerSheet: IAnswerSheetData = await answerSheetResponse.json();
    const exam: IExam = await examResponse.json();
    const period: IExamPeriod = await periodResponse.json();
    const candidates: IExamCandidates[] = await candidatesResponse.json();
    const allAnswerKeys = answerSheet.answerKeys ?? {};
    const examCodes = Object.keys(allAnswerKeys);
    const isGradingAllCodes = code === "all";
    const answerKey = isGradingAllCodes
        ? allAnswerKeys[examCodes[0]]
        : allAnswerKeys[code];
    const gradingAnswerKeys = isGradingAllCodes
        ? allAnswerKeys
        : answerKey
            ? { [code]: answerKey }
            : {};

    if (isGradingAllCodes && examCodes.length === 0) {
        return <div>Chưa có mã đề nào để chấm</div>;
    }

    if (!answerKey) {
        return <div>Không tìm thấy mã đề {code}</div>;
    }

    const roomCandidates = candidates.filter(
        (candidate) => candidate.examRoomId === exam.examRoomId
    );
    const targetExamRoom: IClassRoom = {
        id: exam.examRoomId,
        name: exam.name,
        grade: String(exam.gradeLevel),
        schoolYear: period.schoolYear,
        createdByTeacherId: period.createdByTeacherId,
        description: `Danh sách thí sinh của ${exam.name}`,
        status: "active",
        createdAt: exam.createdAt,
        updatedAt: exam.updatedAt,
        students: roomCandidates.map((candidate) => ({
            id: candidate.studentId,
            name: candidate.studentName,
            sbd: candidate.sbd,
            status: "active",
        })),
    };

    return (
        <ExamCodeDetail
            exam={answerKey}
            examId={examId}
            examCode={code}
            answerKeys={gradingAnswerKeys}
            templateId={answerSheet.templateId ?? exam.templateId}
            targetClass={targetExamRoom}
            initialGradingConfig={exam.gradingConfig as IGradingConfig | undefined}
        />
    );
};

export default SchoolExamGradingPage;
