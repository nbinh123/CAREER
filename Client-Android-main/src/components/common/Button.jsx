import React from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";

const VARIANTS = {
  primary: {
    base: "bg-chili active:bg-chili-dark",
    text: "text-paper",
  },

  dark: {
    base: "bg-ink active:bg-ink-soft",
    text: "text-paper",
  },

  outline: {
    base: "bg-transparent border border-ink/20 active:bg-ink/5",
    text: "text-ink",
  },

  ghost: {
    base: "bg-transparent active:bg-ink/5",
    text: "text-ink",
  },
};

export default function Button({
  children,
  variant = "primary",
  className = "",
  icon: Icon,
  iconColor,
  fullWidth = false,
  disabled = false,
  loading = false,
  onPress,
}) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      className={`
        flex-row
        items-center
        justify-center
        gap-2
        rounded-full
        px-5
        py-3
        ${fullWidth ? "w-full" : ""}
        ${isDisabled ? "opacity-40" : ""}
        ${v.base}
        ${className}
      `}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color="#FBF6EC"
        />
      )}

      {!loading && Icon && (
        <Icon
          size={18}
          strokeWidth={2}
          color={iconColor}
        />
      )}

      <Text
        className={`font-display font-medium text-sm tracking-wide ${v.text}`}
      >
        {children}
      </Text>
    </Pressable>
  );
}