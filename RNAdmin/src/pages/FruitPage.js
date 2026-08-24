import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Modal,
  Image,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import {
  Edit2,
  Plus,
  Search,
  Check,
  Save,
  RotateCcw,
  Trash2,
  X,
  StickyNote,
  Upload,
  FolderOpen,
} from "lucide-react-native";
import useFruitZustand from "../zustand/useFruitZustand";
import useFoodZustand from "../zustand/useFoodZustand";
import IngredientPicker from "../components/IngredientPicker";
import ImageUploadField from "../components/ImageUploadField";
import fmtVND from "../utils/fmtVND";
import extractCatName from "../utils/extractCatName";
import exportJSON from "../utils/exportJSON";
import importJSON, { pickJSONFile } from "../utils/importJSON";
import { API_URL } from "../config/api";
import colors from "../theme/tokens";

// ─── Constants [GIU-NGUYEN] ────────────────────────────────────────────────
const MIX_CATEGORY = "Trái cây mix";

const EMPTY_FRUIT = {
  fruitName: "",
  note: "",
  isAvailable: true,
  ingredients: [],
};

const EMPTY_COMBO = {
  foodName: "",
  categoryId: MIX_CATEGORY,
  costPrice: 0,
  originalPrice: 0,
  aiTrainingWeight: 0,
  isAvailable: true,
  note: "",
  ingredients: [],
};

// [GRID] Lưới danh sách Trái cây (3 cột) và Combo (2 cột)
const FRUIT_GRID_GAP = 10;
const FRUIT_GRID_ITEM_WIDTH = "31%"; // 3 cột + gap, chừa biên an toàn tránh vỡ dòng
const COMBO_GRID_GAP = 10;
const COMBO_GRID_ITEM_WIDTH = "48%"; // 2 cột + gap

// [PERF] Debounce ô tìm kiếm: input vẫn hiển thị tức thời, chỉ có bước LỌC
// (và re-render danh sách kèm theo) là bị trễ lại DEBOUNCE_MS sau khi người
// dùng ngừng gõ.
const DEBOUNCE_MS = 300;
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// [PERF] Style object cố định (module-level) cho ItemImage — truyền cùng 1
// tham chiếu object mỗi lần thay vì tạo mới trong JSX, để React.memo của
// ItemImage thực sự phát huy tác dụng.
const FRUIT_CARD_IMAGE_STYLE = { width: "100%", height: 96 };
const COMBO_CARD_IMAGE_STYLE = { width: "100%", height: 110 };
const INFO_IMAGE_STYLE = { width: "100%", height: 160, borderRadius: 12 };

// ─── Sub-components dùng chung ─────────────────────────────────────────────

function StatusBadge({ isAvailable }) {
  return (
    <View
      className={`rounded-full ${isAvailable ? "bg-green-100" : "bg-gray-100"}`}
      style={{ paddingHorizontal: 8, paddingVertical: 2 }}
    >
      <Text className={`text-[10px] font-bold ${isAvailable ? "text-green-700" : "text-gray-500"}`}>
        {isAvailable ? "Đang bán" : "Nghỉ"}
      </Text>
    </View>
  );
}

function AvailabilityToggle({ isAvailable, onToggle }) {
  return (
    <Pressable
      onPress={onToggle}
      className={`rounded-full ${isAvailable ? "bg-green-500" : "bg-gray-300"}`}
      style={{ width: 36, height: 20, justifyContent: "center", padding: 2 }}
    >
      <View
        className="bg-white rounded-full"
        style={{
          width: 14,
          height: 14,
          transform: [{ translateX: isAvailable ? 16 : 0 }],
        }}
      />
    </Pressable>
  );
}

function MarginBar({ margin }) {
  const m = Math.max(0, Math.min(margin, 100));
  const barColor = m > 50 ? colors.green[400] : m > 30 ? colors.amber[500] : colors.red[400];
  const textClass = m > 50 ? "text-green-600" : m > 30 ? "text-amber-600" : "text-red-500";
  return (
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <View className="bg-gray-100 rounded-full overflow-hidden" style={{ width: 48, height: 6 }}>
        <View style={{ width: `${m}%`, height: "100%", backgroundColor: barColor, borderRadius: 999 }} />
      </View>
      <Text className={`font-bold text-xs ${textClass}`}>{margin}%</Text>
    </View>
  );
}

// [PERF] Memo hoá: ItemImage được dùng lặp lại trong mỗi Card của danh sách
// (và trong 2 modal chi tiết). fadeDuration={0}: tắt hiệu ứng fade-in mặc
// định của Android (300ms) — khi nhiều card cùng xuất hiện lúc lọc/tìm kiếm,
// tắt fade giúp ảnh hiện ngay lập tức thay vì cảm giác "giật".
const ItemImage = React.memo(function ItemImage({ src, name, style }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <View
        style={style}
        className="items-center justify-center bg-green-50"
      >
        <Text className="text-4xl font-black text-green-200">{name?.[0] ?? "?"}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: src }}
      onError={() => setErrored(true)}
      style={style}
      resizeMode="cover"
      fadeDuration={0}
    />
  );
});

/** Nhãn nhỏ dạng label + input, thay cho <FormInput> chung của bản web
 * (không có trong gói bàn giao) — chỉ dùng nội bộ trang này. */
