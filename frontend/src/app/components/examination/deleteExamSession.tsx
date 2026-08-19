import { handleDeleteExamSession } from "@/app/action";
import { Modal } from "antd";
import { toast } from "react-toastify";

interface IProps {
    show: boolean;
    handleClose: () => void;
    targetDefaultExamSession: IExamPeriod | null;
}

const ShowModalDeleteExamSession = ({ show, handleClose, targetDefaultExamSession }: IProps) => {

    const handleSubmitDelete = async (id: any) => {
        if (!id) {
            toast.error("Không tìm thấy thông tin đợt thi để xóa.")
            handleClose()
            return
        }

        const resDelete = await handleDeleteExamSession(id);
        resDelete?.success == true ? toast.success("Delete đợt thi thành công :)") : toast.error("Delete đợt thi thất bại :(")
        handleClose()
    }

    return (
        <Modal
            title="Xóa danh sách đợt thi"
            open={show}
            onOk={() => handleSubmitDelete(targetDefaultExamSession?.id)}
            styles={{ body: { padding: 0, height: "70px", overflowY: "auto", }, }}
            onCancel={() => handleClose()}
            okText="Đồng ý"
            cancelText="Hủy"
        >
            <h1 style={{ color: "red", fontSize: "15px" }}>Thầy/cô có chắc chắn muốn xóa đợt thi <span style={{ fontWeight: "bold" }}>{targetDefaultExamSession?.name}</span> </h1>
        </Modal>
    )
}

export default ShowModalDeleteExamSession