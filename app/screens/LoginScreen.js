import React, { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Image,
    Alert,
    ScrollView,
    KeyboardAvoidingView,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import i18n from '../languages/langStrings';
import * as ServerOperations from '../utils/ServerOperations';
import * as Commons from '../utils/Commons';
import * as Constants from '../utils/Constants';

export default function LoginScreen({ navigation }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [lang, setLang] = useState(i18n.locale || 'en');

    const autoLoginAttempted = useRef(false);
    const isArabic = lang.startsWith('ar');

    const onChangeUser = (text) => setUsername(text);
    const onChangePassword = (text) => setPassword(text);

    const toggleLanguage = async () => {
        const next = lang === 'en' ? 'ar' : 'en';
        i18n.locale = next;
        await Commons.saveToAS(Constants.language, next);
        setLang(next);
    };

    // ----------------------------------------------------------------
    // Auto login using the credentials stored from the previous session
    // ----------------------------------------------------------------
    useEffect(() => {
        if (autoLoginAttempted.current) {
            return;
        }
        autoLoginAttempted.current = true;

        (async () => {
            try {
                const userFromStorage = await Commons.getFromAS('userID');
                const passFromStorage = await Commons.getFromAS('password');

                if (!userFromStorage || !passFromStorage) {
                    autoLoginAttempted.current = false;
                    return;
                }

                setUsername(userFromStorage);
                setPassword(passFromStorage);
                setIsAutoLoggingIn(true);

                const resp = await ServerOperations.checkLogin(
                    userFromStorage,
                    passFromStorage,
                    Constants.appVersion
                );

                if (resp && resp.result === true) {
                    await Commons.saveToAS('userName', resp.userName || '');
                    navigation.navigate('Main', { userName: resp.userName || '' });
                }
            } catch (error) {
                console.error('Auto-login error:', error);
            } finally {
                setIsAutoLoggingIn(false);
            }
        })();
    }, [navigation]);

    // ----------------------------------------------------------------
    // Manual login
    // ----------------------------------------------------------------
    const onLogin = async () => {
        if (!username.trim() || !password) {
            Alert.alert(i18n.t('loginFailed'), i18n.t('invalidCredentials'));
            return;
        }

        setIsLoading(true);
        try {
            const response = await ServerOperations.checkLogin(
                username.trim(),
                password,
                Constants.appVersion
            );

            if (response && response.result === true) {
                await Commons.saveToAS('userID', username.trim());
                await Commons.saveToAS('userName', response.userName || '');
                await Commons.saveToAS('password', password);

                navigation.navigate('Main', { userName: response.userName || '' });
            } else if (response && response.msg) {
                Alert.alert(i18n.t('loginFailed'), response.msg);
            } else {
                Alert.alert(i18n.t('loginFailed'), i18n.t('invalidCredentials'));
            }
        } catch (error) {
            console.error('Login error:', error);
            Alert.alert(i18n.t('loginFailed'), i18n.t('networkError'));
        } finally {
            setIsLoading(false);
        }
    };

    const renderInput = (icon, value, onChangeText, placeholder, extraProps = {}) => (
        <View style={[styles.inputRow, isArabic && styles.rowReverse]}>
            <MaterialIcons name={icon} size={20} color={Constants.brandPrimary} />
            <TextInput
                style={[styles.input, { textAlign: isArabic ? 'right' : 'left' }]}
                placeholder={placeholder}
                placeholderTextColor={Constants.brandMuted}
                value={value}
                onChangeText={onChangeText}
                autoCapitalize="none"
                {...extraProps}
            />
            {extraProps.secureToggle ? (
                <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)}>
                    <MaterialIcons
                        name={showPassword ? 'visibility-off' : 'visibility'}
                        size={20}
                        color={Constants.brandMuted}
                    />
                </TouchableOpacity>
            ) : null}
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Colored header (holds the language switcher + branding) */}
                    <View style={styles.header}>
                        <View style={[styles.languageBar, isArabic && styles.languageBarRtl]}>
                            <TouchableOpacity style={styles.languageButton} onPress={toggleLanguage}>
                                <MaterialIcons name="language" size={18} color="#FFFFFF" />
                                <Text style={styles.languageButtonText}>
                                    {i18n.t('languageLabel')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.headerBody}>
                            <View style={styles.logoCircle}>
                                <Image
                                    source={require('../../assets/logo.png')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                            </View>
                            <Text style={styles.title}>{i18n.t('appTitle')}</Text>
                            <Text style={styles.subtitle}>{i18n.t('appSubtitle')}</Text>
                        </View>
                    </View>

                    {/* Login card */}
                    <View style={styles.bodyWrap}>
                        <View style={styles.card}>
                            {renderInput('person-outline', username, onChangeUser, i18n.t('username'))}
                            {renderInput('lock-outline', password, onChangePassword, i18n.t('password'), {
                                secureTextEntry: !showPassword,
                                secureToggle: true,
                            })}

                            <TouchableOpacity
                                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                                onPress={onLogin}
                                disabled={isLoading}
                                activeOpacity={0.85}
                            >
                                {isLoading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <MaterialIcons name="login" size={20} color="#FFFFFF" />
                                        <Text style={styles.loginButtonText}>{i18n.t('login')}</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {isAutoLoggingIn ? (
                                <View style={styles.autoLoginRow}>
                                    <ActivityIndicator size="small" color={Constants.brandPrimary} />
                                    <Text style={styles.autoLoginText}>{i18n.t('loggingIn')}</Text>
                                </View>
                            ) : null}
                        </View>

                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Constants.brandPrimary,
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        backgroundColor: Constants.brandBg,
        paddingBottom: 24,
    },
    languageBar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 18,
        paddingTop: 10,
        width: '100%',
    },
    languageBarRtl: {
        justifyContent: 'flex-start',
    },
    languageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
    },
    languageButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
        marginLeft: 6,
        fontSize: 13,
    },
    header: {
        backgroundColor: Constants.brandPrimary,
        borderBottomLeftRadius: 26,
        borderBottomRightRadius: 26,
        paddingBottom: 60,
    },
    headerBody: {
        alignItems: 'center',
        paddingTop: 10,
    },
    bodyWrap: {
        width: '100%',
        maxWidth: 460,
        alignSelf: 'center',
    },
    logoCircle: {
        width: 108,
        height: 108,
        borderRadius: 54,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.18,
                shadowRadius: 12,
            },
            android: { elevation: 6 },
        }),
    },
    logo: {
        width: 76,
        height: 76,
        borderRadius: 38,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: '800',
        marginTop: 16,
        letterSpacing: 0.4,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 13,
        marginTop: 6,
    },
    card: {
        backgroundColor: Constants.brandCard,
        marginHorizontal: 22,
        marginTop: -36,
        borderRadius: 22,
        padding: 22,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        ...Platform.select({
            ios: {
                shadowColor: '#0A2A2A',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
            },
            android: { elevation: 5 },
        }),
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        backgroundColor: '#F7FAFA',
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 54,
        marginBottom: 14,
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: Constants.brandText,
        marginHorizontal: 10,
        paddingVertical: 0,
    },
    loginButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 54,
        borderRadius: 14,
        backgroundColor: Constants.brandPrimary,
        marginTop: 6,
        ...Platform.select({
            ios: {
                shadowColor: Constants.brandPrimaryDark,
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.3,
                shadowRadius: 10,
            },
            android: { elevation: 4 },
        }),
    },
    loginButtonDisabled: {
        opacity: 0.7,
    },
    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '700',
        marginHorizontal: 8,
    },
    autoLoginRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    autoLoginText: {
        color: Constants.brandMuted,
        fontSize: 13,
        marginLeft: 8,
    },
    versionText: {
        color: Constants.brandMuted,
        fontSize: 13,
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 26,
    },
});
