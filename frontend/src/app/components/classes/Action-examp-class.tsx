"use client";

import { useEffect, useState } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { CheckCircleFilled, CheckOutlined, CloseOutlined, DeleteOutlined, DeleteTwoTone, EditOutlined, UserOutlined } from "@ant-design/icons";
import { Button, Card, Col, ConfigProvider, DatePicker, Empty, Flex, Form, Input, Modal, Popconfirm, Row, Select, Space, Upload, message, type UploadProps, } from "antd";
import { ArrowRightOutlined, PlusOutlined, UploadOutlined, } from "@ant-design/icons";
import { toast } from "react-toastify";
import { handleCreateClassAction, handleUpdateClassAction } from "@/app/action";
import * as XLSX from 'xlsx';

interface IClass {
    show: boolean
    handleCloseModal: (value: boolean) => void;
    defaultAllClass: IClassRoom[] | []
    defaultClass: IClassRoom | null
}

interface Student {
    id: string;
    name: string;
    sbd: string;
    status: string;
}

interface ImportedStudentRow {
    "Họ Tên"?: unknown;
    "Họ và tên"?: unknown;
    "Tên"?: unknown;
    ten?: unknown;
    SBD?: unknown;
    sbd?: unknown;
}

const ActionExamPage = (props: IClass) => {
    const { show, handleCloseModal, defaultAllClass, defaultClass } = props

    const [idClass, setIdClass] = useState<string>("")
    const [name, setName] = useState<string>("")
    const [nameClass, setNameClass] = useState<string>("")
    const [description, setDescription] = useState<string>("")
    const [createdByTeacherId, setCreatedByTeacherId] = useState<string>("")

    const [studentName, setStudentName] = useState<string>("")
    const [studentSbd, setStudentSbd] = useState<string>("")

    const [students, setStudents] = useState<Student[]>([]);

    const idStu = students.length
    let idclass: number = defaultAllClass?.length

    // console.log(defaultAllClass)

    const handleSubmitCreateStudent = () => {
        const currentTime = dayjs().format(
            "YYYY-MM-DDTHH:mm:ssZ"
        );

        if (!studentName) {
            toast.error("Không được bỏ trống tên học sinh")
            return
        }

        if (!studentSbd) {
            toast.error("Không được bỏ trống sbd học sinh")
            return
        }

        const newStudent = {
            id: String(idStu + 1),
            name: studentName,
            sbd: studentSbd,
            status: "active"
        }

        const newList = [...students, newStudent]; //Nho cac them vao obj

        setStudents(newList)

        setStudentName("")
        setStudentSbd("")
    }

    const showCreateStudent = () => {
        return idStu === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 py-6">
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Chưa có học sinh nào"
                />
            </div>) : (<div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 ">
                {students.map((stu, key) =>
                    <div key={stu.id} className="min-w-0 flex-1" >
                        <div style={{ justifyContent: "space-around" }} className="flex min-w-0 items-center gap-3 rounded-xl border border-stone-200">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#d75d73] shadow-sm">
                                <UserOutlined />
                            </div>
                            <div className="min-w-0">
                                <p className="m-0 text-xs text-stone-400">Học sinh {stu.id}</p>
                                <p className="m-0 truncate font-medium text-stone-700">{stu?.name} - {stu?.sbd}</p>
                            </div>
                            <Button style={{ border: "none" }} onClick={() => handleDeleteStudent(stu.id)}>
                                <DeleteTwoTone twoToneColor="#ff0000" />
                            </Button>
                        </div>

                    </div>
                )}
            </div>)
    }

    useEffect(() => {
        if (defaultClass) {
            return;
        }
        let nextNumber = defaultAllClass.length + 1;

        let nextId = `class-${String(nextNumber).padStart(3, "0")}`;

        while (
            defaultAllClass.some((classItem) => {
                return classItem.id == nextId;
            })
        ) {
            nextNumber = nextNumber + 1;

            nextId = `class-${String(nextNumber).padStart(3, "0")}`;
        }
        setIdClass(nextId);
    }, [defaultAllClass, defaultClass])

    useEffect(() => {
        if (defaultClass) {
            setIdClass(defaultClass.id);
            setName(defaultClass?.name)
            setNameClass(defaultClass?.grade)
            setDescription(defaultClass?.description)
            setCreatedByTeacherId(
                defaultClass.createdByTeacherId
            );
            setStudents(defaultClass.students || []);
        } else {
            setName("");
            setNameClass("");
            setDescription("");
            setCreatedByTeacherId("");
            setStudents([]);
        }
    }, [defaultClass])


    const handleDeleteStudent = (props: any) => {
        const updatedList = students.filter(student => student.id !== props);

        setStudents(updatedList)
    }

    const handleFileUpload: NonNullable<UploadProps["beforeUpload"]> = async (file) => {
        try {
            const data = await file.arrayBuffer();
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];

            if (!sheetName) {
                toast.error("File Excel không có sheet dữ liệu.");
                return false;
            }

            const worksheet = workbook.Sheets[sheetName];
            const parsedData = XLSX.utils.sheet_to_json<ImportedStudentRow>(worksheet, {
                defval: "",
                raw: false,
            });

            const importedStudents = parsedData
                .map((row) => ({
                    name: String(
                        row["Họ Tên"] ??
                        row["Họ và tên"] ??
                        row["Tên"] ??
                        row.ten ??
                        ""
                    ).trim(),
                    sbd: String(row.SBD ?? row.sbd ?? "").trim(),
                }))
                .filter((student) => student.name && student.sbd);

            if (importedStudents.length === 0) {
                toast.warning("Không tìm thấy cột Họ Tên và SBD hợp lệ trong file Excel.");
                return false;
            }

            setStudents((previousStudents) => {
                let nextId = previousStudents.reduce((largestId, student) => {
                    const numericId = Number.parseInt(student.id, 10);
                    return Number.isNaN(numericId)
                        ? largestId
                        : Math.max(largestId, numericId);
                }, 0) + 1;

                const newStudents: Student[] = importedStudents.map((student) => ({
                    id: String(nextId++),
                    name: student.name,
                    sbd: student.sbd,
                    status: "active",
                }));

                return [...previousStudents, ...newStudents];
            });

            toast.success(`Đã nhập ${importedStudents.length} học sinh từ Excel.`);
        } catch (error) {
            console.error("Không thể đọc file Excel:", error);
            toast.error("Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file.");
        }

        // Ngăn Ant Design tự động tải file lên server.
        return false;
    }



    const closeModal = () => {
        handleCloseModal(false);
    };

    const handleSubmitAction = async () => {
        const currentTime = dayjs().format(
            "YYYY-MM-DDTHH:mm:ssZ"
        );

        if (!name) {
            toast.error("Không được bỏ trống tên bài chấm")
            return
        }

        if (!nameClass) {
            toast.error("Không được bỏ trống tên lớp")
            return
        }

        if (!description) {
            toast.error("Không được bỏ trống tên Môn học")
            return
        }

        if (students.length === 0) {
            toast.error("Chưa thêm danh sách học sinh!!!")
            return
        }

        const data = {
            id: defaultClass?.id || idClass,
            name: name,
            grade: nameClass,
            createdByTeacherId: createdByTeacherId,
            description: description,
            status: "active",
            createdAt: defaultClass?.createdAt || currentTime,
            updatedAt: currentTime,
            students: students
        };

        if (!defaultClass) {
            const res = await handleCreateClassAction(data);
            res?.success == true ? toast.success("Thêm user thành công :)") : toast.error("Thêm user thất bại :(")
        } else {
            const res = await handleUpdateClassAction(data.id, data);
            res?.success == true ? toast.success("Update user thành công :)") : toast.error("Update user thất bại :(")
        }

        setName("");
        setNameClass("");
        setDescription("");
        setCreatedByTeacherId("");
        setStudents([]);
        closeModal()
    }

    return (
        <Modal
            open={show}
            onCancel={() => closeModal()}
            onOk={handleSubmitAction}
            footer={null}
            width="calc(100vw - 32px)"
            style={{ top: 16, maxWidth: "1400px", paddingBottom: 0, }}
            styles={{ body: { padding: 0, maxHeight: "calc(100vh - 32px)", overflowY: "auto", }, }}
            destroyOnHidden
        >
            <main className="min-h-full w-full bg-[#fff7f5] p-4 md:p-7">
                <div className="mx-auto w-full max-w-7xl">
                    {/* Tiêu đề */}
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <h1 className="m-0 text-2xl font-bold text-stone-900 md:text-3xl">
                            Tạo danh sách lớp học
                        </h1>
                    </div>

                    <Card className=" overflow-hidden rounded-2xl border-none! shadow-[0_4px_20px_rgba(143,60,74,0.14)]" styles={{ body: { padding: 0, }, }}>
                        <Form>
                            <div className="p-5 md:p-7">
                                {/* Phần thông tin */}
                                <Row gutter={[16, 4]}>
                                    <Col xs={24} lg={12}>
                                        <Form.Item label="Tên Bài Chấm">
                                            <Input placeholder="Nhập tên bài chấm" maxLength={150}
                                                value={name}
                                                onChange={(event) => {
                                                    setName(event.target.value);
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>

                                    <Col xs={24} sm={12} lg={6}>
                                        <Form.Item label="Lớp">
                                            <Input placeholder="Chọn lớp"
                                                value={nameClass}
                                                onChange={(event) => {
                                                    setNameClass(event.target.value);
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>

                                    <Col xs={24} sm={12} lg={6}>
                                        <Form.Item label="Môn Học">
                                            <Input placeholder="Môn Học"
                                                value={description}
                                                onChange={(event) => {
                                                    setDescription(event.target.value);
                                                }}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>

                                {/* Danh sách học sinh */}
                                <div className="mt-7">
                                    <div className="mb-4 flex items-center justify-between">
                                        <h2 className="m-0 text-base font-bold text-stone-800">
                                            Danh Sách Học Sinh
                                        </h2>
                                    </div>
                                    <div className=" rounded-xl border border-dashed border-[#dca4ad] bg-[#fff0f2] p-9">
                                        <Form.Item className="!mb-1" >
                                            <Upload
                                                accept=".xlsx,.xls"
                                                beforeUpload={handleFileUpload}
                                                showUploadList={false}
                                                style={{ display: "flex", justifyContent: "center" }}
                                            >
                                                <Button icon={<UploadOutlined />}
                                                    className="!min-w-60 !border-none !bg-[#8f3c4a] !text-white hover:!bg-[#74313d]">
                                                    Tải danh sách học sinh ( Excel File )
                                                </Button>
                                            </Upload>
                                        </Form.Item>
                                    </div><br></br>
                                    {/* Nhập tên học sinh */}
                                    <div className="bg-red-50 border border-red-00 border-l-4 border-l-red-500 p-4 rounded-xl text-red-700">
                                        <p className="font-bold text-sm">Ghi chú quan trọng:</p>
                                        <p className="text-xs mt-1">Nếu có bị lỗi tải file lên thì Thầy/cô có thể thêm học sinh thủ công.</p>
                                    </div><br></br>

                                    <div className="mb-5 flex flex-col gap-3 sm:flex-row">

                                        <Input placeholder="Nhập họ và tên học sinh" maxLength={50}
                                            value={studentName}
                                            onChange={(event) => {
                                                setStudentName(event.target.value);
                                            }}
                                        />
                                        <Input placeholder="Nhập Số báo danh" maxLength={50}
                                            value={studentSbd}
                                            onChange={(event) => {
                                                setStudentSbd(event.target.value);
                                            }}
                                        />

                                        <Button type="primary" icon={<PlusOutlined />} className="!h-[42px] !border-none !bg-[#8f3c4a] !px-6 hover:!bg-[#74313d] "
                                            onClick={handleSubmitCreateStudent}
                                        >
                                            Thêm học sinh
                                        </Button>
                                    </div>

                                    {/* Hiển thị danh sách */}
                                    {showCreateStudent()}
                                </div>
                            </div>
                            <div className="border-t border-stone-200 px-5 py-4 md:px-7">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <Button htmlType="button" onClick={() => handleCloseModal(false)} className=" !h-10 !min-w-32!rounded-full!border-[#e8909d]!font-semibold!text-[#d66c7c]hover:!border-[#d66c7c]">
                                        Hủy
                                    </Button>

                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        icon={<CheckCircleFilled />}
                                        onClick={handleSubmitAction}
                                        className="!h-10 !min-w-36 !rounded-full !border-none !bg-[#8f3c4a] !font-semibold hover:!bg-[#74313d] ">
                                        Tiếp Theo
                                    </Button>
                                </div>
                            </div>
                        </Form>
                    </Card>
                </div>
            </main>
        </Modal>
    );
};

export default ActionExamPage;




