import * as Constants from "./Constants";
import * as Commons from "./Commons";

const httpTimeout = (ms, promise) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("timeout"));
    }, ms);
    promise.then(resolve, reject);
  });

export const httpRequest = async (url) => {
  /* Send request */
  const TIMEOUT = 20000;

  const response = await httpTimeout(
    TIMEOUT,
    fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }).catch((error) => {
      console.error(error);
      return Constants.networkError_code;
    })
  ).catch((error) => {
    return Constants.networkError_code;
  });
  const json = await response.json();
  return json;
};

export const ping = async (url, timeout) => {
  const response = await httpTimeout(
    timeout,
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "action=",
    })
      .then((response) => {
        if (response.status !== 200) {
          throw new Error("HTTP response status not code 200 as expected.");
        }
      })
      .catch((error) => {
        console.error(error);
        return Constants.networkError_code;
      })
  ).catch((error) => {
    console.log(error);
    return Constants.networkError_code;
  });
  return response;
};

/**
 * Sends a POST request to the gateway and appends the logged in user.
 * Arabic-indic digits (returned by some barcode hardware on Arabic devices)
 * are normalised into latin digits before the request is sent.
 */
export const pickHttpRequest = async (params) => {
  params = params
    .replace(/١/g, 1)
    .replace(/٢/g, 2)
    .replace(/٣/g, 3)
    .replace(/٤/g, 4)
    .replace(/٥/g, 5)
    .replace(/٦/g, 6)
    .replace(/٧/g, 7)
    .replace(/٨/g, 8)
    .replace(/٩/g, 9)
    .replace(/٠/g, 0);

  const TIMEOUT = 20000;
  const user = await Commons.getFromAS("userID");
  const url = Constants.pickServerUrl + params + "&currentuser=" + user;

  console.log(url);

  const response = await httpTimeout(
    TIMEOUT,
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    }).catch((error) => {
      console.error(error);
      return Constants.networkError_code;
    })
  ).catch((error) => {
    return Constants.networkError_code;
  });

  return response;
};

export const checkLogin = async (userID, password, appVersion) => {
  try {
    /* Request params */
    let params = "";
    params += `action=${Constants.CHECK_LOGIN}`;
    params += `&USER=${encodeURIComponent(userID)}`;
    params += `&PASSWORD=${encodeURIComponent(password)}`;
    params += `&APP.VERSION=${Constants.appVersion}`;

    console.log("Login request params:", params);

    /* Send request */
    const response = await pickHttpRequest(params);

    /* Check response */
    if (response === Constants.networkError_code) {
      console.error("Network error during login");
      return null;
    }

    if (response && response.ok) {
      try {
        const jsonResult = await response.json();
        console.log("Login JSON result:", jsonResult);
        return jsonResult;
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        return null;
      }
    }

    console.error("Login failed - response not ok:", response);
    return null;
  } catch (error) {
    console.error("Login request failed:", error);
    return null;
  }
};

/**
 * Returns the charger information for the scanned barcode.
 *
 * Expected JSON payload:
 *   { QRCODE, KWH, TOTAL_AMOUNT, ERROR: boolean, PAID: boolean }
 *
 * On any failure a normalised object with ERROR = true is returned so the
 * screen can always show the "No Data Found" state without extra checks.
 */
export const getChargerInfo = async (user, barcode) => {
  try {
    /* Request params */
    let params = "";
    params += `action=${Constants.GET_CHARGER_INFO}`;
    params += `&USER=${encodeURIComponent(user ?? "")}`;
    params += `&BARCODE=${encodeURIComponent(barcode ?? "")}`;

    console.log("Charger info request params:", params);

    /* Send request */
    const response = await pickHttpRequest(params);

    /* Check response */
    if (response === Constants.networkError_code) {
      console.error("Network error while getting charger info");
      return { ERROR: true, error: "network" };
    }

    if (response && response.ok) {
      try {
        const jsonResult = await response.json();
        console.log("Charger info JSON result:", jsonResult);
        return jsonResult;
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        return { ERROR: true, error: "invalid-response" };
      }
    }

    console.error("Get charger info failed - response not ok:", response);
    return { ERROR: true, error: "server" };
  } catch (error) {
    console.error("Get charger info request failed:", error);
    return { ERROR: true, error: error.message };
  }
};

/**
 * Stores the car plate number for the scanned charger.
 *
 * NOTE: `barcode` is the QRCODE value returned by GET.CHARGER.INFO, not the
 * raw scanned barcode.
 *
 * Expected JSON payload:
 *   { ERROR: boolean, MSG }
 *
 * ERROR must come back false for the caller to continue (i.e. print).
 */
