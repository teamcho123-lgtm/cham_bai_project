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
    subject: string;
    teacherId: string;
    templateId: string;
    examPeriodId: string;
    examRoomId: string;
    subjects: string;
    gradeLevel: number;

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
    templateId?: string;
    examPeriodId?: string;
    classId?: string;
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

interface IExamPeriod {
    id: string;
    name: string;
    schoolYear: string;
    semester: number;
    type: string;
    startDate: string;
    endDate: string;
    status: string;
    createdByTeacherId: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    gradeLevels: number[];
}

interface IExamRoom {
    id: string;
    examId: string,
    periodId: string,
    grade: number
    name: string,
    subjects: string,
    startAt: string,
    durationMinutes: number,
    status: string
}

interface IExamCandidates {
    id: string,
    examRoomId: string,
    studentId: string,
    studentName: string,
    className: string,
    sbd: string,
    status: string
}
interface IExamModel {
    id: string;
    name: string;
    image: string;
    mcq: number;
    tf: number;
    essay: number;
    detector: string;
}