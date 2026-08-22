// src/service/AuthService.js
// [GIU-NGUYEN] Copy nguyên vẹn.
import { postData } from "../utils/callAPI";

export const loginService = async ({ phone, password }) => {
  return await postData({
    url: "/users/login",
    data: { phone, password },
  });
};
