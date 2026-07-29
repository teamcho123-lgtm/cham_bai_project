import ClassesTable from "../components/classes/classes.table";

interface IClass {
    classRoom: IClassRoom;
}

const ExamPage = async (props: any) => {

    const LIMIT = 10

    const searchParams = await props.searchParams

    const page = Number(searchParams?.page) || 1

    const res = await fetch(`http://localhost:8000/classes?_page=${page}&_limit=${LIMIT}`,
        {
            method: "GET",
            next: { tags: ['list-users'] }
        })

    const data = await res.json();


    return (
        <ClassesTable classRoom={
            data ? data : null}
            meta={
                {
                    current: page,
                    pageSize: LIMIT,
                    total: 50
                }
            }
        />
    )
}

export default ExamPage;