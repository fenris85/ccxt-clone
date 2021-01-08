'use strict'

// ----------------------------------------------------------------------------

const log = require ('ololog')
    , chai = require ('chai')
    , asTable = require ('as-table')
    , assert = chai.assert
    , testOrder = require ('ccxt/js/test/Exchange/test.order.js')
    , errors = require ('ccxt/js/base/errors.js')

/*  ------------------------------------------------------------------------ */

module.exports = async (exchange, symbol) => {

    // log (symbol.green, 'watching orders...')

    const method = 'watchOrders'

    if (!exchange.has[method]) {
        log (exchange.id, 'does not support', method + '() method')
        return
    }

    let response = undefined

    let now = Date.now ()
    const ends = now + 15000

    while (now < ends) {

        try {

            response = await exchange[method] (symbol)

            now = Date.now ()

            assert (response instanceof Array)

            log (exchange.iso8601 (now), exchange.id, symbol.green, method, Object.values (response).length.toString ().green, 'orders')

            // log.noLocate (asTable (response))

            for (let i = 0; i < response.length; i++) {
                const order = response[i]
                testOrder (exchange, order, symbol, now)
                if (i > 0) {
                    const previousOrder = response[i - 1]
                    if (order.timestamp && previousOrder.timestamp) {
                        assert (order.timestamp >= previousOrder.timestamp)
                    }
                }
            }
        } catch (e) {

            if (!(e instanceof errors.NetworkError)) {
                throw e
            }

            now = Date.now ()
        }
    }

    return response
}
