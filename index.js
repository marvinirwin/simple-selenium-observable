const sleep = n => new Promise(resolve => setTimeout(resolve, n));

module.exports = function() {
    /**
     * Returns an observable with the properties {value, next}
     * @param name
     * @param initValue
     * @returns {{next(*=, *=): void, subscribe(*=): void, subscribers: [], value: string}}
     */
    function getFakeObservable(name, initValue = '') {
        const subject$ = {
            value: initValue,
            subscribers: [],
            next(newValue = '', sendThroughChannel = true) {
                this.value = newValue;
                this.subscribers.forEach(f => f(newValue, sendThroughChannel));
            },
            subscribe(cb) {
                this.subscribers.push(cb);
            }
        };
        subject$.subscribe((v, sendToSelenium = false) => {
                if (!sendToSelenium) {
                    return;
                }
                sendMessageThroughChannel(
                    name,
                    v
                )
            }
        );
        return subject$;
    }

    /**
     * Sends a message from the browser to NodeJs
     * @param sender
     * @param msg
     */
    function sendMessageToNode(sender, msg) {
        const el = document.createElement('div');
        el.id = `selenium-event-a${counter}`;
        counter++;
        el.className = 'selenium-event';
        el.style = 'top: -1000';
        el.textContent = JSON.stringify({sender, message: msg});
        document.body.appendChild(el);
    }

    /**
     * Sends a message from NodeJs to the browser
     * @param driver
     * @param k
     * @param v
     * @returns {Promise<void>}
     */
    async function sendMessageToBrowser(driver, k, v) {
        await driver.executeScript(
            // The first argument is our key
            // The second is the value
            // The third is telling the next function not to send it back through the channel
            `window.seleniumContext[arguments[0]].next(arguments[1], false)`,
            k, v
        )
    }

    /**
     * The function which allows us to send data to the other side, whichever that side is
     */
    let sendMessageThroughChannel;

    /**
     * Properties of this class will be synchronized between Selenium and Nodejs by calling prop.next('newVal');
     */
    class SeleniumDataBus {
        async setup(driver) {
            sendMessageThroughChannel = (...a) => sendMessageToBrowser(driver, ...a);

            // Instantiate the sendMessageToNode and getFakeObservable functions on the other side
            const entries = Object.entries(this);

            /**
             * Now we reproduce the same object on the other side
             */
            await driver.executeScript(`
        let counter = 0;
        ${(sendMessageToNode.toString())}
        ${(getFakeObservable.toString())}            
        const sendMessageThroughChannel = sendMessageToNode;
        const entries = JSON.parse(arguments[0]);
        window.seleniumContext = {};
        for (let i = 0; i < entries.length; i++) {
            const {key, value} = entries[i];
            window.seleniumContext[key] = getFakeObservable(key, value);
        }
        `, JSON.stringify(
                entries.map(
                    ([key, fakeObservable]) =>
                        ({key, value: fakeObservable.value})
                )
            ));

            entries.forEach(([k, fakeObservable]) => {
                fakeObservable.subscribe((v, sendThroughChannel = true) => {
                    if (sendThroughChannel) {
                        sendMessageToBrowser(driver, k, v)
                    }
                })
            })

        }

        /**
         * @param driver {WebDriver}
         */
        constructor(driver) {
            /**
             * These are the properties of our communication bus
             */
            this.prop1 = getFakeObservable('prop1', 'prop1');
            this.prop2 = getFakeObservable('prop2', 1);
            this.prop3 = getFakeObservable('prop3', {test: new Date});
        }

    }

    return {
        SeleniumDataBus
    }
};
