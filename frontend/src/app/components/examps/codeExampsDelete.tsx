"use client";

import { handleDeleteAnswerCode } from "@/app/action";
import { Modal } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

interface IProps {
    show: boolean;
    handleClose: () => void;
    targetCode: string;
    allCodeExams: Record<string, unknown>;
    answerSheetTemplatesId: string;
}

const HandleDeleteExamsCode = (prop: IProps) => {
    const { show, handleClose, targetCode, allCodeExams, answerSheetTemplatesId } = prop
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleSubmitDeleteExampCode = async () => {
        const updatedAnswerKeys = {
            ...(allCodeExams ?? {}),
        };

        delete updatedAnswerKeys[targetCode];

        setIsDeleting(true);

        try {
            const res = await handleDeleteAnswerCode(

                answerSheetTemplatesId,
                {
                    answerKeys: updatedAnswerKeys,
                    updatedAt: new Date().toISOString(),
                }
            );

            if (res?.success === true) {
                toast.success("Xóa mã đề thành công :)")
                handleClose()
                router.refresh()
            } else {
                toast.error(res?.message ?? "Xóa mã đề thất bại :(")
            }
        } finally {
            setIsDeleting(false);
        }
    }



    return (
        <>
            <Modal
                title="Xóa Mã đề"
                open={show}
                onOk={() => handleSubmitDeleteExampCode()}
                styles={{ body: { padding: 0, height: "70px", overflowY: "auto", }, }}
                onCancel={() => handleClose()}
                okText="Đồng ý"
                cancelText="Hủy"
                confirmLoading={isDeleting}
                okButtonProps={{ danger: true }}
            >
                <h1 style={{ color: "red", fontSize: "15px" }}>Thầy/cô có chắc chắn muốn xóa mã đề </h1>
            </Modal>
        </>
    )
};

export default HandleDeleteExamsCode;
