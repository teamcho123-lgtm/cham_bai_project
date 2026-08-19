"use client";

import { handleDeleteExamInClassAction } from "@/app/action";
import { Button, Modal, Space } from "antd";
import { toast } from "react-toastify";

interface IExamBasic {
    id: string;
    name: string;

    classId: string;
    subjectId: string;
    teacherId: string;
    templateId: string;

    createdAt: string;
    updatedAt: string;

    note: string;

    status: "draft";
}

interface IProps {
    show: boolean;
    handleClose: () => void;
    listDefaultExams: IExamBasic | null;
}

const handleDeleteExams = (prop: IProps) => {
    const { show, handleClose, listDefaultExams } = prop

    console.log(listDefaultExams?.id)

    const handleSubmitDelete = async () => {
        if (!listDefaultExams?.id) {
            toast.error("Không tìm thấy thông tin đợt thi để xóa.")
            handleClose()
            return
        }

        const resDelete = await handleDeleteExamInClassAction(listDefaultExams.id);
        resDelete?.success == true ? toast.success("Delete đợt thi thành công :)") : toast.error("Delete đợt thi thất bại :(")
        handleClose()
    }


    return (
        <>
            <Modal
                title="Xóa danh sách đợt thi"
                open={show}
                onOk={() => handleSubmitDelete()}
                styles={{ body: { padding: 0, height: "70px", overflowY: "auto", }, }}
                onCancel={() => handleClose()}
                okText="Đồng ý"
                cancelText="Hủy"
            >
                <h1 style={{ color: "red", fontSize: "15px" }}>Thầy/cô có chắc chắn muốn xóa bài thi {listDefaultExams?.name}</h1>
            </Modal>


        </>
    )
};

export default handleDeleteExams;