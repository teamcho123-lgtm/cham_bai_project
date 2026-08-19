import ShowSchoolExamCode from "@/app/components/room/examCodeSchool";
import { notFound } from "next/navigation";

interface IPageProps {
    params: Promise<{
        id: string;
        examId: string;
    }>;
}

const SchoolExamCodePage = async ({ params }: IPageProps) => {
    const { id, examId } = await params;

    const res = await fetch(`http://localhost:8000/examPeriods?id=${id}`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        }
    )

    const resExam = await fetch(`http://localhost:8000/exams/${examId}`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        }
    )

    const resStudent = await fetch(`http://localhost:8000/examCandidates`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        }
    )

    const resAnswerSheet = await fetch(
        `http://localhost:8000/answerSheetTemplates/${examId}`,
        {
            next: { tags: ["list-answer-codes"] }
        }
    )

    const dataExamPeriod = await res.json();
    const dataExam = await resExam.json();
    const dataStudent = await resStudent.json();
    const dataAnswerSheet = await resAnswerSheet.json();

    return (
        <ShowSchoolExamCode
            dataExamPeriods={dataExamPeriod}
            dataExam={dataExam}
            dataStudent={dataStudent}
            dataAnswerSheet={dataAnswerSheet}
        />
    );
};

export default SchoolExamCodePage;
