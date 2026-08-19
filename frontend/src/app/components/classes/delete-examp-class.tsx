"use client";

import { handleDeleteClassAction } from "@/app/action";
import { toast } from "react-toastify";

const handleDeleteUser = async (targetClass: IClassRoom) => {
    const resDelete = await handleDeleteClassAction(targetClass.id);

    resDelete?.success == true ? toast.success("Delete user thành công :)") : toast.error("Delete user thất bại :(")


};

export default handleDeleteUser;