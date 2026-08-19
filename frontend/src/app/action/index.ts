"use server"
import { revalidateTag, updateTag } from 'next/cache'
import type { IPointSettings } from '@/app/types/grading'

export const handleCreateClassAction = async (data: any) => {
    try {
        const res = await fetch("http://localhost:8000/classes", {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json"
            }
        })

        console.log("check data : ", data)

        if (!res.ok) {
            return {
                success: false,
                message: "Thêm người dùng thất bại!",
            };
        }

        updateTag("list-users")
        // revalidateTag("list-users", "max")

        return {
            success: true,
            message: "Thêm người dùng thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleUpdateClassAction = async (id: string, data: any) => {
    try {
        console.log(`http://localhost:8000/classes/${id}`)
        console.log("ID cần update:", id);
        console.log("Dữ liệu cần update:", data);
        const res = await fetch(`http://localhost:8000/classes/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json"
            }
        })

        console.log("check data : ", data)

        if (!res.ok) {
            return {
                success: false,
                message: "Update người dùng thất bại!",
            };
        }

        updateTag("list-users")
        // revalidateTag("list-users", "max")

        return {
            success: true,
            message: "Update người dùng thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleDeleteClassAction = async (id: string) => {
    try {
        console.log(`http://localhost:8000/classes/${id}`)
        console.log("ID cần delete:", id);

        const res = await fetch(`http://localhost:8000/classes/${id}`, {
            method: "DELETE",

            cache: "no-store",
        })

        const responseText = await res.text();

        console.log("DELETE res.ok:", res.ok);
        console.log("DELETE status:", res.status);
        console.log("DELETE statusText:", res.statusText);
        console.log("DELETE response:", responseText);

        if (!res.ok) {
            console.log("Delete người dùng thất bại!")
            return {
                success: false,
                message: "Delete người dùng thất bại!",
            };
        }

        try {
            updateTag("list-classes");
        } catch (error) {
            console.error("Lỗi làm mới cache:", error);
        }
        // revalidateTag("list-users", "max")

        return {
            success: true,
            message: "Delete người dùng thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleCreateExamInClassAction = async (data: any, answerSheetData: any) => {
    try {
        const res = await fetch("http://localhost:8000/exams", {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json"
            }
        })

        const resAnswer = await fetch("http://localhost:8000/answerSheetTemplates", {
            method: "POST",
            body: JSON.stringify(answerSheetData),
            headers: {
                "Content-Type": "application/json"
            }
        })

        console.log("check data : ", data)

        if (!res.ok || !resAnswer.ok) {
            const errorText = await res.text();
            console.log("POST exam res.ok:", res.ok);
            console.log("POST exam status:", res.status);
            console.log(
                "POST exam statusText:",
                res.statusText
            );
            console.log(
                "POST exam response:",
                errorText
            );

            return {
                success: false,
                message: "Thêm danh sách lớp thất bại!",
            };
        }

        updateTag("list-users")
        // revalidateTag("list-users", "max")

        return {
            success: true,
            message: "Thêm danh sách lớp thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleUpdateExamInClassAction = async (
    id: string,
    data: any,
    answerSheetData?: any,
) => {
    try {
        const { id: _examId, ...examPatch } = data;

        const res = await fetch(`http://localhost:8000/exams/${id}`, {
            method: "PATCH",
            body: JSON.stringify(examPatch),
            headers: {
                "Content-Type": "application/json"
            }
        })

        console.log("check data : ", examPatch)

        if (!res.ok) {
            const errorText = await res.text();
            console.log("PATCH exam res.ok:", res.ok);
            console.log("PATCH exam status:", res.status);
            console.log("PATCH exam statusText:", res.statusText);
            console.log("PATCH exam response:", errorText);

            return {
                success: false,
                message: "Update đợt thi thất bại!",
            };
        }

        if (answerSheetData) {
            const {
                id: _templateId,
                answerKeys: _answerKeys,
                createdAt: _createdAt,
                ...templatePatch
            } = answerSheetData;

            const resTemplate = await fetch(`http://localhost:8000/answerSheetTemplates/${id}`, {
                method: "PATCH",
                body: JSON.stringify(templatePatch),
                headers: {
                    "Content-Type": "application/json"
                }
            })

            if (!resTemplate.ok) {
                const errorText = await resTemplate.text();
                console.log("PATCH template res.ok:", resTemplate.ok);
                console.log("PATCH template status:", resTemplate.status);
                console.log("PATCH template statusText:", resTemplate.statusText);
                console.log("PATCH template response:", errorText);

                return {
                    success: false,
                    message: "Update mẫu phiếu thất bại!",
                };
            }
        }

        updateTag("list-users")
        // revalidateTag("list-users", "max")

        return {
            success: true,
            message: "Update đợt thi thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleDeleteExamInClassAction = async (id: string,) => {
    try {
        console.log(`http://localhost:8000/exams/${id}`)
        console.log("ID cần delete:", id);

        const res = await fetch(`http://localhost:8000/exams/${id}`, {
            method: "DELETE",
            cache: "no-store",
        })

        const resAnswerSheetTemplates = await fetch(`http://localhost:8000/answerSheetTemplates/${id}`, {
            method: "DELETE",
            cache: "no-store",
        })

        const responseText = await res.text();

        console.log("DELETE res.ok:", res.ok);
        console.log("DELETE status:", res.status);
        console.log("DELETE statusText:", res.statusText);
        console.log("DELETE response:", responseText);

        if (!res.ok && !resAnswerSheetTemplates.ok) {
            console.log("Delete người dùng thất bại!")
            return {
                success: false,
                message: "Delete người dùng thất bại!",
            };
        }

        try {
            updateTag("list-classes");
        } catch (error) {
            console.error("Lỗi làm mới cache:", error);
        }

        return {
            success: true,
            message: "Delete người dùng thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleCreateAnswerCode = async (
    id: string,
    data: Partial<IAnswerSheetTemplate>,
    baseTemplate?: IAnswerSheetTemplate,
) => {
    try {
        let res = await fetch(
            `http://localhost:8000/answerSheetTemplates/${id}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            }
        );

        console.log("ID mẫu đáp án:", id);
        console.log("Dữ liệu thêm mã đề:", data);

        if (res.status === 404 && baseTemplate) {
            res = await fetch("http://localhost:8000/answerSheetTemplates", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...baseTemplate,
                    ...data,
                    id,
                    examId: baseTemplate.examId || id,
                }),
            });
        }

        if (!res.ok) {
            const errorText = await res.text();

            console.log("PATCH answer code res.ok:", res.ok);
            console.log("PATCH answer code status:", res.status);
            console.log(
                "PATCH answer code statusText:",
                res.statusText
            );
            console.log(
                "PATCH answer code response:",
                errorText
            );

            return {
                success: false,
                message: "Thêm mã đề thất bại!",
            };
        }

        const updatedData = await res.json();

        updateTag("list-answer-codes");

        return {
            success: true,
            message: "Thêm mã đề thành công!",
            data: updatedData,
        };
    } catch (error) {
        console.error("Lỗi thêm mã đề:", error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
};

export const handleDeleteAnswerCode = async (
    id: string,
    data: {
        answerKeys: Record<string, unknown>;
        updatedAt: string;
    }
) => {
    try {
        const response = await fetch(
            `http://localhost:8000/answerSheetTemplates/${id}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            }
        );

        if (!response.ok) {
            return {
                success: false,
                message: "Xóa mã đề thất bại!",
            };
        }

        updateTag("list-answer-codes");

        return {
            success: true,
            message: "Xóa mã đề thành công!",
            data: await response.json(),
        };
    } catch (error) {
        console.error("Lỗi xóa mã đề:", error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
};

export const handleUpdatePointSettings = async (
    examId: string,
    pointSettings: IPointSettings,
) => {
    try {
        const numericValues = [
            pointSettings.part1PointsPerQuestion,
            pointSettings.part2PointsPerQuestion,
            pointSettings.part3PointsPerQuestion,
            ...Object.values(pointSettings.part2PenaltyByWrongCount),
        ];

        if (
            !examId.trim() ||
            numericValues.some(
                (value) => !Number.isFinite(value) || value < 0 || value > 10
            )
        ) {
            return {
                success: false,
                message: "Cấu hình điểm không hợp lệ!",
            };
        }

        const currentExamResponse = await fetch(
            `http://localhost:8000/exams/${examId}`,
            { cache: "no-store" }
        );

        if (!currentExamResponse.ok) {
            return {
                success: false,
                message: "Không tìm thấy đợt thi!",
            };
        }

        const currentExam = await currentExamResponse.json();
        const currentGradingConfig =
            typeof currentExam.gradingConfig === "object" &&
                currentExam.gradingConfig !== null &&
                !Array.isArray(currentExam.gradingConfig)
                ? currentExam.gradingConfig
                : {};

        const response = await fetch(
            `http://localhost:8000/exams/${examId}`,
            {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    gradingConfig: {
                        ...currentGradingConfig,
                        pointSettings,
                    },
                    updatedAt: new Date().toISOString(),
                }),
            }
        );

        if (!response.ok) {
            return {
                success: false,
                message: "Lưu cấu hình điểm thất bại!",
            };
        }

        return {
            success: true,
            message: "Lưu cấu hình điểm thành công!",
            data: await response.json(),
        };
    } catch (error) {
        console.error("Lỗi lưu cấu hình điểm:", error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
};

export const handleCreateExamPeriodAction = async (data: IExamPeriod) => {
    try {
        const response = await fetch("http://localhost:8000/examPeriods", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            return {
                success: false,
                message: "Tạo kỳ thi thất bại!",
            };
        }

        updateTag("list-exam-periods");

        return {
            success: true,
            message: "Tạo kỳ thi thành công!",
            data: await response.json(),
        };
    } catch (error) {
        console.error("Lỗi tạo kỳ thi:", error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
};

export const handleCreateExamSession = async (data: any) => {
    try {
        const res = await fetch("http://localhost:8000/examPeriods", {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json"
            }
        })

        console.log("check data : ", data)

        if (!res.ok) {
            return {
                success: false,
                message: "Thêm Đợt thi thất bại!",
            };
        }

        updateTag("list-users")
        // revalidateTag("list-users", "max")

        return {
            success: true,
            message: "Thêm Đợt thi thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleUpdateExamSession = async (id: string, data: any) => {
    try {
        console.log(`http://localhost:8000/examPeriods/${id}`)
        console.log("ID cần update:", id);
        console.log("Dữ liệu cần update:", data);
        const res = await fetch(`http://localhost:8000/examPeriods/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
            headers: {
                "Content-Type": "application/json"
            }
        })

        console.log("check data : ", data)

        console.log("PATCH exam res.ok:", res.ok);
        console.log("PATCH exam status:", res.status);
        console.log("PATCH exam statusText:", res.statusText);
        if (!res.ok) {
            return {
                success: false,
                message: "Update đợt thi thất bại!",
            };
        }

        updateTag("list-users")
        // revalidateTag("list-users", "max")

        return {
            success: true,
            message: "Update đợt thi thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleDeleteExamSession = async (id: any) => {
    try {
        console.log(`http://localhost:8000/examPeriods/${id}`)
        console.log("ID cần delete:", id);

        const res = await fetch(`http://localhost:8000/examPeriods/${id}`, {
            method: "DELETE",
            cache: "no-store",
        })

        const responseText = await res.text();

        console.log("DELETE res.ok:", res.ok);
        console.log("DELETE status:", res.status);
        console.log("DELETE statusText:", res.statusText);
        console.log("DELETE response:", responseText);

        if (!res.ok) {
            console.log("Delete đợt thi thất bại!")
            return {
                success: false,
                message: "Delete đợt thi dùng thất bại!",
            };
        }

        try {
            updateTag("list-classes");
        } catch (error) {
            console.error("Lỗi làm mới cache:", error);
        }
        // revalidateTag("list-users", "max")

        return {
            success: true,
            message: "Delete đợt thi thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleCreateExamRoom = async (
    dataRoom: IExamRoom,
    dataExams: Record<string, unknown>,
    dataAnswerSheetTemplate: IAnswerSheetTemplate,
    stulist: IExamCandidates[]
) => {
    try {
        const resExams = await fetch("http://localhost:8000/exams", {
            method: "POST",
            body: JSON.stringify(dataExams),
            headers: {
                "Content-Type": "application/json"
            }
        })

        if (!resExams.ok) {
            return {
                success: false,
                message: "Không thể tạo bài thi!",
            };
        }

        const resAnswerSheetTemplate = await fetch(
            "http://localhost:8000/answerSheetTemplates",
            {
                method: "POST",
                body: JSON.stringify(dataAnswerSheetTemplate),
                headers: {
                    "Content-Type": "application/json"
                }
            }
        )

        if (!resAnswerSheetTemplate.ok) {
            await fetch(`http://localhost:8000/exams/${dataRoom.examId}`, {
                method: "DELETE",
                cache: "no-store",
            });

            return {
                success: false,
                message: "Không thể tạo mẫu phiếu đáp án!",
            };
        }

        const res = await fetch("http://localhost:8000/examRooms", {
            method: "POST",
            body: JSON.stringify(dataRoom),
            headers: {
                "Content-Type": "application/json"
            }
        })

        if (!res.ok) {
            await Promise.all([
                fetch(`http://localhost:8000/answerSheetTemplates/${dataRoom.examId}`, {
                    method: "DELETE",
                    cache: "no-store",
                }),
                fetch(`http://localhost:8000/exams/${dataRoom.examId}`, {
                    method: "DELETE",
                    cache: "no-store",
                }),
            ]);

            return {
                success: false,
                message: "Không thể tạo phòng thi!",
            };
        }

        const candidateResponses = await Promise.all(
            stulist.map((student: IExamCandidates) =>
                fetch("http://localhost:8000/examCandidates", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(student),
                })
            )
        );

        const candidatesCreated = candidateResponses.every(
            (response) => response.ok
        );


        console.log("check dataRoom : ", dataRoom)
        console.log("check dataExams : ", dataExams)
        console.log("check stulist : ", stulist)

        if (!candidatesCreated) {
            return {
                success: false,
                message: "Đã tạo phòng thi nhưng có học sinh chưa được lưu!",
            };
        }

        updateTag("list-users");
        updateTag("list-answer-codes");
        // revalidateTag("list-users", "max")

        return {
            success: true,
            message: "Thêm phòng thi thành công!",
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
}

export const handleUpdateExamRoom = async (
    id: string,
    dataRoom: IExamRoom,
    dataExams: Record<string, unknown>,
    dataAnswerSheetTemplate: IAnswerSheetTemplate,
    stulist: IExamCandidates[]
) => {
    try {
        const roomPatch: Partial<IExamRoom> = { ...dataRoom };
        delete roomPatch.id;

        const examPatch = { ...dataExams };
        delete examPatch.id;

        const currentAnswerSheetResponse = await fetch(
            `http://localhost:8000/answerSheetTemplates/${dataRoom.examId}`,
            { cache: "no-store" }
        );

        let currentAnswerSheet: IAnswerSheetTemplate | null = null;

        if (currentAnswerSheetResponse.ok) {
            const loadedAnswerSheet: IAnswerSheetTemplate =
                await currentAnswerSheetResponse.json();
            currentAnswerSheet = loadedAnswerSheet;

            const templateChanged =
                loadedAnswerSheet.templateId !== dataAnswerSheetTemplate.templateId;
            const hasAnswerCodes =
                Object.keys(loadedAnswerSheet.answerKeys ?? {}).length > 0;

            if (templateChanged && hasAnswerCodes) {
                return {
                    success: false,
                    message: "Không thể đổi mẫu phiếu khi đã có mã đề. Hãy xóa các mã đề trước!",
                };
            }
        } else if (currentAnswerSheetResponse.status !== 404) {
            return {
                success: false,
                message: "Không thể kiểm tra mẫu phiếu đáp án hiện tại!",
            };
        }

        const answerSheetPatch: Partial<IAnswerSheetTemplate> = {
            examId: dataRoom.examId,
            templateId: dataAnswerSheetTemplate.templateId,
            examPeriodId: dataAnswerSheetTemplate.examPeriodId,
            name: dataAnswerSheetTemplate.name,
            description: dataAnswerSheetTemplate.description,
            detector: dataAnswerSheetTemplate.detector,
            questionCount: dataAnswerSheetTemplate.questionCount,
            updatedAt: dataAnswerSheetTemplate.updatedAt,
        };

        const roomResponse = await fetch(`http://localhost:8000/examRooms/${id}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(roomPatch),
        });

        const examResponse = await fetch(`http://localhost:8000/exams/${dataRoom.examId}`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(examPatch),
        });

        const answerSheetResponse = await fetch(
            currentAnswerSheet
                ? `http://localhost:8000/answerSheetTemplates/${dataRoom.examId}`
                : "http://localhost:8000/answerSheetTemplates",
            {
                method: currentAnswerSheet ? "PATCH" : "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    currentAnswerSheet ? answerSheetPatch : dataAnswerSheetTemplate
                ),
            }
        );

        if (!roomResponse.ok || !examResponse.ok || !answerSheetResponse.ok) {
            return {
                success: false,
                message: "Cập nhật phòng thi, bài thi hoặc mẫu đáp án thất bại!",
            };
        }

        const currentCandidatesResponse = await fetch(
            `http://localhost:8000/examCandidates?examRoomId=${encodeURIComponent(id)}`,
            { cache: "no-store" }
        );

        if (!currentCandidatesResponse.ok) {
            return {
                success: false,
                message: "Không thể đọc danh sách thí sinh hiện tại!",
            };
        }

        const currentCandidates: IExamCandidates[] = await currentCandidatesResponse.json();
        const currentCandidateIds = new Set(
            currentCandidates.map((candidate) => candidate.id)
        );
        const submittedCandidateIds = new Set(
            stulist.map((candidate) => candidate.id)
        );

        const deleteResponses = await Promise.all(
            currentCandidates
                .filter((candidate) => !submittedCandidateIds.has(candidate.id))
                .map((candidate) =>
                    fetch(`http://localhost:8000/examCandidates/${candidate.id}`, {
                        method: "DELETE",
                        cache: "no-store",
                    })
                )
        );

        const saveResponses = await Promise.all(
            stulist.map((candidate) => {
                const isExistingCandidate = currentCandidateIds.has(candidate.id);
                const candidateUrl = isExistingCandidate
                    ? `http://localhost:8000/examCandidates/${candidate.id}`
                    : "http://localhost:8000/examCandidates";
                const candidatePayload: Partial<IExamCandidates> = {
                    ...candidate,
                    examRoomId: id,
                };

                if (isExistingCandidate) {
                    delete candidatePayload.id;
                }

                return fetch(candidateUrl, {
                    method: isExistingCandidate ? "PATCH" : "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(candidatePayload),
                });
            })
        );

        const candidatesUpdated = [...deleteResponses, ...saveResponses].every(
            (response) => response.ok
        );

        if (!candidatesUpdated) {
            return {
                success: false,
                message: "Phòng thi đã cập nhật nhưng danh sách thí sinh bị lỗi!",
            };
        }

        updateTag("list-users");
        updateTag("list-answer-codes");

        return {
            success: true,
            message: "Cập nhật phòng thi thành công!",
        };
    } catch (error) {
        console.error("Lỗi cập nhật phòng thi:", error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
};

export const handleDeleteExamRoom = async (id: string) => {
    try {
        const roomResponse = await fetch(`http://localhost:8000/examRooms/${id}`, {
            cache: "no-store",
        });

        if (!roomResponse.ok) {
            return {
                success: false,
                message: "Không tìm thấy phòng thi để xóa!",
            };
        }

        const room: IExamRoom = await roomResponse.json();
        const [candidateResponse, relatedRoomsResponse] = await Promise.all([
            fetch(
                `http://localhost:8000/examCandidates?examRoomId=${encodeURIComponent(id)}`,
                { cache: "no-store" }
            ),
            fetch(
                `http://localhost:8000/examRooms?examId=${encodeURIComponent(room.examId)}`,
                { cache: "no-store" }
            ),
        ]);

        if (!candidateResponse.ok || !relatedRoomsResponse.ok) {
            return {
                success: false,
                message: "Không thể kiểm tra dữ liệu liên quan đến phòng thi!",
            };
        }

        const candidates: IExamCandidates[] = await candidateResponse.json();
        const relatedRooms: IExamRoom[] = await relatedRoomsResponse.json();

        const candidateDeleteResponses = await Promise.all(
            candidates.map((candidate) =>
                fetch(`http://localhost:8000/examCandidates/${candidate.id}`, {
                    method: "DELETE",
                    cache: "no-store",
                })
            )
        );

        if (!candidateDeleteResponses.every((response) => response.ok)) {
            return {
                success: false,
                message: "Không thể xóa danh sách thí sinh của phòng!",
            };
        }

        const deleteRoomResponse = await fetch(`http://localhost:8000/examRooms/${id}`, {
            method: "DELETE",
            cache: "no-store",
        });

        if (!deleteRoomResponse.ok) {
            return {
                success: false,
                message: "Xóa phòng thi thất bại!",
            };
        }

        const isExamUsedByAnotherRoom = relatedRooms.some(
            (relatedRoom) => relatedRoom.id !== id
        );

        if (!isExamUsedByAnotherRoom) {
            const [deleteAnswerSheetResponse, deleteExamResponse] = await Promise.all([
                fetch(`http://localhost:8000/answerSheetTemplates/${room.examId}`, {
                    method: "DELETE",
                    cache: "no-store",
                }),
                fetch(`http://localhost:8000/exams/${room.examId}`, {
                    method: "DELETE",
                    cache: "no-store",
                }),
            ]);

            if (!deleteAnswerSheetResponse.ok && deleteAnswerSheetResponse.status !== 404) {
                return {
                    success: false,
                    message: "Đã xóa phòng nhưng không thể xóa mẫu đáp án liên quan!",
                };
            }

            if (!deleteExamResponse.ok && deleteExamResponse.status !== 404) {
                return {
                    success: false,
                    message: "Đã xóa phòng nhưng không thể xóa bài thi liên quan!",
                };
            }
        }

        updateTag("list-users");
        updateTag("list-answer-codes");

        return {
            success: true,
            message: "Xóa phòng thi thành công!",
        };
    } catch (error) {
        console.error("Lỗi xóa phòng thi:", error);

        return {
            success: false,
            message: "Không thể kết nối tới máy chủ!",
        };
    }
};