export const setChargerCar = async (user, barcode, car) => {
  try {
    /* Request params */
    let params = "";
    params += `action=${Constants.SET_CHARGER_CAR}`;
    params += `&USER=${encodeURIComponent(user ?? "")}`;
    params += `&BARCODE=${encodeURIComponent(barcode ?? "")}`;
    params += `&CAR=${encodeURIComponent(car ?? "")}`;

    console.log("Set charger car request params:", params);

    /* Send request */
    const response = await pickHttpRequest(params);

    /* Check response */
    if (response === Constants.networkError_code) {
      console.error("Network error while setting charger car");
      return { ERROR: true, error: "network" };
    }

    if (response && response.ok) {
      try {
        const jsonResult = await response.json();
        console.log("Set charger car JSON result:", jsonResult);
        return jsonResult;
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        return { ERROR: true, error: "invalid-response" };
      }
    }

    console.error("Set charger car failed - response not ok:", response);
    return { ERROR: true, error: "server" };
  } catch (error) {
    console.error("Set charger car request failed:", error);
    return { ERROR: true, error: error.message };
  }
};

// ---------------------------------------------------------------------------
// List payload helpers
// ---------------------------------------------------------------------------
// The gateway wraps list results in different envelopes (or returns a bare
// array); flatten all of them to a plain array.
const listOf = (payload) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    const keys = ["CHARGERS", "ORDERS", "DATA", "RESULT", "RESULTS", "LIST", "ROWS", "ITEMS"];
    for (const key of keys) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }
  }
  return [];
};

// Reads the first non-empty value among `keys` (case-insensitive).
const pickValue = (source, keys) => {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  const lookup = {};
  Object.keys(source).forEach((key) => {
    lookup[key.toUpperCase()] = key;
  });
  for (const key of keys) {
    const realKey = lookup[key.toUpperCase()];
    if (realKey) {
      const value = source[realKey];
      if (value !== undefined && value !== null && value !== "") {
        return value;
      }
    }
  }
  return undefined;
};

// Normalises scalars and small { ID, NAME } objects into a trimmed string.
const textOf = (value) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    const inner = pickValue(value, ["ID", "NAME", "VALUE", "CODE", "NO", "NUMBER"]);
    return inner !== undefined && inner !== null ? String(inner).trim() : "";
  }
  return String(value).trim();
};

// The various truthy flavours a boolean flag can arrive in.
const flagOf = (value) =>
  value === true ||
  value === "true" ||
  value === "Y" ||
  value === "y" ||
  value === 1 ||
  value === "1" ||
  value === "PAID";

// A charger can be a bare id or a small object.
const normalizeCharger = (raw) => {
  if (raw === undefined || raw === null) {
    return "";
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return textOf(
      pickValue(raw, [
        "CHARGER",
        "CHARGER_ID",
        "CHARGERID",
        "CHARGER_NO",
        "METER",
        "ID",
        "NAME",
        "VALUE",
        "CODE",
        "NO",
      ])
    );
  }
  return String(raw).trim();
};

// The invoice-number flavours the service may use.
const INVNO_FIELDS = ["INVNO", "INV_NO", "INV.NO", "INVOICE", "INVOICE_NO", "INVOICE_NUMBER"];

// Field-name flavours the orders service may use.
const ORDER_FIELDS = {
  datetime: ["DATETIME", "DATE_TIME", "DATE TIME", "ORDER_DATE", "TRANS_DATE", "DATE", "TIME"],
  charger: ["CHARGER", "CHARGER_ID", "CHARGERID", "CHARGER_NO", "METER"],
  connector: ["CONNECTOR", "CONNECTOR_ID", "CONNECTORID", "CONNECTOR_NO", "PORT"],
  user: ["USER", "USERNAME", "USER_NAME", "USERID", "USER_ID"],
  car: ["CAR", "CAR_NO", "CARNO", "CAR_NUMBER", "PLATE", "PLATE_NO"],
  invNo: [...INVNO_FIELDS, "QRCODE", "CODE"],
  // The code handed to the check / print flow (BARCODE when the order has one).
  barcode: ["BARCODE", "BAR_CODE", ...INVNO_FIELDS, "QRCODE", "CODE"],
  paid: ["PAID", "IS_PAID", "ISPAID", "PAYED", "PAID_FLAG"],
};

