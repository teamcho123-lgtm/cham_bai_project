import ClassesTable from "../components/classes/classes.table";

interface IPageProps {
    searchParams: Promise<{
        page?: string | string[];
    }>;
}

const ExamPage = async ({ searchParams }: IPageProps) => {
    const LIMIT = 10;
    const query = await searchParams;
    const pageValue = Array.isArray(query.page)
        ? query.page[0]
        : query.page;
    const page = Math.max(Number(pageValue) || 1, 1);

    const res = await fetch(
        `http://localhost:8000/classes?_page=${page}&_limit=${LIMIT}`,
        {
            method: "GET",
            next: { tags: ["list-users"] },
        }
    );

    const data = await res.json();

    return (
        <ClassesTable
            classRoom={data ?? null}
            meta={{
                current: page,
                pageSize: LIMIT,
                total: 50,
            }}
        />
    );
};

export default ExamPage;
