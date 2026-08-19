import ShowExamSession from "../components/examination/examSession.table";

const ExaminationPage = async () => {

    const res = await fetch(`http://localhost:8000/examPeriods`,
        {
            method: "GET",
            next: { tags: ['list-exam-periods'] }
        });

    const data = await res.json()

    return <ShowExamSession
        examPeriods={data}
    />;
};

export default ExaminationPage;