// Maps any of the field-name flavours the service may use to one shape.
const normalizeOrder = (raw) => {
  if (raw === undefined || raw === null) {
    return null;
  }
  const source = typeof raw === "object" && !Array.isArray(raw) ? raw : { VALUE: raw };
  return {
    datetime: textOf(pickValue(source, ORDER_FIELDS.datetime)),
    charger: textOf(pickValue(source, ORDER_FIELDS.charger)),
    connector: textOf(pickValue(source, ORDER_FIELDS.connector)),
    user: textOf(pickValue(source, ORDER_FIELDS.user)),
    car: textOf(pickValue(source, ORDER_FIELDS.car)),
    invNo: textOf(pickValue(source, ORDER_FIELDS.invNo)),
    barcode: textOf(pickValue(source, ORDER_FIELDS.barcode)),
    paid: flagOf(pickValue(source, ORDER_FIELDS.paid)),
  };
};

/**
 * Returns the list of charger ids available to the logged in user.
 *
 * Resolves to an array of strings (empty when nothing is available or the
 * request fails) so callers can render a picker without extra checks.
 */
export const getChargers = async (user) => {
  try {
    /* Request params */
    let params = "";
    params += `action=${Constants.GET_CHARGERS}`;
    params += `&USER=${encodeURIComponent(user ?? "")}`;

    console.log("Chargers request params:", params);

    /* Send request */
    const response = await pickHttpRequest(params);

    /* Check response */
    if (response === Constants.networkError_code) {
      console.error("Network error while getting chargers");
      return [];
    }

    if (response && response.ok) {
      try {
        const jsonResult = await response.json();
        console.log("Chargers JSON result:", jsonResult);
        const ids = listOf(jsonResult).map(normalizeCharger).filter(Boolean);
        return Array.from(new Set(ids));
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        return [];
      }
    }

    console.error("Get chargers failed - response not ok:", response);
    return [];
  } catch (error) {
    console.error("Get chargers request failed:", error);
    return [];
  }
};

/**
 * Returns the pending orders for a charger between two dd/MM/yyyy dates.
 *
 * `charger` is required, `connector` is optional (pass an empty string for
 * "all connectors"). `user` is optional and is sent as an empty string when
 * not given; today's orders pass it so the service filters by that user. Each
 * order is normalised to:
 *   { datetime, charger, connector, user, car, invNo, barcode, paid }
 *
 * Resolves to an array (possibly empty) on success, or null when the request
 * fails, so the caller can tell "nothing found" from "could not load".
 */
export const getPendingOrders = async (charger, connector, fromDate, toDate, user) => {
  try {
    /* Request params */
    let params = "";
    params += `action=${Constants.GET_PENDING_ORDERS}`;
    params += `&CHARGER=${encodeURIComponent(charger ?? "")}`;
    params += `&CONNECTOR=${encodeURIComponent(connector ?? "")}`;
    params += `&FROM_DATE=${encodeURIComponent(fromDate ?? "")}`;
    params += `&TO_DATE=${encodeURIComponent(toDate ?? "")}`;
    // Empty for pending orders; today's orders fill it with the current user
    // so the service returns that user's orders across every charger.
    params += `&USER=${encodeURIComponent(user ?? "")}`;

    console.log("Pending orders request params:", params);

    /* Send request */
    const response = await pickHttpRequest(params);

    /* Check response */
    if (response === Constants.networkError_code) {
      console.error("Network error while getting pending orders");
      return null;
    }

    if (response && response.ok) {
      try {
        const jsonResult = await response.json();
        console.log("Pending orders JSON result:", jsonResult);
        return listOf(jsonResult).map(normalizeOrder).filter(Boolean);
      } catch (jsonError) {
        console.error("Failed to parse JSON response:", jsonError);
        return null;
      }
    }

    console.error("Get pending orders failed - response not ok:", response);
    return null;
  } catch (error) {
    console.error("Get pending orders request failed:", error);
    return null;
  }
};

/**
 * Returns the logged in user's orders for the current day, across every
 * charger.
 *
 * Reuses the pending orders service with an empty charger filter and the
 * current day (00:00:00 to 23:59:59) as the date range, and adds the logged
 * in user to the request.
 *
 * Resolves to an array (possibly empty) on success, or null when the request
 * fails.
 */
export const getTodayOrders = async (user) => {
  const currentUser = user || (await Commons.getFromAS("userID")) || "";
  const fromDate = Commons.formatDateTime(Commons.startOfDay());
  const toDate = Commons.formatDateTime(Commons.endOfDay());

  return getPendingOrders("", "", fromDate, toDate, currentUser);
};
