import axios from "axios";

async function importJSON(apiUrl, file, key = "data") {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
        throw new Error("File JSON phải là một mảng dữ liệu");
    }

    const res = await axios.post(`${apiUrl}/import`, { [key]: data });
    return res.data;
}

export default importJSON;