"use server"
import { revalidateTag, updateTag } from 'next/cache'

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
        // Bo id khoi body: id da nam tren URL, gui kem id (nhat la id moi)
        // co the lam json-server doi/hong id cua ban ghi dang sua.
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

        // Mau phieu (answerSheetTemplates) dung chung id voi exam nhung KHAC
        // schema, nen phai gui payload rieng - khong dung lai body cua exam.
        // Neu khong cap nhat detector/questionCount thi khi doi mau de,
        // templateId doi nhung cau hinh cham bai van la cua mau cu.
        if (answerSheetData) {
            // Bo answerKeys de khong xoa mat ma de/dap an da nhap truoc do,
            // bo createdAt de giu nguyen thoi diem tao ban dau.
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

export const handleDeleteExamInClassAction = async (id: string) => {
    try {
        console.log(`http://localhost:8000/exams/${id}`)
        console.log("ID cần delete:", id);

        const res = await fetch(`http://localhost:8000/exams/${id}`, {
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

export const handleCreateAnswerCode = async (id: string, data: any) => {
    try {
        const res = await fetch(
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

