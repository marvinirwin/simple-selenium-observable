const sleep = n => new Promise(resolve => setTimeout(resolve, n));
const webdriver = require('selenium-webdriver');
const {SeleniumDataBus} = require("./index")();

/**
 * @type {WebDriver}
 */
let driver;
beforeEach(async () => {
    driver = new webdriver.Builder()
        .forBrowser('chrome')
        .build();
    await driver.get('localhost:8080');
});

test('The states synchronize', async () => {
    const context = new SeleniumDataBus(driver);
    await context.setup(driver);

    await driver.executeScript(
        `
            window.seleniumContext.prop1.next('This should be sent to node');
            `
    );
    context.prop2.next('This should be sent to Selenium');
    await sleep(1000);
    await driver.executeScript(
        `
            if (window.seleniumContext.prop2.value !== 'This should be sent to Selenium') {
                throw new Error('SeleniumContext did not update!');
            }
            `
    );
    expect(context.prop1.value === 'This should be sent to node'); // hmmm, why doesnt this expect trigger failure
});



