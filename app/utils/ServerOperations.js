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
