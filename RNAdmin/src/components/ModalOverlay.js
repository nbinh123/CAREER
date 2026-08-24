export default function ModalOverlay({ onClose, children }) {
  const { height: winHeight } = useWindowDimensions();
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}>
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(6,78,59,0.35)",
          }}
        />
        <View style={{ width: "100%", maxWidth: 420, maxHeight: winHeight * 0.85 }}>{children}</View>
      </View>
    </Modal>
  );
}
