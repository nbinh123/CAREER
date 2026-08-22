// src/components/ImageUploadField.js
// [UI] Component chọn ảnh dùng chung — bản web gốc dùng
// "../components/ImageUploadField" (không có mã nguồn để đối chiếu, chỉ
// biết interface qua cách MenuPage.js gốc dùng nó: props currentUrl +
// onSelect(file), page tự quản lý "xoá ảnh"/remount qua key riêng). Đây là
// component RN đầu tiên trong dự án cần chọn ảnh — FoodService.js (đã viết
// từ trước) có sẵn ghi chú dự trù đúng shape { uri, name, type } cho
// imageFile (khớp asset trả về từ expo-image-picker, dùng thẳng được với
// FormData.append trên RN, xem ghi chú buildPayload trong FoodService.js).
//
// Khác biệt platform:
//   - <input type="file" accept="image/*"> (DOM) → expo-image-picker
//     launchImageLibraryAsync, cần xin quyền media library trước (RN không
//     tự động có quyền như input file của trình duyệt).
//   - Không ép allowsEditing/aspect ratio cố định — bản gốc không crop ảnh
//     lúc chọn (chỉ hiển thị object-cover ở FoodCard), giữ đúng hành vi đó,
//     không tự ý thêm bước crop bản gốc không có.
//   - quality: 0.8 — nén nhẹ trước khi upload, hợp lý cho ảnh từ camera
//     điện thoại (thường rất nặng so với ảnh chọn từ máy tính ở bản web),
//     không đổi hành vi nghiệp vụ, chỉ là thực hành tốt khi lên RN.
import React, { useState } from "react";
import { View, Text, Pressable, Image, ActivityIndicator, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImagePlus, Camera } from "lucide-react-native";
import colors from "../theme/tokens";

export default function ImageUploadField({ currentUrl, onSelect }) {
    const [localUri, setLocalUri] = useState(null);
    const [picking, setPicking] = useState(false);

    const pick = async () => {
        setPicking(true);
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert(
                    "Cần quyền truy cập",
                    "Vui lòng cấp quyền truy cập thư viện ảnh để chọn ảnh món ăn."
                );
                return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"], // API mới của expo-image-picker (MediaTypeOptions đã bị loại bỏ ở bản đang dùng — xem StoragePage.js)
                quality: 0.8,
            });
            if (result.canceled) return;
            const asset = result.assets?.[0];
            if (!asset) return;

            const extFromUri = asset.uri.split(".").pop();
            const ext = (asset.mimeType?.split("/")[1] || extFromUri || "jpg").toLowerCase();
            const file = {
                uri: asset.uri,
                name: asset.fileName || `food_${Date.now()}.${ext}`,
                type: asset.mimeType || `image/${ext}`,
            };
            setLocalUri(asset.uri);
            onSelect(file);
        } catch (err) {
            Alert.alert("Lỗi", err?.message || "Không thể chọn ảnh, vui lòng thử lại");
        } finally {
            setPicking(false);
        }
    };

    const preview = localUri || currentUrl;

    return (
        <Pressable
            onPress={pick}
            disabled={picking}
            className="rounded-xl border-2 border-dashed border-gray-200 overflow-hidden bg-gray-50"
            style={{ height: 140 }}
        >
            {preview ? (
                <Image source={{ uri: preview }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
                <View style={{ flex: 1 }} className="items-center justify-center">
                    <ImagePlus size={22} color={colors.gray[300]} />
                    <Text className="text-xs text-gray-400 font-semibold mt-1.5">Chọn ảnh món ăn</Text>
                </View>
            )}

            {picking && (
                <View
                    style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    className="items-center justify-center bg-black/30"
                >
                    <ActivityIndicator color={colors.white} />
                </View>
            )}

            {!!preview && !picking && (
                <View
                    style={{ position: "absolute", bottom: 6, right: 6 }}
                    className="bg-black/50 rounded-lg px-2 py-1 flex-row items-center"
                >
                    <Camera size={11} color={colors.white} />
                    <Text className="text-white text-[10px] font-bold ml-1">Đổi ảnh</Text>
                </View>
            )}
        </Pressable>
    );
}