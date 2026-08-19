import TableModelExamps from "@/app/components/classes/examModel.table";

interface IProps {
    params: Promise<{
        classId: string;
    }>;
}

const ShowChooseExamType = async ({ params }: IProps) => {
    const { classId } = await params;

    const resClass = await fetch(
        `http://localhost:8000/classes/${classId}`,
        {
            method: "GET",
            next: { tags: ["list-users"] },
        }
    );

    const resClassExams = await fetch(
        `http://localhost:8000/exams?classId=${classId}`,
        {
            method: "GET",
            next: { tags: ["list-users"] },
        }
    );

    const resAllExam = await fetch(
        "http://localhost:8000/exams",
        {
            method: "GET",
            next: { tags: ["list-users"] },
        }
    );

    const dataAllExams = await resAllExam.json();
    const dataClassExamps = await resClassExams.json();
    const dataClass = await resClass.json();

    return (
        <TableModelExamps
            classroom={dataClass ?? []}
            exams={dataClassExamps ?? []}
            allExam={dataAllExams}
        />
    );
};

export default ShowChooseExamType;
