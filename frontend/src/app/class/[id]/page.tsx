import TableModelExamps from "@/app/components/classes/examModel.table";


interface IProps {
    params: Promise<{
        id: string;
    }>;

    classroom: IClassRoom[];
}

const ShowChooseExamType = async ({ params, classroom }: IProps) => {
    const { id } = await params;

    console.log("ID lớp:", id);

    const resClass = await fetch(`http://localhost:8000/classes/${id}`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        })

    const resClassExams = await fetch(`http://localhost:8000/exams?classId=${id}`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        })

    const resAllExam = await fetch(`http://localhost:8000/exams`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        })


    const dataAllExams = await resAllExam.json();
    const dataClassExamps = await resClassExams.json();
    const dataClass = await resClass.json();

    return (
        <>
            <TableModelExamps
                classroom={dataClass ? dataClass : []}
                exams={dataClassExamps ? dataClassExamps : []}
                allExam={dataAllExams}
            />
        </>
    )

};

export default ShowChooseExamType;