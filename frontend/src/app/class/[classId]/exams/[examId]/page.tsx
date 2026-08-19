import ShowExamsCode from "@/app/components/examps/examsCode";

interface IProps {
    params: Promise<{
        classId: string;
        examId: string;
    }>;
}

const ExamsPage = async ({ params }: IProps) => {
    const { classId, examId } = await params;

    const resAnswer = await fetch(`http://localhost:8000/answerSheetTemplates/${examId}`,
        {
            method: "GET",
            next: { tags: ["list-answer-codes"] }
        })

    const data = await resAnswer.json();


    return (
        <div className="flex h-screen bg-[#fff0f3] font-sans overflow-hidden text-stone-800">
            {/* Main Content */}
            <main className="flex-1 flex flex-col h-full overflow-hidden">

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header Mã Đề */}
                        <ShowExamsCode
                            allCodeExams={data}
                            detailBasePath={`/class/${classId}/exams/${examId}`}
                        />

                        <div className="h-10"></div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ExamsPage;

