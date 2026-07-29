import ExamCodeDetail from "@/app/components/examps/exam-code-detail";

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
}

interface IPageProps {
    params: Promise<{
        id: string;
        examId: string;
    }>;
}

const ExamCodePage = async ({ params }: IPageProps) => {
    const { id, examId } = await params;

    console.log("ID đợt thi:", id);       // exam-002
    console.log("Mã đề:", examId);        // 101

    const res = await fetch(`http://localhost:8000/answerSheetTemplates/${id}`,
        {
            cache: "no-store",
        }
    );

    if (!res.ok) {
        return <div>Không tìm thấy đợt thi {id}</div>;
    }

    const answerSheet: IAnswerSheetTemplate = await res.json();
    const answerKey = answerSheet.answerKeys?.[examId];
    const templateId = Object.entries(answerSheet)[5][1];
    console.log(templateId)

    if (!answerKey) {
        return (
            <div>
                Không tìm thấy mã đề {examId}
            </div>
        );
    }

    return (
        <ExamCodeDetail
            exam={answerKey}
            examCode={examId}
            templateId={templateId}
        />
    );
};

export default ExamCodePage;