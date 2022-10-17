// playwright.config.js
var fs = require("fs");
var cake = fs.readFileSync("./cake.txt", "utf-8");
// console.log(cake);

const config = {
  // Look for test files in the "tests" directory, relative to this configuration file
  testDir: 'tests',
  testMatch: ["**/__tests__/**/*.+(ts|js)", "**/?(*.)+(spec|test).+(ts|js)"],
  globalTimeout: 60*60*1000,
  use: {
    browserName: 'chromium',
    //browserName: 'firefox',
    //browserName: 'webkit',

    baseURL: "https://seller.shopee.ph",

    // Limit the number of workers on CI, use default locally
    workers: process.env.CI ? 2 : undefined,

    // Cake: Cookies from your session
    // Authorization: Bearer token
    extraHTTPHeaders: {
      "cookie": cake,
      "authorization": ""
    },
    setTimeout: 60000000,
    globalTimeout: 60000000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
};

module.exports = config;