function LabeledInput({ label, value, onChangeText, keyboardType, multiline, rows = 2 }) {
  return (
    <View>
      {!!label && (
        <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.gray[300]}
        className="w-full border border-gray-200 rounded-xl text-sm text-gray-700"
        style={[
          { paddingHorizontal: 12, paddingVertical: 10 },
          multiline ? { minHeight: rows * 20, textAlignVertical: "top" } : null,
        ]}
      />
    </View>
  );
}

/** Modal card "hạ xuống": thay vì phụ thuộc animationType mặc định của
 * <Modal> (fade/slide sẵn có của RN, dễ bị các layer khác che mất hoặc
 * không rõ ràng), component này TỰ điều khiển animation bằng Animated —
 * card bắt đầu ở phía trên, ngoài màn hình (translateY = -windowHeight) rồi
 * "rơi" xuống vị trí nghỉ (translateY = 0) mỗi khi mount (tức mỗi khi
 * `modal`/`comboModal` chuyển sang add/edit/info/note ở component cha).
 *
 * [FIX-1] Chiều cao tối đa: đặt maxHeight (tính bằng px = windowHeight *
 * 0.88, KHÔNG dùng chuỗi "%") ngay trên Animated.View — vì Animated.View
 * đó là con trực tiếp của View bọc ngoài có flex:1 (chiều cao xác định).
 * Nếu đặt "%" ở tầng sâu hơn (như bản cũ), Yoga không resolve được vì tổ
 * tiên gần nhất không có height cố định → toàn bộ card co về 0, modal coi
 * như "biến mất" dù overlay nền vẫn hiển thị bình thường.
 *
 * [FIX-2] useNativeDriver: true cho cả 2 animation (translateY, opacity) —
 * chỉ animate transform/opacity nên chạy được trên native thread, không
 * bị giật hay đứng hình khi có ScrollView/bàn phím mở cùng lúc.
 *
 * [FIX-3] animationType="none" trên <Modal>: tắt hẳn animation dựng sẵn
 * của RN Modal để không bị "đá" (xung đột) với animation tự viết ở đây —
 * tránh tình trạng card bị animation mặc định che/kẹt ở giữa 2 hiệu ứng.
 *
 * [FIX-4] Tiêu đề (title) được tách RA KHỎI ScrollView, đặt cố định ngay
 * dưới đỉnh Animated.View — trước đây title nằm trong ScrollView nên khi
 * nội dung dài, cuộn xuống sẽ kéo luôn tiêu đề đi mất. Giờ chỉ phần nội
 * dung (children) + footer mới nằm trong ScrollView và cuộn được; header
 * luôn đứng yên ở trên cùng của card. */
function FormModalCard({ visible, onClose, title, children, footer }) {
  const { height: windowHeight } = useWindowDimensions();
  // [PHÒNG HỜ] Nếu useWindowDimensions() chưa kịp trả kích thước thật ở lần
  // render đầu (trả về 0 trên một số thiết bị/môi trường), dùng giá trị mặc
  // định hợp lý thay vì để cardMaxHeight = 0 khiến card lại co về 0.
  const safeWindowHeight = windowHeight > 0 ? windowHeight : 700;
  const cardMaxHeight = safeWindowHeight * 0.88;

  const translateY = useRef(new Animated.Value(-safeWindowHeight)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Component này chỉ được mount khi modal đang mở (cha render nó bằng
    // `{condition && <FormModalCard .../>}`), nên mỗi lần mount = mỗi lần
    // modal cần "hạ xuống" lại từ đầu.
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <Animated.View
            collapsable={false}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(6,78,59,0.35)",
              opacity: overlayOpacity,
            }}
          >
            <Pressable onPress={onClose} style={{ flex: 1 }} />
          </Animated.View>

          <View
            pointerEvents="box-none"
            style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}
          >
            {/* [FIX] Gộp thẳng "bg-white rounded-3xl overflow-hidden" vào
             * Animated.View có transform — KHÔNG còn View trung gian dùng
             * maxHeight:"100%". Animated.View này là con trực tiếp của View
             * pointerEvents="box-none" phía trên (flex:1 → chiều cao xác
             * định), và tự nó dùng maxHeight dạng SỐ (px), nên Yoga tính
             * được ngay — không còn tầng % nào phải chờ 1 cha "auto-size"
             * (dẫn tới co về 0) như 2 lần sửa trước. */}
            <Animated.View
              collapsable={false}
              className="bg-white rounded-3xl overflow-hidden"
              style={{
                width: "100%",
                maxWidth: 460,
                maxHeight: cardMaxHeight,
                transform: [{ translateY }],
              }}
            >
              {/* [FIX-4] Header cố định — nằm NGOÀI ScrollView nên không bị
               * cuộn theo nội dung. */}
              <View
                className="flex-row items-start border-b border-gray-100"
                style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, paddingRight: 52 }}
              >
                <Text className="flex-1 text-base font-black text-gray-800">{title}</Text>
              </View>

              <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                <View style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, gap: 16 }}>
                  {children}
                </View>
                {!!footer && (
                  <View
                    className="border-t border-gray-100"
                    style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}
                  >
                    {footer}
                  </View>
                )}
              </ScrollView>

              <Pressable
                onPress={onClose}
                className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center"
                style={{ position: "absolute", top: 16, right: 16 }}
              >
                <X size={16} color={colors.gray[400]} />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// [FIX-5] Thêm prop `fill` (mặc định false, KHÔNG đổi hành vi các chỗ dùng
