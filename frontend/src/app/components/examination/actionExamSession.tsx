"use client";

import { handleCreateExamPeriodAction, handleCreateExamSession, handleUpdateExamSession } from "@/app/action";
import { Button, Col, DatePicker, Form, Input, Modal, Row, Select } from "antd";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

interface IProps {
    show: boolean;
    handleClose: () => void;
    allExamSession: IExamPeriod[];
    targetDefaultExamSession: IExamPeriod | null;
}

const ShowActionExamSessionModal = ({ show, handleClose, allExamSession, targetDefaultExamSession }: IProps) => {

    //KHỞI TẠO BIẾN
    const [id, setID] = useState("");
    const [ESName, setESName] = useState("");
    const [schoolYear, setSchoolYear] = useState("");
    const [semester, setSemester] = useState(0);
    const [type, setType] = useState("");
    const [gradeLevels, setGradeLevels] = useState<number[]>([]);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState("Bản nháp");
    const [description, setDescription] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const resetForm = () => {
        setESName("");
        setSchoolYear("");
        setSemester(0);
        setType("");
        setGradeLevels([]);
        setStartDate("");
        setEndDate("");
        setStatus("Bản nháp");
        setDescription("");
    };

    //USEMEMO
    const idSubmit = useMemo(() => {
        if (targetDefaultExamSession) {
            return targetDefaultExamSession.id;
        }

        let nextNumber = allExamSession.length + 1;
        let nextId = `period-${String(nextNumber).padStart(3, "0")}`;

        while (
            allExamSession.some((examSession) => examSession.id === nextId)
        ) {
            nextNumber += 1;
            nextId = `period-${String(nextNumber).padStart(3, "0")}`;
        }

        return nextId;
    }, [allExamSession, targetDefaultExamSession]);

    //USEEFFECT
    useEffect(() => {
        if (targetDefaultExamSession) {
            setESName(targetDefaultExamSession.name)
            setSchoolYear(targetDefaultExamSession.schoolYear)
            setSemester(targetDefaultExamSession.semester)
            setType(targetDefaultExamSession.type)
            setGradeLevels(targetDefaultExamSession.gradeLevels)
            setStartDate(targetDefaultExamSession.startDate)
            setEndDate(targetDefaultExamSession.endDate)
            setStatus(targetDefaultExamSession.status)
            setDescription(targetDefaultExamSession.description)
        } else {
            resetForm()
        }

    }, [targetDefaultExamSession])

    //HANDLE ACTION
    const closeModal = () => {
        resetForm();
        handleClose();
    };

    const handleActionExamSession = async () => {
        const name = ESName.trim();
        const normalizedSchoolYear = schoolYear.trim();
        const normalizedDescription = description.trim();

        if (!name) {
            toast.error("Vui lòng nhập tên kỳ thi.");
            return;
        }

        if (!semester) {
            toast.error("Vui lòng chọn học kỳ.");
            return;
        }

        if (!type) {
            toast.error("Vui lòng chọn loại kỳ thi.");
            return;
        }

        if (!status) {
            toast.error("Vui lòng chọn trạng thái.");
            return;
        }

        if (gradeLevels.length === 0) {
            toast.error("Vui lòng chọn ít nhất một khối.");
            return;
        }

        if (!startDate || !endDate) {
            toast.error("Vui lòng chọn ngày bắt đầu và ngày kết thúc.");
            return;
        }

        const isDuplicateName = allExamSession.some(
            (examSession) =>
                examSession.name.trim().toLocaleLowerCase("vi") ===
                name.toLocaleLowerCase("vi") &&
                examSession.schoolYear === normalizedSchoolYear
        );

        if (isDuplicateName && !targetDefaultExamSession) {
            toast.error("Tên kỳ thi đã tồn tại trong năm học này.");
            return;
        }

        const currentTime = dayjs().format("YYYY-MM-DDTHH:mm:ssZ");
        const newExamSession: IExamPeriod = {
            id: idSubmit,
            name,
            schoolYear: normalizedSchoolYear,
            semester,
            type,
            gradeLevels,
            startDate,
            endDate,
            status,
            createdByTeacherId: "teacher-001",
            description: normalizedDescription,
            createdAt: currentTime,
            updatedAt: currentTime,
        };

        setIsSubmitting(true);

        if (!targetDefaultExamSession) {
            const res = await handleCreateExamSession(newExamSession);
            res?.success == true ? toast.success("Thêm Đợt thi thành công :)") : toast.error("Thêm Đợt thi thất bại :(")
            setIsSubmitting(false);
        } else {
            const res = await handleUpdateExamSession(newExamSession.id, newExamSession);
            res?.success == true ? toast.success("Update Đợt thi thành công :)") : toast.error("Update Đợt thi thất bại :(")
            setIsSubmitting(false);
        }
        closeModal()
    };



    return (
        <Modal
            title="Tạo kỳ thi mới"
            open={show}
            onCancel={closeModal}
            footer={null}
            width={760}
            destroyOnHidden
        >
            <Form
                layout="vertical"
                autoComplete="off"
                onFinish={handleActionExamSession}
            >
                <Form.Item label="Tên kỳ thi">
                    <Input
                        value={ESName}
                        onChange={(event) => setESName(event.target.value)}
                        placeholder="Ví dụ: Kiểm tra giữa học kỳ I"
                    />
                </Form.Item>

                <Row gutter={16}>
                    <Col xs={24} sm={12}>
                        <Form.Item label="Năm học">
                            <Input
                                value={schoolYear}
                                onChange={(event) => setSchoolYear(event.target.value)}
                                placeholder="Ví dụ: 2026-2027"
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12}>
                        <Form.Item label="Học kỳ">
                            <Select
                                value={semester || undefined}
                                onChange={setSemester}
                                placeholder="Chọn học kỳ"
                                options={Array.from({ length: 3 }, (_, index) => ({
                                    value: index + 1,
                                    label: `Học kỳ ${index + 1}`,
                                }))}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col xs={24} sm={12}>
                        <Form.Item label="Loại kỳ thi">
                            <Select
                                value={type || undefined}
                                onChange={setType}
                                placeholder="Chọn loại kỳ thi"
                                options={[
                                    { value: "Giữa kỳ", label: "Giữa kỳ" },
                                    { value: "Cuối kỳ", label: "Cuối kỳ" },
                                    { value: "Bài thi thử", label: "Bài thi thử" },
                                ]}
                            />
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12}>
                        <Form.Item label="Trạng thái">
                            <Select
                                value={status}
                                onChange={setStatus}
                                placeholder="Chọn trạng thái"
                                options={[
                                    { value: "Chính thức", label: "Chính thức" },
                                    { value: "Bản nháp", label: "Bản nháp" },
                                    { value: "Đã kết thúc", label: "Đã kết thúc" },
                                ]}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Form.Item label="Khối tham gia">
                    <Select
                        value={gradeLevels}
                        onChange={setGradeLevels}
                        mode="multiple"
                        placeholder="Chọn một hoặc nhiều khối"
                        options={Array.from({ length: 12 }, (_, index) => ({
                            value: index + 1,
                            label: `Khối ${index + 1}`,
                        }))}
                    />
                </Form.Item>

                <Form.Item label="Thời gian tổ chức">
                    <DatePicker.RangePicker
                        value={
                            startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null
                        }
                        onChange={(dates) => {
                            setStartDate(
                                dates?.[0]?.format("YYYY-MM-DD") ?? ""
                            );
                            setEndDate(
                                dates?.[1]?.format("YYYY-MM-DD") ?? ""
                            );
                        }}
                        className="w-full"
                        format="DD/MM/YYYY"
                        placeholder={["Ngày bắt đầu", "Ngày kết thúc"]}
                    />
                </Form.Item>

                <Form.Item label="Mô tả">
                    <Input.TextArea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        rows={3}
                        placeholder="Nhập mô tả ngắn cho kỳ thi"
                    />
                </Form.Item>

                <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
                    <Button onClick={closeModal} disabled={isSubmitting}>
                        Hủy
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={isSubmitting}
                        className="!border-none !bg-[#8f3c4a] hover:!bg-[#74313d]"
                    >
                        Lưu kỳ thi
                    </Button>
                </div>
            </Form>
        </Modal>
    );
};

export default ShowActionExamSessionModal;
