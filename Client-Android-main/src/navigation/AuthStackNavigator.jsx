import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "../screens/LoginScreen";
import RegisterScreen from "../screens/RegisterScreen";
import { ROUTES } from "../constants/routes";

const Stack = createNativeStackNavigator();

export default function AuthStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.AUTH_LOGIN} component={LoginScreen} />
      <Stack.Screen name={ROUTES.AUTH_REGISTER} component={RegisterScreen} />
    </Stack.Navigator>
  );
}
