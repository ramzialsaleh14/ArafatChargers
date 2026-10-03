import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Image,
    ScrollView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { SvgXml } from 'react-native-svg';

import i18n from '../languages/langStrings';
import * as Commons from '../utils/Commons';
import * as ServerOperations from '../utils/ServerOperations';
import * as Constants from '../utils/Constants';
import { getCode128Barcode, getQrCode } from '../utils/Barcode';
import { LOGO_DATA_URL } from '../utils/PrintLogo';
import ProgressDialog from '../components/ProgressDialog';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import OptionPickerModal from '../components/OptionPickerModal';
import DatePickerModal from '../components/DatePickerModal';

// Normalises the many flavours a boolean flag can arrive in.
const truthy = (value) =>
    value === true || value === 'true' || value === 'Y' || value === 'y' || value === 1 || value === '1';

// The service returns a MSG alongside ERROR = true. Accepts both cases.
const serverMessage = (resp) => {
    const value = resp?.MSG ?? resp?.msg;
    return value != null && String(value).trim() ? String(value).trim() : '';
};

// Splits an order's car plate ("00-00000", "00 00000" or "0000000") into the
// two parts used by the car inputs.
const splitCarPlate = (value) => {
    const text = String(value ?? '').trim();
    if (!text) {
        return ['', ''];
    }
    const parts = text.split(/[\s\-.]+/).filter(Boolean);
    if (parts.length >= 2) {
        return [parts[0], parts.slice(1).join('')];
    }
    // No separator: assume the last five characters are the second part.
    if (text.length > 5) {
        return [text.slice(0, text.length - 5), text.slice(-5)];
    }
    return [text, ''];
};

