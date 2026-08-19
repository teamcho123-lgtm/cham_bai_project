"use client";

import { handleDeleteExamRoom } from "@/app/action";
import { Modal } from "antd";
import { useState } from "react";
import { toast } from "react-toastify";

interface IProps {
    show: boolean;
    handleClose: () => void;
    targetExamRoom: IExamRoom | null;
}

const ShowDeleteExamRoom = ({ show, handleClose, targetExamRoom }: IProps) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleSubmitDelete = async () => {
        if (!targetExamRoom) {
            toast.error("Không tìm thấy phòng thi để xóa.");
            handleClose();
            return;
        }

        setIsDeleting(true);

        try {
            const result = await handleDeleteExamRoom(targetExamRoom.id);

            if (result?.success === true) {
                toast.success(result.message);
                handleClose();
            } else {
                toast.error(result?.message ?? "Xóa phòng thi thất bại!");
            }
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Modal
            open={show}
            onOk={handleSubmitDelete}
            onCancel={handleClose}
            okText="Đồng ý"
            cancelText="Hủy"
            confirmLoading={isDeleting}
            closable={!isDeleting}
            destroyOnHidden
        >
            <p className="m-0 text-sm text-stone-600">
                Thầy/cô có chắc chắn muốn xóa phòng thi{" "}
                <strong className="text-red-600">{targetExamRoom?.name}</strong>?
            </p>
            <p className="mb-0 mt-2 text-xs text-stone-500">
                Danh sách thí sinh trong phòng cũng sẽ bị xóa.
            </p>
        </Modal>
    );
};

export default ShowDeleteExamRoom;
