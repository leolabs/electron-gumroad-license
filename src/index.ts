import Store from "electron-store";
import got from "got";
import { machineIdSync } from "node-machine-id";

import {
  GumroadSuccessResponse,
  GumroadResponse,
  Purchase,
} from "./types/gumroad";

const API_URL = "https://api.gumroad.com/v2/licenses/verify";

export interface GumroadLicenseOptions {
  /** Specifies how many times a single license code can be activated. Default: unlimited. */
  maxUses?: number;
  /** Specifies how many days a license stays valid without being validated. Default: unlimited. */
  maxDaysBetweenChecks?: number;
  /** Overrides Gumroad's default API endpoint for verifying licenses. */
  gumroadApiUrl?: string;
  /** Disables encrypting the license key with a unique machine id. */
  disableEncryption?: boolean;
}

export enum CheckStatus {
  ValidLicense,
  InvalidLicense,
  OutdatedLicense,
  NotSet,
  UnableToCheck,
}

type CheckResult =
  | { status: CheckStatus.ValidLicense; response: GumroadSuccessResponse }
  | { status: CheckStatus.InvalidLicense; error: string }
  | { status: CheckStatus.UnableToCheck };

/**
 * Creates a new license manager for your product.
 *
 * @param productId your product ID as specified by Gumroad
 */
export const createLicenseManager = (
  productId: string,
  options?: GumroadLicenseOptions,
) => {
  const encryptionKey = productId + machineIdSync();
  const userStore = new Store({
    name: "license",
    fileExtension: "key",
    encryptionKey: !options?.disableEncryption ? encryptionKey : undefined,
    clearInvalidConfig: true,
  });

  /**
   * Validates a given license key against Gumroad's API and increases the use
   * count if specified.
   *
   * @param licenseKey the given license key
   * @param increaseUseCount increases the use count if true
   */
  const validateLicenseCode = async (
    licenseKey: string,
    increaseUseCount = false,
  ): Promise<CheckResult> => {
    let result: GumroadResponse;
    try {
      result = await got
        .post(options?.gumroadApiUrl ?? API_URL, {
          throwHttpErrors: false,
          form: {
            product_permalink: productId,
            license_key: licenseKey.trim(),
            increment_uses_count: increaseUseCount,
          },
        })
        .json();
    } catch (e) {
      return { status: CheckStatus.UnableToCheck };
    }

    if (!result.success) {
      return {
        status: CheckStatus.InvalidLicense,
        error:
          result.message || "License check failed without an error message.",
      };
    }

    // Check whether the purchase has been refunded or chargebacked
    if (
      !result.purchase ||
      result.purchase.refunded ||
      result.purchase.chargebacked
    ) {
      return {
        status: CheckStatus.InvalidLicense,
        error:
          "Your purchase has been refunded, so your license is no longer valid.",
      };
    }

    return {
      status: CheckStatus.ValidLicense,
      response: result,
    };
  };

  /**
   * Validates a new license key against Gumroad's API and stores it locally if
   * it is valid. This increases the use counter for the license.
   *
   * @param licenseKey the license key to check against
   */
  const addLicense = async (
    licenseKey: string,
  ): Promise<
    | { success: true; response: GumroadResponse }
    | { success: false; error: string }
  > => {
    if (typeof options?.maxUses !== "undefined") {
      const result = await validateLicenseCode(licenseKey);
      if (
        result.status === CheckStatus.ValidLicense &&
        result.response.uses >= options?.maxUses
      ) {
        return {
          success: false,
          error: `You have reached the limit of ${options.maxUses} activations.`,
        };
      }
    }

    const result = await validateLicenseCode(licenseKey, true);

    if (result.status === CheckStatus.UnableToCheck) {
      return {
        success: false,
        error: "Could not reach the Gumroad license servers.",
      };
    }

    if (result.status === CheckStatus.InvalidLicense) {
      return { success: false, error: result.error };
    }

    userStore.set("licenseKey", licenseKey);
    userStore.set("lastCheckAttempt", Date.now());
    userStore.set("lastCheckSuccess", Date.now());
    return { success: true, response: result.response };
  };

  /**
   * Checks the locally stored license. If Gumroad's API can be reached, the
   * license is validated again. Otherwise, the locally stored license is used.
   */
  const checkCurrentLicense = async (): Promise<
    | { status: CheckStatus.ValidLicense; purchase: Purchase }
    | {
        status:
          | CheckStatus.InvalidLicense
          | CheckStatus.OutdatedLicense
          | CheckStatus.NotSet;
      }
  > => {
    const key = userStore.get("licenseKey");

    if (!key) {
      return { status: CheckStatus.NotSet };
    }

    userStore.set("lastCheckAttempt", Date.now());
    const result = await validateLicenseCode(key);

    switch (result.status) {
      case CheckStatus.ValidLicense:
        userStore.set("lastCheckSuccess", Date.now());
        userStore.set("purchase", result.response.purchase);
        return {
          status: CheckStatus.ValidLicense,
          purchase: result.response.purchase,
        };
      case CheckStatus.UnableToCheck:
        const storedPurchase = userStore.get("purchase");
        const lastCheckSuccess = userStore.get("lastCheckSuccess");

        if (
          options?.maxDaysBetweenChecks &&
          (!lastCheckSuccess ||
            Date.now() - lastCheckSuccess >
              86_400_000 * options.maxDaysBetweenChecks)
        ) {
          return { status: CheckStatus.OutdatedLicense };
        }

        return storedPurchase
          ? {
              status: CheckStatus.ValidLicense,
              purchase: storedPurchase,
            }
          : { status: CheckStatus.InvalidLicense };
      case CheckStatus.InvalidLicense:
        userStore.delete("purchase");
        return { status: CheckStatus.InvalidLicense };
    }
  };

  /**
   * Clears the stored license.
   */
  const clearLicense = () => {
    userStore.clear();
  };

  return { checkCurrentLicense, addLicense, validateLicenseCode, clearLicense };
};