// cũ): khi fill=true, nút sẽ nhận flex:1 để chia đều chiều ngang với các
// nút anh em khác trong 1 hàng — dùng cho cặp Hủy/Xác nhận nằm cạnh nhau.
function ModalButton({ onPress, label, icon: Icon, variant = "primary", disabled, fill }) {
  const palette = variant === "outline" ? "bg-gray-50 border border-gray-200" : "bg-green-600";
  const textClass = variant === "outline" ? "text-gray-600" : "text-white";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center rounded-xl ${palette}`}
      style={{
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 6,
        opacity: disabled ? 0.5 : 1,
        ...(fill ? { flex: 1 } : null),
      }}
    >
      {!!Icon && <Icon size={14} color={variant === "outline" ? colors.gray[500] : colors.white} />}
      <Text className={`text-sm font-bold ${textClass}`}>{label}</Text>
    </Pressable>
  );
}

/** [REDESIGN] Footer dùng chung cho 2 modal chi tiết (trái cây & combo):
 * Ghi chú + Xoá bên trái, Sửa bên phải. Không còn nút "Đóng" text riêng —
 * nút X nổi ở góc trên của FormModalCard đã đảm nhiệm việc đóng modal. */
function InfoModalFooter({ hasNote, onEditNote, onRemove, onEdit }) {
  return (
    <View className="flex-row items-center justify-between" style={{ flex: 1, gap: 8 }}>
      <View className="flex-row items-center" style={{ gap: 8 }}>
        <Pressable
          onPress={onEditNote}
          className={`rounded-xl ${hasNote ? "bg-amber-50" : "bg-gray-50"}`}
          style={{ padding: 10 }}
        >
          <StickyNote size={16} color={hasNote ? colors.amber[500] : colors.gray[400]} />
        </Pressable>
        <Pressable onPress={onRemove} className="bg-red-50 rounded-xl" style={{ padding: 10 }}>
          <Trash2 size={16} color={colors.red[500]} />
        </Pressable>
      </View>
      <ModalButton onPress={onEdit} label="Sửa" icon={Edit2} />
    </View>
  );
}

// [FIX-5] Footer dùng chung cho modal thêm/sửa (trái cây & combo): Hủy và
// Xác nhận nằm CẠNH NHAU trên cùng 1 hàng, chia đều chiều ngang.
function ConfirmModalFooter({ onCancel, onConfirm, confirmDisabled }) {
  return (
    <View className="flex-row" style={{ gap: 10 }}>
      <ModalButton onPress={onCancel} label="Hủy" variant="outline" fill />
      <ModalButton onPress={onConfirm} label="Xác nhận" icon={Check} disabled={confirmDisabled} fill />
    </View>
  );
}

// ─── Trái cây: Card (lưới 3 cột) + Info Modal ──────────────────────────────

// [REDESIGN] Bỏ hết các nút Sửa/Chi tiết/Ghi chú/Xoá khỏi card — cả card giờ
// là 1 Pressable duy nhất, bấm vào bất kỳ đâu trên card sẽ mở modal chi tiết
// (nơi giờ đây gồm đủ các hành động Sửa/Ghi chú/Xoá). Chỉ giữ lại nút bật/tắt
// bán (không thuộc nhóm 4 nút bị bỏ) làm điều khiển nhanh ngay trên card.
// [PERF] Vẫn giữ React.memo vì đây là item lặp lại nhiều lần trong danh sách.
const FruitCard = React.memo(function FruitCard({ fruit, onInfo, isPending, onToggleAvailable }) {
  return (
    <Pressable
      onPress={() => onInfo(fruit)}
      className={`bg-white rounded-2xl overflow-hidden border ${fruit.isAvailable ? "border-gray-100" : "border-gray-200 opacity-60"
        }`}
      style={isPending ? { borderWidth: 2, borderColor: colors.amber[500] } : undefined}
    >
      <View style={{ height: 96 }}>
        <ItemImage src={fruit.imageUrl} name={fruit.fruitName} style={FRUIT_CARD_IMAGE_STYLE} />

        <View className="absolute rounded-full bg-white/90" style={{ top: 6, left: 6, padding: 2 }}>
          <AvailabilityToggle isAvailable={fruit.isAvailable} onToggle={() => onToggleAvailable(fruit)} />
        </View>

        {!fruit.isAvailable && (
          <View
            className="absolute items-center justify-center"
            style={{ top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(17,24,39,0.4)" }}
          >
            <View className="bg-black/50 rounded-lg" style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text className="text-[9px] font-bold text-white">Tạm nghỉ</Text>
            </View>
          </View>
        )}
        {isPending && (
          <View
            className="absolute rounded-full bg-amber-400"
            style={{ top: 6, right: 6, paddingHorizontal: 5, paddingVertical: 1 }}
          >
            <Text className="text-[8px] font-bold text-white">Chưa lưu</Text>
          </View>
        )}
      </View>

      <View className="p-2">
        <Text className="font-bold text-gray-800 text-xs" numberOfLines={1}>
          {fruit.fruitName}
        </Text>
        <Text className="text-[10px] text-gray-400 font-medium" numberOfLines={1} style={{ marginTop: 2 }}>
          {fruit.ingredients?.length || 0} nguyên liệu
        </Text>
      </View>
    </Pressable>
  );
});

function FruitInfoModal({ fruit, visible, onClose, onEdit, onRemove, onEditNote }) {
  if (!fruit) return null;
  const rows = [
    ["Tên loại trái cây", fruit.fruitName],
    ["Trạng thái", fruit.isAvailable ? "Đang bán" : "Tạm nghỉ"],
  ];
  return (
    <FormModalCard
      visible={visible}
      onClose={onClose}
      title={`Chi tiết — ${fruit.fruitName}`}
      footer={
        <InfoModalFooter
          hasNote={!!fruit.note}
          onEditNote={() => onEditNote(fruit)}
          onRemove={() => onRemove(fruit._id)}
          onEdit={() => onEdit(fruit)}
        />
      }
    >
      <ItemImage src={fruit.imageUrl} name={fruit.fruitName} style={INFO_IMAGE_STYLE} />
      <View className="border-t border-gray-50">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row justify-between border-b border-gray-50" style={{ paddingVertical: 8 }}>
            <Text className="text-gray-500 font-medium text-sm">{label}</Text>
            <Text className="text-gray-800 font-semibold text-sm">{value}</Text>
          </View>
        ))}
      </View>
      {fruit.ingredients?.length > 0 && (
        <View>
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>
            Nguyên liệu
          </Text>
          <View style={{ gap: 6 }}>
            {fruit.ingredients.map((ing, i) => (
              <View
                key={i}
                className="flex-row justify-between bg-gray-50 rounded-lg"
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text className="text-xs text-gray-700 font-medium">{ing.ingredientName}</Text>
                <Text className="text-xs text-gray-500">
                  {ing.quantity} {ing.smallUnit || ing.unit}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
      {!!fruit.note && (
        <View>
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>
            Ghi chú
          </Text>
          <Text className="text-sm text-gray-600 bg-amber-50 rounded-lg" style={{ padding: 10 }}>
            {fruit.note}
          </Text>
        </View>
      )}
    </FormModalCard>
  );
}

// ─── Combo trái cây mix: Card (lưới 2 cột) + Info Modal ────────────────────

// [REDESIGN] Tương tự FruitCard: bỏ hết nút khỏi card, cả card là 1 Pressable
// mở modal chi tiết. [GRID-2COL] Card gọn lại cho vừa lưới 2 cột (ảnh thấp
// hơn, bỏ dòng "Giá vốn" khỏi card — vẫn xem đầy đủ trong modal chi tiết).
const ComboCard = React.memo(function ComboCard({ combo, onInfo, isPending }) {
  const margin =
    combo.originalPrice > 0 ? Math.round(((combo.originalPrice - combo.costPrice) / combo.originalPrice) * 100) : 0;

  return (
    <Pressable
      onPress={() => onInfo(combo)}
      className={`bg-white rounded-2xl overflow-hidden border ${combo.isAvailable ? "border-gray-100" : "border-gray-200 opacity-60"
        }`}
      style={isPending ? { borderWidth: 2, borderColor: colors.amber[500] } : undefined}
    >
      <View style={{ height: 110 }}>
        <ItemImage src={combo.imageUrl} name={combo.foodName} style={COMBO_CARD_IMAGE_STYLE} />
        {!combo.isAvailable && (
          <View
            className="absolute items-center justify-center"
            style={{ top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(229,231,235,0.6)" }}
          >
            <View className="bg-white rounded-lg" style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text className="text-xs font-bold text-gray-500">Tạm nghỉ</Text>
            </View>
          </View>
        )}
        {isPending && (
          <View
            className="absolute rounded-full bg-amber-400"
            style={{ top: 6, right: 6, paddingHorizontal: 5, paddingVertical: 1 }}
          >
            <Text className="text-[8px] font-bold text-white">Chưa lưu</Text>
          </View>
        )}
      </View>

      <View className="p-3">
        <View className="flex-row items-start justify-between" style={{ gap: 6, marginBottom: 6 }}>
          <Text className="font-bold text-gray-800 text-xs flex-1" numberOfLines={1}>
            {combo.foodName}
          </Text>
          <StatusBadge isAvailable={combo.isAvailable} />
        </View>

        <View style={{ gap: 4 }}>
          <View className="flex-row justify-between">
            <Text className="text-[10px] text-gray-500">Giá bán</Text>
            <Text className="text-[10px] font-bold text-green-600">{fmtVND(combo.originalPrice)}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-[10px] text-gray-500">Biên LN</Text>
            <MarginBar margin={margin} />
          </View>
        </View>
      </View>
    </Pressable>
  );
});

function ComboInfoModal({ combo, visible, onClose, onEdit, onRemove, onEditNote }) {
  if (!combo) return null;
  const pctOff = combo.percentageDiscount ?? 0;
  const fixed = combo.fixedDiscount ?? 0;
  const disc = Math.max(combo.originalPrice * (1 - pctOff / 100) - fixed, 0);
  const profit = disc - combo.costPrice;
  const margin = disc > 0 ? Math.round((profit / disc) * 100) : 0;

  const rows = [
    ["Tên combo", combo.foodName],
    ["Danh mục", "Trái cây mix"],
    ["Trạng thái", combo.isAvailable ? "Đang bán" : "Tạm nghỉ"],
    ["Giá bán gốc", fmtVND(combo.originalPrice)],
    ["Giá vốn", fmtVND(combo.costPrice)],
    ["Giảm %", `${pctOff}%`],
    ["Giảm cố định", fmtVND(fixed)],
    ["Giá sau ưu đãi", fmtVND(disc)],
    ["Lợi nhuận gộp", fmtVND(profit)],
    ["Biên lợi nhuận", `${margin}%`],
    ["Trọng số AI", String(combo.aiTrainingWeight ?? 0)],
  ];

  return (
    <FormModalCard
      visible={visible}
      onClose={onClose}
      title={`Chi tiết — ${combo.foodName}`}
      footer={
        <InfoModalFooter
          hasNote={!!combo.note}
          onEditNote={() => onEditNote(combo)}
          onRemove={() => onRemove(combo._id)}
          onEdit={() => onEdit(combo)}
        />
      }
    >
      <ItemImage src={combo.imageUrl} name={combo.foodName} style={INFO_IMAGE_STYLE} />
      <View className="border-t border-gray-50">
        {rows.map(([label, value]) => (
          <View key={label} className="flex-row justify-between border-b border-gray-50" style={{ paddingVertical: 8 }}>
            <Text className="text-gray-500 font-medium text-sm">{label}</Text>
            <Text className="text-gray-800 font-semibold text-sm">{value}</Text>
          </View>
        ))}
      </View>
      {combo.ingredients?.length > 0 && (
        <View>
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>
            Nguyên liệu
          </Text>
          <View style={{ gap: 6 }}>
            {combo.ingredients.map((ing, i) => (
              <View
                key={i}
                className="flex-row justify-between bg-gray-50 rounded-lg"
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Text className="text-xs text-gray-700 font-medium">{ing.ingredientName}</Text>
                <Text className="text-xs text-gray-500">
                  {ing.quantity} {ing.smallUnit} — {fmtVND(ing.price)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </FormModalCard>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FruitPage() {
  // ── Trái cây đơn lẻ ──
  const {
    fruits,
    loading: fruitLoading,
    error: fruitError,
    getFruits,
    forceRefreshFruits,
    stageAddFruit,
    stageUpdateFruit,
    stageRemoveFruit,
    saveAllChanges: saveAllFruitChanges,
    discardChanges: discardFruitChanges,
    pendingChanges: fruitPendingChanges,
    clearError: clearFruitError,
  } = useFruitZustand();

  // ── Combo trái cây mix (lưu vào bảng Food, danh mục "Trái cây mix") ──
  const {
    foods,
    loading: foodLoading,
    error: foodError,
    getFoods,
    stageAddFood,
    stageUpdateFood,
    stageRemoveFood,
    saveAllChanges: saveAllFoodChanges,
    discardChanges: discardFoodChanges,
    pendingChanges: foodPendingChanges,
    clearError: clearFoodError,
  } = useFoodZustand();

  useEffect(() => {
    getFruits();
    getFoods();
  }, [getFruits, getFoods]);

  const comboFoods = useMemo(() => foods.filter((fd) => extractCatName(fd.categoryId) === MIX_CATEGORY), [foods]);

  // ── State: Trái cây ──
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FRUIT);
  const [editId, setEditId] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageFieldKey, setImageFieldKey] = useState(0);
  const [infoFruit, setInfoFruit] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [noteFruit, setNoteFruit] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  // ── State: Combo trái cây mix ──
  const [comboSearch, setComboSearch] = useState("");
  const [comboModal, setComboModal] = useState(null);
  const [comboForm, setComboForm] = useState(EMPTY_COMBO);
  const [comboEditId, setComboEditId] = useState(null);
  const [comboImageFile, setComboImageFile] = useState(null);
  const [comboImageRemoved, setComboImageRemoved] = useState(false);
  const [comboImageFieldKey, setComboImageFieldKey] = useState(0);
  const [infoCombo, setInfoCombo] = useState(null);
  const [comboSaveStatus, setComboSaveStatus] = useState(null);
  const [noteCombo, setNoteCombo] = useState(null);
  const [comboNoteDraft, setComboNoteDraft] = useState("");

  // [PERF] Ref giữ id của các setTimeout reset saveStatus/comboSaveStatus.
  const saveStatusTimeoutRef = useRef(null);
  const comboSaveStatusTimeoutRef = useRef(null);
  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
      if (comboSaveStatusTimeoutRef.current) clearTimeout(comboSaveStatusTimeoutRef.current);
    };
  }, []);

  // ── Trái cây: handlers [GIU-NGUYEN logic] ──
  const openNoteEdit = useCallback((fr) => {
    setNoteFruit(fr);
    setNoteDraft(fr.note || "");
    setModal("note");
  }, []);

  const handleSaveNote = () => {
    if (!noteFruit) return;
    stageUpdateFruit({ ...noteFruit, note: noteDraft }, null);
    setModal(null);
    setNoteFruit(null);
    setNoteDraft("");
  };

  const pendingCount = fruitPendingChanges.size;

  const computedFruitCost = useMemo(
    () => form.ingredients.reduce((s, r) => s + (r.cost || 0), 0),
    [form.ingredients]
  );

  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS);
  const filtered = useMemo(
    () => fruits.filter((fr) => (fr?.fruitName || "").toLowerCase().includes(debouncedSearch.toLowerCase())),
    [fruits, debouncedSearch]
  );

  const availableFruitCount = useMemo(() => fruits.filter((f) => f.isAvailable).length, [fruits]);

  const ff = useCallback((k, v) => setForm((p) => ({ ...p, [k]: v })), []);

  const handleFruitIngredientsChange = useCallback(
    (newIngredients) => setForm((p) => ({ ...p, ingredients: newIngredients })),
    []
  );

  const handleRemoveImage = () => {
    setImageFile(null);
    setImageRemoved(true);
    setImageFieldKey((k) => k + 1);
  };

  const openAdd = useCallback(() => {
    setForm({ ...EMPTY_FRUIT });
    setImageFile(null);
    setImageRemoved(false);
    setModal("add");
  }, []);

  const exportData = () => {
    exportJSON(`${API_URL}/api/fruits`, "fruits");
  };

  const handleImportFruits = async () => {
    setImportError(null);
    setIsImporting(true);
    try {
      const data = await pickJSONFile();
      if (!data) return; // người dùng huỷ chọn file
      await importJSON(`${API_URL}/api/fruits`, data, "fruits");
      await forceRefreshFruits();
    } catch (err) {
      setImportError(err.message || "Import thất bại");
    } finally {
      setIsImporting(false);
    }
  };

  const openEdit = useCallback((fr) => {
    setForm({
      ...fr,
      ingredients: (fr.ingredients || []).map((i) => ({
        ...i,
        pricePerLargeUnit: i.pricePerLargeUnit || (i.quantity > 0 ? i.cost / i.quantity : 0),
      })),
    });
    setImageFile(null);
    setImageRemoved(false);
    setEditId(fr._id);
    setModal("edit");
  }, []);

  const openInfo = useCallback((fr) => {
    setInfoFruit(fr);
    setModal("info");
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
    setEditId(null);
    setImageFile(null);
    setImageRemoved(false);
    setNoteFruit(null);
    setNoteDraft("");
  }, []);

  const handleSave = () => {
    if (!form.fruitName.trim()) return;
    const payload = { ...form, costPrice: computedFruitCost };
    if (modal === "add") stageAddFruit(payload, imageFile);
    else stageUpdateFruit({ ...payload, _id: editId }, imageFile);
    closeModal();
  };

  const handleRemove = useCallback((id) => stageRemoveFruit(id), [stageRemoveFruit]);
  const handleRefresh = useCallback(async () => {
    try {
      // Ưu tiên dùng forceRefresh nếu có để bỏ qua cache, hoặc get mặc định
      if (forceRefreshFruits) {
        await forceRefreshFruits();
      } else {
        await getFruits();
      }
      await getFoods();
    } catch (error) {
      console.error("Lỗi khi làm mới dữ liệu:", error);
    }
  }, [forceRefreshFruits, getFruits, getFoods]);
  // [REDESIGN] Dùng khi xoá NGAY TỪ modal chi tiết — xoá xong phải đóng luôn
  // modal, vì infoFruit lúc này đang trỏ tới 1 item vừa bị xoá khỏi danh sách.
  const handleRemoveFromInfo = useCallback(
    (id) => {
      handleRemove(id);
      closeModal();
    },
    [handleRemove, closeModal]
  );

  const handleToggleAvailable = useCallback(
    (fruit) => stageUpdateFruit({ ...fruit, isAvailable: !fruit.isAvailable }, null),
    [stageUpdateFruit]
  );

  const handleSaveAll = async () => {
    if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
    setSaveStatus("saving");
    try {
      await saveAllFruitChanges();
      setSaveStatus("saved");
      saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      setSaveStatus("error");
      saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // ── Combo: handlers [GIU-NGUYEN logic] ──
  const openComboNoteEdit = useCallback((cb) => {
    setNoteCombo(cb);
    setComboNoteDraft(cb.note || "");
    setComboModal("note");
  }, []);

  const handleComboSaveNote = () => {
    if (!noteCombo) return;
    stageUpdateFood({ ...noteCombo, note: comboNoteDraft }, null);
    setComboModal(null);
    setNoteCombo(null);
    setComboNoteDraft("");
  };

  const comboPendingCount = foodPendingChanges.size;

  const computedComboCost = useMemo(
    () => comboForm.ingredients.reduce((s, r) => s + (r.cost || 0), 0),
    [comboForm.ingredients]
  );
  const comboHasIngredients = comboForm.ingredients.length > 0;

  const debouncedComboSearch = useDebouncedValue(comboSearch, DEBOUNCE_MS);
  const filteredCombos = useMemo(
    () => comboFoods.filter((cb) => (cb?.foodName || "").toLowerCase().includes(debouncedComboSearch.toLowerCase())),
    [comboFoods, debouncedComboSearch]
  );

  const availableComboCount = useMemo(() => comboFoods.filter((c) => c.isAvailable).length, [comboFoods]);

  const cff = useCallback((k, v) => setComboForm((p) => ({ ...p, [k]: v })), []);

  const handleComboIngredientsChange = useCallback(
    (newIngredients) => setComboForm((p) => ({ ...p, ingredients: newIngredients })),
    []
  );

  const handleComboRemoveImage = () => {
    setComboImageFile(null);
    setComboImageRemoved(true);
    setComboImageFieldKey((k) => k + 1);
  };

  const openComboAdd = useCallback(() => {
    setComboForm({ ...EMPTY_COMBO });
    setComboImageFile(null);
    setComboImageRemoved(false);
    setComboModal("add");
  }, []);

  const openComboEdit = useCallback((cb) => {
    setComboForm({
      ...cb,
      categoryId: MIX_CATEGORY,
      ingredients: (cb.ingredients || []).map((i) => ({
        ...i,
        pricePerLargeUnit: i.pricePerLargeUnit || (i.quantity > 0 ? i.cost / i.quantity : 0),
      })),
    });
    setComboImageFile(null);
    setComboImageRemoved(false);
    setComboEditId(cb._id);
    setComboModal("edit");
  }, []);

  const openComboInfo = useCallback((cb) => {
    setInfoCombo(cb);
    setComboModal("info");
  }, []);

  const closeComboModal = useCallback(() => {
    setComboModal(null);
    setComboEditId(null);
    setComboImageFile(null);
    setComboImageRemoved(false);
    setNoteCombo(null);
    setComboNoteDraft("");
  }, []);

  const handleComboSave = () => {
    if (!comboForm.foodName.trim()) return;
    const payload = {
      ...comboForm,
      categoryId: MIX_CATEGORY,
      costPrice: comboHasIngredients ? computedComboCost : comboForm.costPrice,
    };
    if (comboModal === "add") stageAddFood(payload, comboImageFile);
    else stageUpdateFood({ ...payload, _id: comboEditId }, comboImageFile);
    closeComboModal();
  };

  const handleComboRemove = useCallback((id) => stageRemoveFood(id), [stageRemoveFood]);

  // [REDESIGN] Tương tự handleRemoveFromInfo bên trái cây.
  const handleComboRemoveFromInfo = useCallback(
    (id) => {
      handleComboRemove(id);
      closeComboModal();
    },
    [handleComboRemove, closeComboModal]
  );

  const handleComboSaveAll = async () => {
    if (comboSaveStatusTimeoutRef.current) clearTimeout(comboSaveStatusTimeoutRef.current);
    setComboSaveStatus("saving");
    try {
      await saveAllFoodChanges();
      setComboSaveStatus("saved");
      comboSaveStatusTimeoutRef.current = setTimeout(() => setComboSaveStatus(null), 2500);
    } catch {
      setComboSaveStatus("error");
      comboSaveStatusTimeoutRef.current = setTimeout(() => setComboSaveStatus(null), 3000);
    }
  };

  const comboMarginPreview = (() => {
    const cost = comboHasIngredients ? computedComboCost : comboForm.costPrice;
    return comboForm.originalPrice > 0 ? Math.round(((comboForm.originalPrice - cost) / comboForm.originalPrice) * 100) : 0;
  })();

  return (
    <View style={{ flex: 1 }} className="bg-gray-50">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 28 }} keyboardShouldPersistTaps="handled">
        {/* ════════════════════════ TRÁI CÂY ════════════════════════ */}
        <View style={{ gap: 14 }}>
          <View>
            <Text className="text-2xl font-black text-green-900">Trái cây</Text>
            <Text className="text-gray-500 text-sm" style={{ marginTop: 2 }}>
              {fruits.length} loại • {availableFruitCount} đang bán • nguyên liệu cho combo mix bên dưới
            </Text>
          </View>

          <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
            <Pressable
              onPress={openAdd}
              disabled={fruitLoading}
              className="flex-row items-center bg-green-600 rounded-xl"
              style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}
            >
              <Plus size={15} color={colors.white} />
              <Text className="text-white font-bold text-sm">Thêm loại trái cây</Text>
            </Pressable>
            <Pressable
              onPress={exportData}
              disabled={fruitLoading}
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl"
              style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}
            >
              <FolderOpen size={15} color={colors.gray[600]} />
              <Text className="text-gray-600 font-bold text-sm">Xuất JSON</Text>
            </Pressable>
            <Pressable
              onPress={handleImportFruits}
              disabled={fruitLoading || isImporting}
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl"
              style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6, opacity: isImporting ? 0.7 : 1 }}
            >
              {isImporting ? (
                <ActivityIndicator size="small" color={colors.gray[600]} />
              ) : (
                <Upload size={15} color={colors.gray[600]} />
              )}
              <Text className="text-gray-600 font-bold text-sm">{isImporting ? "Đang tải lên..." : "Tải lên JSON"}</Text>
            </Pressable>
            <Pressable
              onPress={handleRefresh}
              className="flex-row items-center bg-gray-50 rounded-xl border border-gray-200"
              style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 6, opacity: (fruitLoading || foodLoading) ? 0.5 : 1 }}
              disabled={fruitLoading || foodLoading}
            >
              <RotateCcw size={16} color={colors.gray[600]} />
              <Text className="text-sm font-bold text-gray-600">Làm mới</Text>
            </Pressable>
          </View>

          {pendingCount > 0 && (
            <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
              <Pressable
                onPress={discardFruitChanges}
                disabled={fruitLoading}
                className="flex-row items-center border border-gray-200 rounded-xl"
                style={{ paddingHorizontal: 12, paddingVertical: 9, gap: 6 }}
              >
                <RotateCcw size={14} color={colors.gray[500]} />
                <Text className="text-gray-500 font-bold text-sm">Huỷ thay đổi</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveAll}
                disabled={fruitLoading || saveStatus === "saving"}
                className={`flex-row items-center rounded-xl ${saveStatus === "error" ? "bg-red-500" : "bg-amber-500"
                  }`}
                style={{ paddingHorizontal: 16, paddingVertical: 9, gap: 6 }}
              >
                {saveStatus === "saving" ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Save size={14} color={colors.white} />
                )}
                <Text className="text-white font-bold text-sm">
                  {saveStatus === "saving" ? "Đang lưu…" : saveStatus === "error" ? "Lỗi, thử lại" : `Lưu ${pendingCount} thay đổi`}
                </Text>
              </Pressable>
            </View>
          )}
          {saveStatus === "saved" && pendingCount === 0 && (
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Check size={14} color={colors.green[600]} />
              <Text className="text-green-600 font-bold text-sm">Đã lưu thành công</Text>
            </View>
          )}

          {!!fruitError && (
            <View className="flex-row items-center justify-between bg-red-50 border border-red-200 rounded-xl" style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text className="text-red-700 text-sm flex-1" style={{ paddingRight: 8 }}>{fruitError}</Text>
              <Pressable onPress={clearFruitError}>
                <X size={14} color={colors.red[600]} />
              </Pressable>
            </View>
          )}
          {!!importError && (
            <View className="flex-row items-center justify-between bg-red-50 border border-red-200 rounded-xl" style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text className="text-red-700 text-sm flex-1" style={{ paddingRight: 8 }}>{importError}</Text>
              <Pressable onPress={() => setImportError(null)}>
                <X size={14} color={colors.red[600]} />
              </Pressable>
            </View>
          )}

          <View style={{ position: "relative", justifyContent: "center" }}>
            <View style={{ position: "absolute", left: 13, zIndex: 1 }}>
              <Search size={14} color={colors.gray[400]} />
            </View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Tìm loại trái cây..."
              placeholderTextColor={colors.gray[300]}
              className="bg-white border border-gray-200 rounded-xl text-sm text-gray-700"
              style={{ paddingLeft: 36, paddingRight: 14, paddingVertical: 11 }}
            />
          </View>

          {/* [GRID-3COL] Danh sách trái cây hiển thị dạng lưới 3 cột/hàng */}
          {fruitLoading && fruits.length === 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: FRUIT_GRID_GAP }}>
              {[...Array(6)].map((_, i) => (
                <View
                  key={i}
                  style={{ width: FRUIT_GRID_ITEM_WIDTH }}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                >
                  <View style={{ height: 96 }} className="bg-gray-100" />
                  <View className="p-2" style={{ gap: 6 }}>
                    <View className="bg-gray-100 rounded" style={{ height: 12, width: "80%" }} />
                    <View className="bg-gray-100 rounded" style={{ height: 10, width: "50%" }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: FRUIT_GRID_GAP }}>
              {filtered.map((fruit) => (
                <View key={fruit._id} style={{ width: FRUIT_GRID_ITEM_WIDTH }}>
                  <FruitCard
                    fruit={fruit}
                    onInfo={openInfo}
                    onToggleAvailable={handleToggleAvailable}
                    isPending={
                      fruitPendingChanges.has(`add:${fruit._id}`) || fruitPendingChanges.has(`update:${fruit._id}`)
                    }
                  />
                </View>
              ))}
              {filtered.length === 0 && (
                <View className="items-center" style={{ width: "100%", paddingVertical: 48 }}>
                  <Text className="text-base font-medium text-gray-400">Không tìm thấy loại trái cây</Text>
                  <Text className="text-sm text-gray-400" style={{ marginTop: 4 }}>Thử thay đổi từ khoá tìm kiếm</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ════════════════════════ COMBO TRÁI CÂY MIX ════════════════════════ */}
        <View style={{ gap: 14, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.gray[100] }}>
          <View>
            <Text className="text-2xl font-black text-green-900">Combo trái cây mix</Text>
            <Text className="text-gray-500 text-sm" style={{ marginTop: 2 }}>
              {comboFoods.length} combo • {availableComboCount} đang bán
            </Text>
          </View>

          <Pressable
            onPress={openComboAdd}
            disabled={foodLoading}
            className="flex-row items-center justify-center bg-green-600 rounded-xl self-start"
            style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}
          >
            <Plus size={15} color={colors.white} />
            <Text className="text-white font-bold text-sm">Thêm combo mix</Text>
          </Pressable>

          {comboPendingCount > 0 && (
            <View className="flex-row flex-wrap items-center" style={{ gap: 8 }}>
              <Pressable
                onPress={discardFoodChanges}
                disabled={foodLoading}
                className="flex-row items-center border border-gray-200 rounded-xl"
                style={{ paddingHorizontal: 12, paddingVertical: 9, gap: 6 }}
              >
                <RotateCcw size={14} color={colors.gray[500]} />
                <Text className="text-gray-500 font-bold text-sm">Huỷ thay đổi</Text>
              </Pressable>
              <Pressable
                onPress={handleComboSaveAll}
                disabled={foodLoading || comboSaveStatus === "saving"}
                className={`flex-row items-center rounded-xl ${comboSaveStatus === "error" ? "bg-red-500" : "bg-amber-500"
                  }`}
                style={{ paddingHorizontal: 16, paddingVertical: 9, gap: 6 }}
              >
                {comboSaveStatus === "saving" ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Save size={14} color={colors.white} />
                )}
                <Text className="text-white font-bold text-sm">
                  {comboSaveStatus === "saving"
                    ? "Đang lưu…"
                    : comboSaveStatus === "error"
                      ? "Lỗi, thử lại"
                      : `Lưu ${comboPendingCount} thay đổi`}
                </Text>
              </Pressable>
            </View>
          )}
          {comboSaveStatus === "saved" && comboPendingCount === 0 && (
            <View className="flex-row items-center" style={{ gap: 6 }}>
              <Check size={14} color={colors.green[600]} />
              <Text className="text-green-600 font-bold text-sm">Đã lưu thành công</Text>
            </View>
          )}

          {!!foodError && (
            <View className="flex-row items-center justify-between bg-red-50 border border-red-200 rounded-xl" style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
              <Text className="text-red-700 text-sm flex-1" style={{ paddingRight: 8 }}>{foodError}</Text>
              <Pressable onPress={clearFoodError}>
                <X size={14} color={colors.red[600]} />
              </Pressable>
            </View>
          )}

          <View style={{ position: "relative", justifyContent: "center" }}>
            <View style={{ position: "absolute", left: 13, zIndex: 1 }}>
              <Search size={14} color={colors.gray[400]} />
            </View>
            <TextInput
              value={comboSearch}
              onChangeText={setComboSearch}
              placeholder="Tìm combo mix..."
              placeholderTextColor={colors.gray[300]}
              className="bg-white border border-gray-200 rounded-xl text-sm text-gray-700"
              style={{ paddingLeft: 36, paddingRight: 14, paddingVertical: 11 }}
            />
          </View>

          {/* [GRID-2COL] Danh sách combo hiển thị dạng lưới 2 cột/hàng */}
          {foodLoading && comboFoods.length === 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: COMBO_GRID_GAP }}>
              {[...Array(4)].map((_, i) => (
                <View
                  key={i}
                  style={{ width: COMBO_GRID_ITEM_WIDTH }}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                >
                  <View style={{ height: 110 }} className="bg-gray-100" />
                  <View className="p-3" style={{ gap: 6 }}>
                    <View className="bg-gray-100 rounded" style={{ height: 12, width: "70%" }} />
                    <View className="bg-gray-100 rounded" style={{ height: 10, width: "45%" }} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: COMBO_GRID_GAP }}>
              {filteredCombos.map((combo) => (
                <View key={combo._id} style={{ width: COMBO_GRID_ITEM_WIDTH }}>
                  <ComboCard
                    combo={combo}
                    onInfo={openComboInfo}
                    isPending={
                      foodPendingChanges.has(`add:${combo._id}`) || foodPendingChanges.has(`update:${combo._id}`)
                    }
                  />
                </View>
              ))}
              {filteredCombos.length === 0 && (
                <View className="items-center" style={{ width: "100%", paddingVertical: 48 }}>
                  <Text className="text-base font-medium text-gray-400">Chưa có combo trái cây mix nào</Text>
                  <Text className="text-sm text-gray-400" style={{ marginTop: 4 }}>
                    Bấm "Thêm combo mix" để tạo combo đầu tiên
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ─── Modal thêm / sửa trái cây ─────────────────────────────────────── */}
      {(modal === "add" || modal === "edit") && (
        <FormModalCard
          visible
          onClose={closeModal}
          title={modal === "add" ? "Thêm loại trái cây" : "Chỉnh sửa loại trái cây"}
          footer={
            <ConfirmModalFooter
              onCancel={closeModal}
              onConfirm={handleSave}
              confirmDisabled={!form.fruitName.trim()}
            />
          }
        >
          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>Ảnh</Text>
            <ImageUploadField
              key={imageFieldKey}
              currentUrl={imageRemoved ? null : form.imageUrl ?? null}
              onSelect={(file) => {
                setImageFile(file);
                setImageRemoved(false);
              }}
            />
            {(imageFile || (!imageRemoved && form.imageUrl)) && (
              <Pressable onPress={handleRemoveImage} style={{ marginTop: 6 }}>
                <Text className="text-xs text-red-400 font-medium">Xoá ảnh</Text>
              </Pressable>
            )}
          </View>

          <LabeledInput label="Tên loại trái cây *" value={form.fruitName} onChangeText={(t) => ff("fruitName", t)} />

          <IngredientPicker selectedIngredients={form.ingredients} onChange={handleFruitIngredientsChange} />

          <LabeledInput
            label="Ghi chú"
            value={form.note}
            onChangeText={(t) => ff("note", t)}
            multiline
            rows={2}
          />

          <Pressable
            onPress={() => ff("isAvailable", !form.isAvailable)}
            className="flex-row items-center"
            style={{ gap: 8 }}
          >
            <AvailabilityToggle isAvailable={form.isAvailable} onToggle={() => ff("isAvailable", !form.isAvailable)} />
            <Text className="text-sm font-medium text-gray-600">Đang bán</Text>
          </Pressable>
        </FormModalCard>
      )}

      {/* ─── Modal chi tiết trái cây (nay bao gồm Ghi chú / Sửa / Xoá) ───────── */}
      {modal === "info" && (
        <FruitInfoModal
          fruit={infoFruit}
          visible
          onClose={closeModal}
          onEdit={openEdit}
          onRemove={handleRemoveFromInfo}
          onEditNote={openNoteEdit}
        />
      )}

      {/* ─── Modal sửa ghi chú trái cây ─────────────────────────────────────── */}
      {modal === "note" && (
        <FormModalCard
          visible
          onClose={closeModal}
          title={`Ghi chú — ${noteFruit?.fruitName ?? ""}`}
          footer={<ModalButton onPress={handleSaveNote} label="Lưu ghi chú" icon={Check} />}
        >
          <LabeledInput label="Ghi chú" value={noteDraft} onChangeText={setNoteDraft} multiline rows={4} />
        </FormModalCard>
      )}

      {/* ─── Modal thêm / sửa combo mix ─────────────────────────────────────── */}
      {(comboModal === "add" || comboModal === "edit") && (
        <FormModalCard
          visible
          onClose={closeComboModal}
          title={comboModal === "add" ? "Thêm combo trái cây mix" : "Chỉnh sửa combo trái cây mix"}
          footer={
            <ConfirmModalFooter
              onCancel={closeComboModal}
              onConfirm={handleComboSave}
              confirmDisabled={!comboForm.foodName.trim()}
            />
          }
        >
          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 8 }}>
              Ảnh combo
            </Text>
            <ImageUploadField
              key={comboImageFieldKey}
              currentUrl={comboImageRemoved ? null : comboForm.imageUrl ?? null}
              onSelect={(file) => {
                setComboImageFile(file);
                setComboImageRemoved(false);
              }}
            />
            {(comboImageFile || (!comboImageRemoved && comboForm.imageUrl)) && (
              <Pressable onPress={handleComboRemoveImage} style={{ marginTop: 6 }}>
                <Text className="text-xs text-red-400 font-medium">Xoá ảnh</Text>
              </Pressable>
            )}
          </View>

          <LabeledInput label="Tên combo *" value={comboForm.foodName} onChangeText={(t) => cff("foodName", t)} />

          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 6 }}>Danh mục</Text>
            <View className="bg-gray-50 border border-gray-200 rounded-xl" style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text className="text-sm text-gray-500 font-medium">Trái cây mix</Text>
            </View>
          </View>

          <IngredientPicker selectedIngredients={comboForm.ingredients} onChange={handleComboIngredientsChange} />

          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 6 }}>Giá vốn (₫)</Text>
            {comboHasIngredients ? (
              <View className="bg-green-50 border border-green-200 rounded-xl" style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
                <Text className="text-sm font-semibold text-green-700">
                  {fmtVND(computedComboCost)} <Text className="text-xs font-normal text-green-500">(tự tính)</Text>
                </Text>
              </View>
            ) : (
              <LabeledInput
                value={String(comboForm.costPrice)}
                onChangeText={(t) => cff("costPrice", Number(t) || 0)}
                keyboardType="numeric"
              />
            )}
          </View>

          <LabeledInput
            label="Giá bán (₫)"
            value={String(comboForm.originalPrice)}
            onChangeText={(t) => cff("originalPrice", Number(t) || 0)}
            keyboardType="numeric"
          />

          <LabeledInput
            label="Trọng số AI [0–1]"
            value={String(comboForm.aiTrainingWeight)}
            onChangeText={(t) => cff("aiTrainingWeight", Number(t) || 0)}
            keyboardType="decimal-pad"
          />

          <View>
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ marginBottom: 6 }}>Biên LN dự kiến</Text>
            <MarginBar margin={comboMarginPreview} />
          </View>

          <LabeledInput
            label="Ghi chú"
            value={comboForm.note}
            onChangeText={(t) => cff("note", t)}
            multiline
            rows={2}
          />

          <Pressable
            onPress={() => cff("isAvailable", !comboForm.isAvailable)}
            className="flex-row items-center"
            style={{ gap: 8 }}
          >
            <AvailabilityToggle
              isAvailable={comboForm.isAvailable}
              onToggle={() => cff("isAvailable", !comboForm.isAvailable)}
            />
            <Text className="text-sm font-medium text-gray-600">Đang bán</Text>
          </Pressable>
        </FormModalCard>
      )}

      {/* ─── Modal chi tiết combo mix (nay bao gồm Ghi chú / Sửa / Xoá) ──────── */}
      {comboModal === "info" && (
        <ComboInfoModal
          combo={infoCombo}
          visible
          onClose={closeComboModal}
          onEdit={openComboEdit}
          onRemove={handleComboRemoveFromInfo}
          onEditNote={openComboNoteEdit}
        />
      )}

      {/* ─── Modal sửa ghi chú combo mix ────────────────────────────────────── */}
      {comboModal === "note" && (
        <FormModalCard
          visible
          onClose={closeComboModal}
          title={`Ghi chú — ${noteCombo?.foodName ?? ""}`}
          footer={<ModalButton onPress={handleComboSaveNote} label="Lưu ghi chú" icon={Check} />}
        >
          <LabeledInput label="Ghi chú" value={comboNoteDraft} onChangeText={setComboNoteDraft} multiline rows={4} />
        </FormModalCard>
      )}
    </View>
  );
}