export default function MainScreen({ navigation, route }) {
    const [lang, setLang] = useState(i18n.locale || 'en');
    const [username, setUsername] = useState(route?.params?.userName || '');
    const [currentTime, setCurrentTime] = useState(new Date());

    const [barcode, setBarcode] = useState('');
    const [isChecking, setIsChecking] = useState(false);
    const [result, setResult] = useState(null); // { error, paid, qrcode, kwh, totalAmount }
    const [scannerVisible, setScannerVisible] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    // Car plate is captured as two free-form parts shown as "00-00000".
    const [carPart1, setCarPart1] = useState('');
    const [carPart2, setCarPart2] = useState('');
    // Measured width available for the on-screen barcode.
    const [barcodeBoxWidth, setBarcodeBoxWidth] = useState(0);

    // Barcode field value that produced the result currently shown below.
    const checkedInputRef = useRef('');
    // Lets the pending-order tap scroll back up to the result card.
    const scrollRef = useRef(null);

    // Pending orders section -------------------------------------------
    const [ordersExpanded, setOrdersExpanded] = useState(false);
    const [chargers, setChargers] = useState([]);
    const [chargersLoaded, setChargersLoaded] = useState(false);
    const [isLoadingChargers, setIsLoadingChargers] = useState(false);
    const [chargerPickerVisible, setChargerPickerVisible] = useState(false);
    const [selectedCharger, setSelectedCharger] = useState('');
    const [connectorFilter, setConnectorFilter] = useState('');
    // Default range covers the whole current day (00:00:00 to 23:59:59).
    const [fromDateTime, setFromDateTime] = useState(() =>
        Commons.formatDateTime(Commons.startOfDay())
    );
    const [toDateTime, setToDateTime] = useState(() =>
        Commons.formatDateTime(Commons.endOfDay())
    );
    // Which date field the calendar sheet is editing: 'from' | 'to' | null.
    const [datePickerTarget, setDatePickerTarget] = useState(null);
    const [orders, setOrders] = useState([]);
    const [ordersLoaded, setOrdersLoaded] = useState(false);
    const [isLoadingOrders, setIsLoadingOrders] = useState(false);

    const isArabic = lang.startsWith('ar');
    const hasBarcode = barcode.trim().length > 0;
    const showPaidScreen = !!result && !result.error && result.paid;
    const carNumber =
        carPart1.trim() && carPart2.trim() ? `${carPart1.trim()}-${carPart2.trim()}` : '';

    // Code 128 barcode + QR code (both rendered from SVG) for the code the
    // server returned.
    const barcodeModel = useMemo(
        () => (result && !result.error && result.qrcode ? getCode128Barcode(result.qrcode) : null),
        [result]
    );
    const qrModel = useMemo(
        () => (result && !result.error && result.qrcode ? getQrCode(result.qrcode) : null),
        [result]
    );

    // ------------------------------------------------------------------
    // Header info + clock
    // ------------------------------------------------------------------
    useEffect(() => {
        if (!username) {
            (async () => {
                const stored = await Commons.getFromAS('userName');
                if (stored) {
                    setUsername(stored);
                }
            })();
        }

        const timer = setInterval(() => {
            setCurrentTime((prev) => {
                const now = new Date();
                if (
                    now.getMinutes() !== prev.getMinutes() ||
                    now.getHours() !== prev.getHours()
                ) {
                    return now;
                }
                return prev;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleLanguage = async () => {
        const next = lang === 'en' ? 'ar' : 'en';
        i18n.locale = next;
        await Commons.saveToAS(Constants.language, next);
        setLang(next);
    };

    const onLogout = () => {
        Commons.confirmAlert('', i18n.t('logoutConfirm'), async () => {
            await Commons.removeFromAS('userID');
            await Commons.removeFromAS('password');
            navigation.replace('Login');
        });
    };

    // ------------------------------------------------------------------
    // Server call
    // ------------------------------------------------------------------
    // Drops the result card (server QR + its info) and forgets its source code.
    const clearResult = () => {
        checkedInputRef.current = '';
        setResult(null);
        setCarPart1('');
        setCarPart2('');
    };

    // The field is the source of truth: editing it invalidates the card below.
    const onChangeBarcode = (text) => {
        setBarcode(text);
        if (checkedInputRef.current && text.trim() !== checkedInputRef.current) {
            clearResult();
        }
    };

    const checkChargerInfo = useCallback(async (code) => {
        const inputValue = String(barcode ?? '').trim();
        const explicit = code != null ? String(code).trim() : '';

        // While the field still holds the code the card below came from, "Check"
        // re-checks the server QR shown at the bottom instead of the field value.
        const reuseServerQr =
            !explicit &&
            !!result &&
            !result.error &&
            !!result.qrcode &&
            checkedInputRef.current === inputValue;

        const value = explicit || (reuseServerQr ? String(result.qrcode).trim() : inputValue);

        if (!value) {
            Commons.okMsgAlert(i18n.t('pleaseEnterBarcode'));
            return;
        }

        // Remember which field value the upcoming result belongs to.
        checkedInputRef.current = explicit || inputValue;

        setIsChecking(true);
        setResult(null);
        // A new charger means a fresh car plate.
        setCarPart1('');
        setCarPart2('');

        try {
            const storedUser = await Commons.getFromAS('userID');
            const user = storedUser || route?.params?.userName || '';

            const resp = await ServerOperations.getChargerInfo(user, value);

            if (!resp || truthy(resp.ERROR)) {
                setResult({
                    error: true,
                    paid: false,
                    qrcode: '',
                    kwh: '',
                    totalAmount: '',
                    msg: serverMessage(resp),
                });
                return;
            }

            setResult({
                error: false,
                paid: truthy(resp.PAID),
                qrcode: resp.QRCODE != null ? String(resp.QRCODE) : '',
                kwh: resp.KWH != null ? String(resp.KWH) : '',
                totalAmount: resp.TOTAL_AMOUNT != null ? String(resp.TOTAL_AMOUNT) : '',
            });
        } catch (error) {
            console.error('checkChargerInfo error:', error);
            setResult({ error: true, paid: false, qrcode: '', kwh: '', totalAmount: '', msg: '' });
        } finally {
            setIsChecking(false);
        }
    }, [barcode, result, route?.params?.userName]);

    // Called by the scanner: fill the text input and auto trigger the check.
    const onBarcodeScanned = (scannedValue) => {
        setScannerVisible(false);
        setBarcode(scannedValue);
        // A fresh scan replaces whatever the card below was showing.
        clearResult();
        // Let the state settle (and the modal close) before hitting the server.
        setTimeout(() => {
            checkChargerInfo(scannedValue);
        }, 300);
    };

    const onReset = () => {
        clearResult();
        setBarcode('');
    };

    // ------------------------------------------------------------------
    // Pending orders
    // ------------------------------------------------------------------
    const loadChargers = useCallback(async () => {
        setIsLoadingChargers(true);
        try {
            const storedUser = await Commons.getFromAS('userID');
            const user = storedUser || route?.params?.userName || '';
            const list = (await ServerOperations.getChargers(user)) || [];
            setChargers(list);
            // A single charger is an easy win: preselect it.
            if (list.length === 1) {
                setSelectedCharger(list[0]);
            }
        } finally {
            setChargersLoaded(true);
            setIsLoadingChargers(false);
        }
    }, [route?.params?.userName]);

    // Chargers are only fetched the first time the section is opened.
    const onToggleOrders = () => {
        if (!ordersExpanded && !chargersLoaded && !isLoadingChargers) {
            loadChargers();
        }
        setOrdersExpanded((prev) => !prev);
    };

    const loadOrders = async () => {
        if (!selectedCharger) {
            Commons.okMsgAlert(i18n.t('chargerRequired'));
            return;
        }

        if (!Commons.parseDateTime(fromDateTime) || !Commons.parseDateTime(toDateTime)) {
            Commons.okMsgAlert(i18n.t('invalidDate'));
            return;
        }

        setIsLoadingOrders(true);
        try {
            const list = await ServerOperations.getPendingOrders(
                selectedCharger,
                connectorFilter.trim(),
                fromDateTime.trim(),
                toDateTime.trim()
            );

            // null means the request failed; [] just means nothing matched.
            if (list == null) {
                setOrders([]);
                setOrdersLoaded(false);
                Commons.okMsgAlert(i18n.t('ordersLoadFailed'));
                return;
            }

            setOrders(list);
            setOrdersLoaded(true);
        } finally {
            setIsLoadingOrders(false);
        }
    };

    // Unpaid orders reuse the scan flow: load the charger info for the
    // order's barcode, then let the user capture the car and print.
    const onSelectOrder = (order) => {
        const code = order?.barcode || order?.invNo;
        if (!order || order.paid || !code) {
            return;
        }
        setBarcode(code);
        clearResult();
        checkChargerInfo(code);

        // An order that already carries a car plate pre-fills the car inputs,
        // so pressing Print sends that plate back with the check.
        if (order.car) {
            const [first, second] = splitCarPlate(order.car);
            setCarPart1(first);
            setCarPart2(second);
        }

        scrollRef.current?.scrollTo({ y: 0, animated: true });
    };

    // ------------------------------------------------------------------
    // Printing
    // ------------------------------------------------------------------
    const buildPrintHtml = ({ qrSvg, barcodeSvg }) => {
        const direction = isArabic ? 'rtl' : 'ltr';
        // Keep the Code 128 bars square-ish on the 58mm roll (~52mm usable).
        const barcodeHeightMm =
            barcodeModel && barcodeModel.width
                ? Math.round((52 * barcodeModel.height) / barcodeModel.width)
                : 14;
        const rows = [
            [i18n.t('carNumber'), carNumber],
            [i18n.t('kwh'), result?.kwh],
            [i18n.t('totalAmount'), result?.totalAmount],
        ]
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(
                ([label, value]) =>
                    `<tr><td class="label">${label}</td><td class="value">${value}</td></tr>`
            )
            .join('');

        return `<!DOCTYPE html>
<html lang="${isArabic ? 'ar' : 'en'}" dir="${direction}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${i18n.t('appTitle')}</title>
<style>
  /* 58mm (5.8cm) thermal receipt paper */
  @page { size: 58mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 58mm;
    margin: 0 auto;
    padding: 3mm 3mm 5mm;
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #123040;
    font-size: 10px;
    line-height: 1.35;
  }
  h1 { font-size: 13px; margin: 0 0 2px; color: ${Constants.brandPrimary}; }
  .logo-wrap { text-align: center; margin-bottom: 2mm; }
  .logo-wrap img { width: 46mm; height: 46mm; object-fit: contain; }
  .sub { font-size: 9px; color: #6B7B85; margin-bottom: 5mm; }
  .card { padding: 0; border: none; }
  .code-wrap { text-align: center; margin-bottom: 3mm; }
  .qr-code svg { display: block; width: 34mm; height: 34mm; margin: 0 auto 2mm; }
  .bar-code svg { display: block; width: 100%; height: ${barcodeHeightMm}mm; }
  .code-text { font-size: 8px; word-break: break-all; margin-top: 2mm; }
  table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
  td { padding: 1.5mm 0; border-bottom: 1px dotted #B9C6CA; font-size: 10px; }
  td.label { color: #6B7B85; width: 45%; }
  td.value { font-weight: 700; }
  .footer { margin-top: 3mm; font-size: 8px; color: #9AA9AE; text-align: center; }
</style>
</head>
<body>
  <div class="logo-wrap"><img src="${LOGO_DATA_URL}" alt="${i18n.t('appTitle')}" /></div>
  <div class="sub">${i18n.t('resultTitle')} &middot; ${new Date().toLocaleString(isArabic ? 'ar' : 'en-GB')}</div>
  <div class="card">
    <div class="code-wrap">
      <div class="qr-code">${qrSvg || ''}</div>
      <div class="bar-code">${barcodeSvg || ''}</div>
      <div class="code-text">${result?.qrcode || ''}</div>
    </div>
    <table>${rows}</table>
  </div>
</body>
</html>`;
    };

    const onPrint = async () => {
        if (!result || result.error || result.paid) {
            return;
        }

        if (!carNumber) {
            Commons.okMsgAlert(i18n.t('carNumberRequired'));
            return;
        }

        setIsPrinting(true);

        const printHtml = async (codes) => {
            const html = buildPrintHtml(codes);

            if (Platform.OS === 'web') {
                const win = window.open('', '_blank');
                if (!win) {
                    Commons.okMsgAlert(i18n.t('printFailed'));
                    return;
                }
                win.document.open();
                win.document.write(html);
                win.document.close();
                win.focus();
                setTimeout(() => win.print(), 350);
                return;
            }

            try {
                const Print = require('expo-print');
                await Print.printAsync({ html });
            } catch (error) {
                console.error('Printing failed:', error);
                Commons.okMsgAlert(i18n.t('printFailed'));
            }
        };

        try {
            // The car number must be accepted by the server before printing.
            const storedUser = await Commons.getFromAS('userID');
            const user = storedUser || route?.params?.userName || '';

            // The service keys off the code returned by the check call,
            // not the raw scanned barcode.
            const saved = await ServerOperations.setChargerCar(user, result.qrcode, carNumber);

            if (!saved || truthy(saved.ERROR)) {
                Commons.okMsgAlert(serverMessage(saved) || i18n.t('carSaveFailed'));
                return;
            }

            // Embed the QR code and the Code 128 barcode as inline SVG.
            await printHtml({
                qrSvg: qrModel ? qrModel.svg : null,
                barcodeSvg: barcodeModel ? barcodeModel.svg : null,
            });
        } finally {
            setIsPrinting(false);
        }
    };

    // ------------------------------------------------------------------
    // Paid -> full green screen
    // ------------------------------------------------------------------
    if (showPaidScreen) {
        return (
            <SafeAreaView style={styles.paidSafeArea} edges={['top', 'bottom']}>
                <View style={styles.paidScreen}>
                    <MaterialIcons name="check-circle" size={110} color="#FFFFFF" />
                    <Text style={styles.paidTitle}>{i18n.t('paidTitle')}</Text>
                    <Text style={styles.paidDescription}>{i18n.t('paidDescription')}</Text>

                    <TouchableOpacity style={styles.paidButton} onPress={onReset} activeOpacity={0.85}>
                        <MaterialIcons name="refresh" size={20} color={Constants.brandSuccess} />
                        <Text style={styles.paidButtonText}>{i18n.t('checkAgain')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.paidLink} onPress={onLogout}>
                        <Text style={styles.paidLinkText}>{i18n.t('logout')}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // ------------------------------------------------------------------
    // Main render
    // ------------------------------------------------------------------
    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, isArabic && styles.rowReverse]}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerLogoCircle}>
                            <Image
                                source={require('../../assets/logo.png')}
                                style={styles.headerLogo}
                                resizeMode="contain"
                            />
                        </View>
                        <View style={[styles.headerTextWrap, isArabic && styles.alignEnd]}>
                            {/* <Text style={styles.headerTitle}>{i18n.t('appTitle')}</Text> */}
                            <Text style={styles.headerSubtitle}>
                                {i18n.t('welcome')}, {route?.params?.userName || username || ''}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.headerLangButton} onPress={toggleLanguage}>
                        <MaterialIcons name="language" size={18} color="#FFFFFF" />
                        <Text style={styles.headerLangText}>{i18n.t('languageLabel')}</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Scan card */}
                    <View style={styles.card}>
                        <View style={[styles.cardHeader, isArabic && styles.rowReverse]}>
                            <MaterialIcons name="qr-code-scanner" size={22} color={Constants.brandPrimary} />
                            <Text style={[styles.cardTitle, { textAlign: isArabic ? 'right' : 'left' }]}>
                                {i18n.t('scanCharger')}
                            </Text>
                        </View>
                        <Text style={[styles.cardSubtitle, { textAlign: isArabic ? 'right' : 'left' }]}>
                            {i18n.t('scanChargerSubtitle')}
                        </Text>

                        <View style={[styles.scanRow, isArabic && styles.rowReverse]}>
                            <TextInput
                                style={[styles.barcodeInput, { textAlign: isArabic ? 'right' : 'left' }]}
                                placeholder={i18n.t('barcodePlaceholder')}
                                placeholderTextColor={Constants.brandMuted}
                                value={barcode}
                                onChangeText={onChangeBarcode}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                returnKeyType="done"
                                onSubmitEditing={() => checkChargerInfo()}
                            />

                            <TouchableOpacity
                                style={styles.cameraButton}
                                onPress={() => setScannerVisible(true)}
                                activeOpacity={0.85}
                            >
                                <MaterialIcons name="photo-camera" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {hasBarcode ? (
                            <TouchableOpacity
                                style={styles.checkButton}
                                onPress={() => checkChargerInfo()}
                                disabled={isChecking}
                                activeOpacity={0.85}
                            >
                                {isChecking ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <MaterialIcons name="search" size={20} color="#FFFFFF" />
                                        <Text style={styles.checkButtonText}>{i18n.t('check')}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        ) : null}
                    </View>

                    {/* Error result */}
                    {result && result.error ? (
                        <View style={[styles.card, styles.errorCard]}>
                            <MaterialIcons name="error-outline" size={40} color={Constants.brandDanger} />
                            <Text style={styles.errorTitle}>{i18n.t('noDataFound')}</Text>
                            <Text style={styles.errorDescription}>
                                {result.msg || i18n.t('noDataFoundDescription')}
                            </Text>
                            <TouchableOpacity
                                style={styles.retryOutlineButton}
                                onPress={() => checkChargerInfo()}
                                activeOpacity={0.85}
                            >
                                <MaterialIcons name="refresh" size={18} color={Constants.brandPrimary} />
                                <Text style={styles.retryOutlineText}>{i18n.t('check')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    {/* Charger data */}
                    {result && !result.error && !result.paid ? (
                        <View style={styles.card}>
                            <View style={[styles.cardHeader, isArabic && styles.rowReverse]}>
                                <MaterialIcons name="receipt-long" size={22} color={Constants.brandPrimary} />
                                <Text style={[styles.cardTitle, { textAlign: isArabic ? 'right' : 'left' }]}>
                                    {i18n.t('resultTitle')}
                                </Text>
                            </View>

                            {result.qrcode ? (
                                <View
                                    style={styles.codeWrap}
                                    onLayout={(event) =>
                                        setBarcodeBoxWidth(
                                            // inner width = measured - 2*16 padding - 2*1 border
                                            Math.max(0, event.nativeEvent.layout.width - 34)
                                        )
                                    }
                                >
                                    {qrModel && qrModel.width > 0 && barcodeBoxWidth > 0 ? (
                                        <SvgXml
                                            xml={qrModel.svg}
                                            width={Math.min(barcodeBoxWidth, 190)}
                                            height={Math.min(barcodeBoxWidth, 190)}
                                        />
                                    ) : null}
                                    {barcodeModel && barcodeModel.width > 0 && barcodeBoxWidth > 0 ? (
                                        <SvgXml
                                            style={styles.barcodeSvg}
                                            xml={barcodeModel.svg}
                                            width={barcodeBoxWidth}
                                            height={
                                                (barcodeBoxWidth * barcodeModel.height) /
                                                barcodeModel.width
                                            }
                                        />
                                    ) : null}
                                    <Text style={styles.codeText}>{result.qrcode}</Text>
                                </View>
                            ) : null}

                            <View style={styles.infoTable}>
                                <View style={[styles.infoRow, isArabic && styles.rowReverse]}>
                                    <Text style={styles.infoLabel}>{i18n.t('kwh')}</Text>
                                    <Text style={styles.infoValue}>{result.kwh || '-'}</Text>
                                </View>
                                <View style={[styles.infoRow, isArabic && styles.rowReverse, styles.infoRowLast]}>
                                    <Text style={styles.infoLabel}>{i18n.t('totalAmount')}</Text>
                                    <Text style={styles.infoValue}>{result.totalAmount || '-'}</Text>
                                </View>
                            </View>

                            {/* Car number: required before printing */}
                            <View style={styles.carBlock}>
                                <Text style={[styles.carLabel, { textAlign: isArabic ? 'right' : 'left' }]}>
                                    {i18n.t('carNumber')}
                                </Text>
                                <View style={[styles.carInputRow, isArabic && styles.rowReverse]}>
                                    <TextInput
                                        style={[
                                            styles.carInput,
                                            styles.carInputFirst,
                                            { textAlign: isArabic ? 'right' : 'left' },
                                        ]}
                                        placeholder={i18n.t('carNumberFirstPart')}
                                        placeholderTextColor={Constants.brandMuted}
                                        value={carPart1}
                                        onChangeText={setCarPart1}
                                        keyboardType="number-pad"
                                        autoCorrect={false}
                                    />
                                    <Text style={styles.carDash}>-</Text>
                                    <TextInput
                                        style={[
                                            styles.carInput,
                                            styles.carInputSecond,
                                            { textAlign: isArabic ? 'right' : 'left' },
                                        ]}
                                        placeholder={i18n.t('carNumberSecondPart')}
                                        placeholderTextColor={Constants.brandMuted}
                                        value={carPart2}
                                        onChangeText={setCarPart2}
                                        keyboardType="number-pad"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>

                            <View style={[styles.actionsRow, isArabic && styles.rowReverse]}>
                                <TouchableOpacity
                                    style={[styles.printButton, isPrinting && styles.buttonDisabled]}
                                    onPress={onPrint}
                                    disabled={isPrinting}
                                    activeOpacity={0.85}
                                >
                                    {isPrinting ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="print" size={20} color="#FFFFFF" />
                                            <Text style={styles.printButtonText}>{i18n.t('print')}</Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.retryOutlineButton, styles.retryFlex]}
                                    onPress={() => checkChargerInfo()}
                                    activeOpacity={0.85}
                                >
                                    <MaterialIcons name="refresh" size={18} color={Constants.brandPrimary} />
                                    <Text style={styles.retryOutlineText}>{i18n.t('check')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : null}

                    {/* Pending orders */}
                    <View style={styles.card}>
                        <TouchableOpacity
                            style={[styles.cardHeader, isArabic && styles.rowReverse]}
                            onPress={onToggleOrders}
                            activeOpacity={0.85}
                        >
                            <MaterialIcons
                                name="pending-actions"
                                size={22}
                                color={Constants.brandPrimary}
                            />
                            <Text
                                style={[
                                    styles.cardTitle,
                                    styles.pendingTitle,
                                    { textAlign: isArabic ? 'right' : 'left' },
                                ]}
                            >
                                {i18n.t('pendingOrders')}
                            </Text>
                            <MaterialIcons
                                name={ordersExpanded ? 'expand-less' : 'expand-more'}
                                size={24}
                                color={Constants.brandMuted}
                            />
                        </TouchableOpacity>

                        <Text
                            style={[styles.cardSubtitle, { textAlign: isArabic ? 'right' : 'left' }]}
                        >
                            {i18n.t('pendingOrdersSubtitle')}
                        </Text>

                        {ordersExpanded ? (
                            <View>
                                {/* Charger (required) */}
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        { textAlign: isArabic ? 'right' : 'left' },
                                    ]}
                                >
                                    {i18n.t('chargerLabel')}
                                </Text>
                                <TouchableOpacity
                                    style={[styles.selectField, isArabic && styles.rowReverse]}
                                    onPress={() => setChargerPickerVisible(true)}
                                    activeOpacity={0.85}
                                >
                                    {isLoadingChargers ? (
                                        <ActivityIndicator
                                            size="small"
                                            color={Constants.brandPrimary}
                                        />
                                    ) : (
                                        <Text
                                            style={[
                                                styles.selectValue,
                                                !selectedCharger && styles.selectPlaceholder,
                                                { textAlign: isArabic ? 'right' : 'left' },
                                            ]}
                                            numberOfLines={1}
                                        >
                                            {selectedCharger || i18n.t('chargerPlaceholder')}
                                        </Text>
                                    )}
                                    <MaterialIcons
                                        name="arrow-drop-down"
                                        size={24}
                                        color={Constants.brandMuted}
                                    />
                                </TouchableOpacity>

                                {/* Connector (optional) */}
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        { textAlign: isArabic ? 'right' : 'left' },
                                    ]}
                                >
                                    {i18n.t('connectorLabel')}
                                </Text>
                                <TextInput
                                    style={[
                                        styles.filterInput,
                                        { textAlign: isArabic ? 'right' : 'left' },
                                    ]}
                                    placeholder={i18n.t('connectorPlaceholder')}
                                    placeholderTextColor={Constants.brandMuted}
                                    value={connectorFilter}
                                    onChangeText={setConnectorFilter}
                                    autoCorrect={false}
                                />

                                {/* From date & time */}
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        styles.fieldLabelSpaced,
                                        { textAlign: isArabic ? 'right' : 'left' },
                                    ]}
                                >
                                    {i18n.t('fromDateLabel')}
                                </Text>
                                <TouchableOpacity
                                    style={[styles.dateField, isArabic && styles.rowReverse]}
                                    onPress={() => setDatePickerTarget('from')}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.dateValue,
                                            { textAlign: isArabic ? 'right' : 'left' },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {fromDateTime}
                                    </Text>
                                    <MaterialIcons
                                        name="calendar-today"
                                        size={18}
                                        color={Constants.brandMuted}
                                    />
                                </TouchableOpacity>

                                {/* To date & time */}
                                <Text
                                    style={[
                                        styles.fieldLabel,
                                        styles.fieldLabelSpaced,
                                        { textAlign: isArabic ? 'right' : 'left' },
                                    ]}
                                >
                                    {i18n.t('toDateLabel')}
                                </Text>
                                <TouchableOpacity
                                    style={[styles.dateField, isArabic && styles.rowReverse]}
                                    onPress={() => setDatePickerTarget('to')}
                                    activeOpacity={0.85}
                                >
                                    <Text
                                        style={[
                                            styles.dateValue,
                                            { textAlign: isArabic ? 'right' : 'left' },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {toDateTime}
                                    </Text>
                                    <MaterialIcons
                                        name="calendar-today"
                                        size={18}
                                        color={Constants.brandMuted}
                                    />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.checkButton,
                                        isArabic && styles.rowReverse,
                                        isLoadingOrders && styles.buttonDisabled,
                                    ]}
                                    onPress={loadOrders}
                                    disabled={isLoadingOrders}
                                    activeOpacity={0.85}
                                >
                                    {isLoadingOrders ? (
                                        <ActivityIndicator size="small" color="#FFFFFF" />
                                    ) : (
                                        <>
                                            <MaterialIcons name="search" size={20} color="#FFFFFF" />
                                            <Text style={styles.checkButtonText}>
                                                {i18n.t('showOrders')}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>

                                {/* Orders list */}
                                {orders.length > 0 ? (
                                    <View style={styles.ordersList}>
                                        {orders.map((order, index) => {
                                            const canTap = !order.paid && !!(order.barcode || order.invNo);
                                            const meta = [
                                                order.charger,
                                                order.connector
                                                    ? `${i18n.t('connectorLabel')} ${order.connector}`
                                                    : '',
                                                order.invNo || order.barcode,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ');

                                            return (
                                                <TouchableOpacity
                                                    key={`${order.invNo}-${order.datetime}-${index}`}
                                                    style={[
                                                        styles.orderRow,
                                                        index === orders.length - 1 &&
                                                            styles.orderRowLast,
                                                    ]}
                                                    activeOpacity={canTap ? 0.7 : 1}
                                                    disabled={!canTap}
                                                    onPress={() => onSelectOrder(order)}
                                                >
                                                    <View
                                                        style={[
                                                            styles.orderTop,
                                                            isArabic && styles.rowReverse,
                                                        ]}
                                                    >
                                                        <Text style={styles.orderDate}>
                                                            {order.datetime || '-'}
                                                        </Text>
                                                        <View
                                                            style={[
                                                                styles.badge,
                                                                order.paid
                                                                    ? styles.badgePaid
                                                                    : styles.badgeUnpaid,
                                                            ]}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.badgeText,
                                                                    order.paid
                                                                        ? styles.badgeTextPaid
                                                                        : styles.badgeTextUnpaid,
                                                                ]}
                                                            >
                                                                {order.paid
                                                                    ? i18n.t('paid')
                                                                    : i18n.t('unpaid')}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <Text
                                                        style={[
                                                            styles.orderMeta,
                                                            { textAlign: isArabic ? 'right' : 'left' },
                                                        ]}
                                                    >
                                                        {meta || '-'}
                                                    </Text>

                                                    {order.user || order.car ? (
                                                        <View
                                                            style={[
                                                                styles.orderDetailRow,
                                                                isArabic && styles.rowReverse,
                                                            ]}
                                                        >
                                                            {order.user ? (
                                                                <View style={styles.orderDetail}>
                                                                    <MaterialIcons
                                                                        name="person-outline"
                                                                        size={14}
                                                                        color={Constants.brandMuted}
                                                                    />
                                                                    <Text style={styles.orderDetailText}>
                                                                        {order.user}
                                                                    </Text>
                                                                </View>
                                                            ) : null}
                                                            {order.car ? (
                                                                <View style={styles.orderDetail}>
                                                                    <MaterialIcons
                                                                        name="directions-car"
                                                                        size={14}
                                                                        color={Constants.brandMuted}
                                                                    />
                                                                    <Text style={styles.orderDetailText}>
                                                                        {order.car}
                                                                    </Text>
                                                                </View>
                                                            ) : null}
                                                        </View>
                                                    ) : null}

                                                    {canTap ? (
                                                        <View
                                                            style={[
                                                                styles.orderTapHint,
                                                                isArabic && styles.rowReverse,
                                                            ]}
                                                        >
                                                            <MaterialIcons
                                                                name="print"
                                                                size={14}
                                                                color={Constants.brandPrimary}
                                                            />
                                                            <Text style={styles.orderTapHintText}>
                                                                {i18n.t('tapToPrint')}
                                                            </Text>
                                                        </View>
                                                    ) : null}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : ordersLoaded ? (
                                    <View style={styles.ordersEmpty}>
                                        <MaterialIcons
                                            name="inbox"
                                            size={34}
                                            color={Constants.brandMuted}
                                        />
                                        <Text style={styles.ordersEmptyText}>
                                            {i18n.t('noOrdersFound')}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}
                    </View>

                    {/* Footer */}
                    <View style={[styles.footer, isArabic && styles.rowReverse]}>
                        <TouchableOpacity style={styles.footerButton} onPress={onLogout}>
                            <MaterialIcons name="exit-to-app" size={18} color={Constants.brandDanger} />
                            <Text style={[styles.footerButtonText, { color: Constants.brandDanger }]}>
                                {i18n.t('logout')}
                            </Text>
                        </TouchableOpacity>

                        <Text style={styles.versionText}>
                            {currentTime.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                            })}{' '}
                        </Text>
                    </View>
                </ScrollView>

                <BarcodeScannerModal
                    visible={scannerVisible}
                    onScanned={onBarcodeScanned}
                    onClose={() => setScannerVisible(false)}
                />

                <OptionPickerModal
                    visible={chargerPickerVisible}
                    title={i18n.t('selectCharger')}
                    options={chargers}
                    selectedValue={selectedCharger}
                    onSelect={setSelectedCharger}
                    onClose={() => setChargerPickerVisible(false)}
                    loading={isLoadingChargers}
                    emptyText={i18n.t('noChargersFound')}
                />

                <DatePickerModal
                    visible={datePickerTarget != null}
                    title={
                        datePickerTarget === 'to' ? i18n.t('toDateLabel') : i18n.t('fromDateLabel')
                    }
                    value={datePickerTarget === 'to' ? toDateTime : fromDateTime}
                    defaultTime={datePickerTarget === 'to' ? 'end' : 'start'}
                    onSelect={(value) => {
                        if (datePickerTarget === 'to') {
                            setToDateTime(value);
                        } else {
                            setFromDateTime(value);
                        }
                    }}
                    onClose={() => setDatePickerTarget(null)}
                />

                <ProgressDialog visible={isChecking} title={i18n.t('checking')} />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: Constants.brandPrimary,
    },
    container: {
        flex: 1,
        backgroundColor: Constants.brandBg,
    },
    rowReverse: {
        flexDirection: 'row-reverse',
    },
    alignEnd: {
        alignItems: 'flex-end',
    },

    // Header ------------------------------------------------------------
    header: {
        backgroundColor: Constants.brandPrimary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: 18,
        borderBottomLeftRadius: 22,
        borderBottomRightRadius: 22,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    headerLogoCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerLogo: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    headerTextWrap: {
        marginLeft: 12,
        flex: 1,
    },
    headerTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 12,
        marginTop: 3,
    },
    headerLangButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 20,
    },
    headerLangText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        marginLeft: 6,
    },

    // Content -----------------------------------------------------------
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 26,
        width: '100%',
        maxWidth: 560,
        alignSelf: 'center',
    },
    card: {
        backgroundColor: Constants.brandCard,
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        ...Platform.select({
            ios: {
                shadowColor: '#0A2A2A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.08,
                shadowRadius: 10,
            },
            android: { elevation: 3 },
        }),
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: Constants.brandText,
        marginLeft: 8,
    },
    cardSubtitle: {
        fontSize: 12.5,
        color: Constants.brandMuted,
        marginTop: 6,
        marginBottom: 14,
        lineHeight: 19,
    },

    // Scan row -----------------------------------------------------------
    scanRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    barcodeInput: {
        flex: 1,
        height: 54,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        backgroundColor: '#F7FAFA',
        borderRadius: 14,
        paddingHorizontal: 14,
        fontSize: 16,
        color: Constants.brandText,
    },
    cameraButton: {
        width: 54,
        height: 54,
        borderRadius: 14,
        backgroundColor: Constants.brandAccent,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 10,
    },
    checkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 52,
        borderRadius: 14,
        backgroundColor: Constants.brandPrimary,
        marginTop: 14,
    },
    checkButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        marginHorizontal: 8,
    },
    buttonDisabled: {
        opacity: 0.65,
    },

    // Error ---------------------------------------------------------------
    errorCard: {
        alignItems: 'center',
        borderColor: '#F3D6D4',
        backgroundColor: '#FFF8F8',
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: Constants.brandDanger,
        marginTop: 12,
    },
    errorDescription: {
        fontSize: 13,
        color: Constants.brandMuted,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
    },
    retryOutlineButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 46,
        borderRadius: 13,
        borderWidth: 1.5,
        borderColor: Constants.brandPrimary,
        paddingHorizontal: 20,
        marginTop: 18,
    },
    retryFlex: {
        flex: 1,
        marginTop: 0,
    },
    retryOutlineText: {
        color: Constants.brandPrimary,
        fontSize: 15,
        fontWeight: '700',
        marginHorizontal: 6,
    },

    // Result ---------------------------------------------------------------
    codeWrap: {
        alignItems: 'center',
        marginTop: 16,
        padding: 16,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: Constants.brandBorder,
    },
    barcodeSvg: {
        marginTop: 18,
    },
    codeText: {
        marginTop: 12,
        fontSize: 13,
        color: Constants.brandText,
        textAlign: 'center',
        letterSpacing: 0.3,
    },
    infoTable: {
        marginTop: 16,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        borderRadius: 14,
        paddingHorizontal: 14,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#EDF3F3',
    },
    infoRowLast: {
        borderBottomWidth: 0,
    },
    infoLabel: {
        fontSize: 14,
        color: Constants.brandMuted,
    },
    infoValue: {
        fontSize: 15,
        fontWeight: '800',
        color: Constants.brandText,
    },
    carBlock: {
        marginTop: 16,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    carLabel: {
        fontSize: 14,
        color: Constants.brandMuted,
        marginBottom: 10,
    },
    carInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
    },
    carInput: {
        // minWidth: 0 is required on web, otherwise the <input> keeps its
        // intrinsic width and overflows the card instead of shrinking.
        minWidth: 0,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        fontSize: 16,
        fontWeight: '700',
        color: Constants.brandText,
    },
    carInputFirst: {
        flexGrow: 0.6,
    },
    carInputSecond: {
        flexGrow: 1.4,
    },
    carDash: {
        fontSize: 18,
        fontWeight: '800',
        color: Constants.brandText,
        marginHorizontal: 8,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
    },    printButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 50,
        borderRadius: 14,
        backgroundColor: Constants.brandPrimary,
        marginRight: 10,
    },
    printButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
        marginHorizontal: 8,
    },

    // Pending orders -------------------------------------------------------
    pendingTitle: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: 12.5,
        color: Constants.brandMuted,
        marginBottom: 6,
    },
    selectField: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 52,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        backgroundColor: '#F7FAFA',
        borderRadius: 14,
        paddingHorizontal: 14,
    },
    selectValue: {
        flex: 1,
        fontSize: 16,
        color: Constants.brandText,
    },
    selectPlaceholder: {
        color: Constants.brandMuted,
    },
    fieldLabelSpaced: {
        marginTop: 14,
    },
    filterInput: {
        minWidth: 0,
        height: 50,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        backgroundColor: '#F7FAFA',
        borderRadius: 14,
        paddingHorizontal: 14,
        fontSize: 15,
        color: Constants.brandText,
    },
    dateField: {
        minWidth: 0,
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        backgroundColor: '#F7FAFA',
        borderRadius: 14,
        paddingHorizontal: 14,
    },
    dateValue: {
        flex: 1,
        minWidth: 0,
        fontSize: 15,
        color: Constants.brandText,
        marginRight: 8,
    },
    ordersList: {
        marginTop: 16,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        borderRadius: 14,
        paddingHorizontal: 14,
    },
    orderRow: {
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#EDF3F3',
    },
    orderRowLast: {
        borderBottomWidth: 0,
    },
    orderTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    orderDate: {
        fontSize: 14,
        fontWeight: '800',
        color: Constants.brandText,
    },
    badge: {
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 3,
        marginHorizontal: 6,
    },
    badgePaid: {
        backgroundColor: '#E4F4EA',
    },
    badgeUnpaid: {
        backgroundColor: '#FDECEC',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '800',
    },
    badgeTextPaid: {
        color: Constants.brandSuccess,
    },
    badgeTextUnpaid: {
        color: Constants.brandDanger,
    },
    orderMeta: {
        fontSize: 12.5,
        color: Constants.brandMuted,
        marginTop: 6,
    },
    orderDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
    },
    orderDetail: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    orderDetailText: {
        fontSize: 12.5,
        color: Constants.brandText,
        marginHorizontal: 4,
    },
    orderTapHint: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
    },
    orderTapHintText: {
        fontSize: 12,
        fontWeight: '800',
        color: Constants.brandPrimary,
        marginHorizontal: 6,
    },
    ordersEmpty: {
        alignItems: 'center',
        paddingVertical: 22,
        marginTop: 16,
        borderWidth: 1,
        borderColor: Constants.brandBorder,
        borderRadius: 14,
    },
    ordersEmptyText: {
        fontSize: 13,
        color: Constants.brandMuted,
        marginTop: 8,
        textAlign: 'center',
    },

    // Footer ---------------------------------------------------------------
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
        paddingHorizontal: 4,
    },
    footerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    footerButtonText: {
        fontSize: 14,
        fontWeight: '700',
        marginHorizontal: 6,
    },
    versionText: {
        fontSize: 12,
        color: Constants.brandMuted,
    },

    // Paid screen ----------------------------------------------------------
    paidSafeArea: {
        flex: 1,
        backgroundColor: Constants.brandSuccess,
    },
    paidScreen: {
        flex: 1,
        backgroundColor: Constants.brandSuccess,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    paidTitle: {
        color: '#FFFFFF',
        fontSize: 30,
        fontWeight: '800',
        marginTop: 22,
    },
    paidDescription: {
        color: 'rgba(255,255,255,0.92)',
        fontSize: 15,
        marginTop: 10,
        textAlign: 'center',
    },
    paidButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        height: 52,
        borderRadius: 14,
        paddingHorizontal: 26,
        marginTop: 36,
    },
    paidButtonText: {
        color: Constants.brandSuccess,
        fontSize: 16,
        fontWeight: '800',
        marginHorizontal: 8,
    },
    paidLink: {
        marginTop: 18,
        paddingVertical: 6,
    },
    paidLinkText: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 14,
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
});
