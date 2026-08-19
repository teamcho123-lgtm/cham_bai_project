"use server"

import ShowListExamRoom from "@/app/components/room/examRoom.table";

interface IProps {
    params: Promise<{ id: string; }>;
}

const ShowExamsRoom = async ({ params }: IProps) => {
    const { id } = await params;

    // console.log(id)

    const res = await fetch(`http://localhost:8000/examPeriods?id=${id}`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        }
    )

    const resExamRoom = await fetch(`http://localhost:8000/examRooms`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        }
    )

    const resExamCandidates = await fetch(`http://localhost:8000/examCandidates`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        }
    )

    const resExam = await fetch(`http://localhost:8000/exams`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        }
    )


    const dataExamPeriods = await res.json();
    const dataExamRooms = await resExamRoom.json();
    const dataexamCandidates = await resExamCandidates.json()
    const dataExam = await resExam.json();

    // console.log(dataExamPeriods)

    return (
        <ShowListExamRoom
            targetId={id}
            dataExamPeriods={dataExamPeriods}
            dataExamRooms={dataExamRooms}
            examCandidates={dataexamCandidates}
            dataExam={dataExam}
        />
    )
}

export default ShowExamsRoom