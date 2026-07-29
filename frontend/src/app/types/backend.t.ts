interface IStudent {
    id: string;
    name: string;
    sbd: string;
    status: "active" | "inactive";
}

interface IClassRoom {
    id: string;
    name: string;
    grade: string;
    schoolYear: string;
    createdByTeacherId: string;
    description: string;
    status: "active" | "inactive";
    createdAt: string;
    updatedAt: string;
    students: IStudent[];
}

interface ISubject {
    id: string;
    name: string;
    code: string;
    status: "active" | "inactive";
}

interface IExamFile {
    name: string;
    url: string;
    type: string;
    size: number;
}

interface IExam {
    id: string;
    name: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    templateId: string;

    createdAt: string;
    updatedAt: string;
    examDate: string;
    durationMinutes: number;

    note: string;

    status:
    | "draft"
    | "ready"
    | "completed";

    files: {
        examFile: IExamFile;
        answerFile: IExamFile;
    };

    gradingConfig?: Record<string, unknown>;
    statistics?: Record<string, unknown>;
}

interface IAnswerSheetTemplate {
    id: string;
    examId: string;
    name: string;
    description: string;

    detector: {
        name: string;
        version: string;
    };

    questionCount: {
        mcq: number;
        trueFalse: number;
        shortAnswer: number;
    };

    answerKeys: Record<string, unknown>;

    createdAt: string;
    updatedAt: string;
}