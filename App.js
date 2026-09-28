import 'react-native-get-random-values';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './app/screens/LoginScreen';
import MainScreen from './app/screens/MainScreen';
import InstallPrompt from './app/components/InstallPrompt';
import i18n from './app/languages/langStrings';
import * as Commons from './app/utils/Commons';
import * as Constants from './app/utils/Constants';

const Stack = createNativeStackNavigator();

// React Native's Alert is not implemented on react-native-web, so provide a
// browser-based fallback so the app behaves the same on all platforms.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
    Alert.alert = (title = '', message = '', buttons = []) => {
        const text = [title, message].filter(Boolean).join('\n\n');
        const confirmButton = buttons.find((button) => button.style !== 'cancel');
        const cancelButton = buttons.find((button) => button.style === 'cancel');

        if (confirmButton && cancelButton) {
            if (window.confirm(text)) {
                confirmButton.onPress?.();
            } else {
                cancelButton.onPress?.();
            }
            return;
        }

        window.alert(text);
        (buttons[0] || {}).onPress?.();
    };
}

export default function App() {
    const [ready, setReady] = useState(false);

    // Restore the language the user picked the last time the app was opened.
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const stored = await Commons.getFromAS(Constants.language);
                if (stored) {
                    i18n.locale = stored;
                }
            } catch (error) {
                console.log('Failed to restore language:', error);
            } finally {
                if (mounted) {
                    setReady(true);
                }
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    // Keep the browser tab title in sync with the app name on web.
    useEffect(() => {
        if (Platform.OS === 'web' && typeof document !== 'undefined') {
            document.title = 'Arafat Chargers';
        }
    }, []);

    // The service worker is what lets the browser offer "Install app". It is
    // skipped in development so it never interferes with fast refresh.
    useEffect(() => {
        if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
            return;
        }
        if (!('serviceWorker' in navigator) || (typeof __DEV__ !== 'undefined' && __DEV__)) {
            return;
        }
        navigator.serviceWorker
            .register('/sw.js')
            .catch((error) => console.log('Service worker registration failed:', error));
    }, []);

    if (!ready) {
        return (
            <View style={styles.loader}>
                <ActivityIndicator size="large" color={Constants.brandPrimary} />
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <NavigationContainer documentTitle={{ enabled: false }}>
                <StatusBar style="light" />
                <Stack.Navigator
                    initialRouteName="Login"
                    screenOptions={{ headerShown: false }}
                >
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="Main" component={MainScreen} />
                </Stack.Navigator>
            </NavigationContainer>
            <InstallPrompt />
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    loader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Constants.brandBg,
    },
});
