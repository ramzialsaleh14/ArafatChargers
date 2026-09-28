import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import i18n from '../languages/langStrings';
import * as Commons from '../utils/Commons';
import * as Constants from '../utils/Constants';

// Storage key holding the timestamp (ms) until which we stay quiet.
const DISMISS_KEY = 'installPrompt.snoozeUntil';
const SNOOZE_DAYS = 7;
const INSTALLED_DAYS = 3650;

const isWeb = Platform.OS === 'web';

// ---------------------------------------------------------------------------
// `beforeinstallprompt` can fire before React has mounted, so the event is
// captured at module scope and the component subscribes afterwards.
// ---------------------------------------------------------------------------
let deferredPrompt = null;
const subscribers = new Set();
const emit = () => subscribers.forEach((notify) => notify(deferredPrompt));

if (isWeb && typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (event) => {
        // Keep Chrome's own mini-infobar out of the way - we show our own.
        event.preventDefault();
        deferredPrompt = event;
        emit();
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        emit();
    });
}

// Already launched from the home screen / installed window?
const isRunningInstalled = () => {
    if (!isWeb || typeof window === 'undefined') {
        return false;
    }
    const matches = ['standalone', 'fullscreen', 'minimal-ui'].some(
        (mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches
    );
    return matches || window.navigator?.standalone === true;
};

// Safari/Firefox never fire `beforeinstallprompt`, so iOS gets instructions.
const needsManualInstructions = () => {
    if (!isWeb || typeof navigator === 'undefined') {
        return false;
    }
    const agent = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(agent);
    const isThirdPartyIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(agent);
    return isIos && !isThirdPartyIosBrowser;
};

/**
 * Offers to install the app as a home screen / desktop app when it is opened
 * in the browser. Renders nothing on native, when already installed, or while
 * the user has snoozed the prompt.
 */
export default function InstallPrompt() {
    const [visible, setVisible] = useState(false);
    const [manual, setManual] = useState(false);
    const [busy, setBusy] = useState(false);
    const isArabic = Commons.isArabic();

    useEffect(() => {
        if (!isWeb || isRunningInstalled()) {
            return undefined;
        }

        let cancelled = false;

        (async () => {
            const snoozeUntil = Number(await Commons.getFromAS(DISMISS_KEY)) || 0;
            if (cancelled || Date.now() < snoozeUntil) {
                return;
            }
            if (deferredPrompt) {
                setVisible(true);
                return;
            }
            if (needsManualInstructions()) {
                setManual(true);
                setVisible(true);
            }
        })();

        // Chromium only fires the event once the install criteria are met (and
        // usually after some engagement), which can be after we mount.
        const onPromptAvailable = (prompt) => {
            if (prompt) {
                setManual(false);
                setVisible(true);
            }
        };
        subscribers.add(onPromptAvailable);

        return () => {
            cancelled = true;
            subscribers.delete(onPromptAvailable);
        };
    }, []);

    const snooze = async (days) => {
        await Commons.saveToAS(
            DISMISS_KEY,
            String(Date.now() + days * 24 * 60 * 60 * 1000)
        );
    };

    const onInstall = async () => {
        if (!deferredPrompt) {
            setVisible(false);
            return;
        }

        setBusy(true);
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            await snooze(outcome === 'accepted' ? INSTALLED_DAYS : SNOOZE_DAYS);
        } catch (error) {
            console.log('Install prompt failed:', error);
        } finally {
            // A deferred prompt can only be used once.
            deferredPrompt = null;
            setBusy(false);
            setVisible(false);
        }
    };

    const onLater = async () => {
        await snooze(SNOOZE_DAYS);
        setVisible(false);
    };

    if (!visible) {
        return null;
    }

    const align = { textAlign: isArabic ? 'right' : 'left' };

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            onRequestClose={onLater}
            statusBarTranslucent
        >
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <Image
                        source={require('../../assets/logo.png')}
                        style={styles.logo}
                        resizeMode="contain"
                    />

                    <Text style={[styles.title, align]}>{i18n.t('installTitle')}</Text>
                    <Text style={[styles.message, align]}>
                        {manual ? i18n.t('installManualMessage') : i18n.t('installMessage')}
                    </Text>

                    {manual ? (
                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={onLater}
                            activeOpacity={0.85}
                        >
                            <MaterialIcons name="check" size={20} color="#FFFFFF" />
                            <Text style={styles.primaryButtonText}>{i18n.t('ok')}</Text>
                        </TouchableOpacity>
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.primaryButton, busy && styles.buttonDisabled]}
                                onPress={onInstall}
                                disabled={busy}
                                activeOpacity={0.85}
                            >
                                {busy ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <MaterialIcons
                                            name="install-mobile"
                                            size={20}
                                            color="#FFFFFF"
                                        />
                                        <Text style={styles.primaryButtonText}>
                                            {i18n.t('install')}
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.laterButton} onPress={onLater}>
                                <Text style={styles.laterButtonText}>{i18n.t('installLater')}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: 'rgba(6,32,42,0.55)',
    },
    card: {
        width: '100%',
        maxWidth: 380,
        alignItems: 'center',
        backgroundColor: Constants.brandCard,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
    },
    logo: {
        width: 76,
        height: 76,
        marginBottom: 14,
    },
    title: {
        alignSelf: 'stretch',
        fontSize: 19,
        fontWeight: '800',
        color: Constants.brandText,
    },
    message: {
        alignSelf: 'stretch',
        fontSize: 14,
        lineHeight: 20,
        color: Constants.brandMuted,
        marginTop: 8,
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
        height: 50,
        borderRadius: 14,
        backgroundColor: Constants.brandPrimary,
        marginTop: 20,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        marginHorizontal: 8,
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    laterButton: {
        marginTop: 12,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    laterButtonText: {
        color: Constants.brandMuted,
        fontSize: 14,
        fontWeight: '700',
    },
});
