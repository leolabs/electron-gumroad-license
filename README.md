# Electron Gumroad License

[![NPM Package](https://img.shields.io/npm/v/electron-gumroad-license)](https://npmjs.com/package/electron-gumroad-license)

This library allows you to verify and store a user's license for your Electron
app with [Gumroad's API](https://help.gumroad.com/article/76-license-keys).

A valid license is automatically stored in a local file that's encrypted with a
key unique to the user's computer. While this doesn't prevent cracking a
license, it makes it more difficult to copy a license file to another computer.

## Getting Started

To use this library, create a new `licenseManager` with the ID of your Gumroad
product. You can then use it to check the current license, validate a new one,
and more:

```ts
import { createLicenseManager, CheckStatus } from "electron-gumroad-license";

const licenseManager = createLicenseManager("product-id");

// Verify a license key and store it if it's valid
await licenseManager.addLicense("license-key");

// Check whether a local license exists and if it's valid
await licenseManager.checkCurrentLicense();
```

## Options

In addition to the product ID, you can pass an option object to the
licenseManager. The following values can be set:

```ts
const options = {
  /** Specifies how many times a single license code can be activated. Default: unlimited. */
  maxUses: number;
  /** Specifies how many days a license stays valid without being validated. Default: unlimited. */
  maxDaysBetweenChecks: number;
  /** Overrides Gumroad's default API endpoint for verifying licenses. */
  gumroadApiUrl: string;
  /** Disables encrypting the license key with a unique machine id. */
  disableEncryption: boolean;
}
```

## Contributing

This package is still in its early stages. Please feel free to contribute by
opening issues and submitting PRs if you feel that something could be done
better.
