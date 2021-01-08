'use strict';

//  ---------------------------------------------------------------------------

const ccxt = require ('ccxt');
const { ArrayCache } = require ('./base/Cache');

//  ---------------------------------------------------------------------------

module.exports = class upbit extends ccxt.upbit {
    describe () {
        return this.deepExtend (super.describe (), {
            'has': {
                'ws': true,
                'watchOrderBook': true,
                'watchTicker': true,
                'watchTrades': true,
            },
            'urls': {
                'api': {
                    'ws': 'wss://api.upbit.com/websocket/v1',
                },
            },
            'options': {
                'tradesLimit': 1000,
            },
        });
    }

    async watchPublic (symbol, channel, params = {}) {
        await this.loadMarkets ();
        const market = this.market (symbol);
        const marketId = market['id'];
        const url = this.urls['api']['ws'];
        const request = [
            {
                'ticket': this.uuid (),
            },
            {
                'type': channel,
                'codes': [ marketId ],
                // 'isOnlySnapshot': false,
                // 'isOnlyRealtime': false,
            },
        ];
        const messageHash = channel + ':' + marketId;
        return await this.watch (url, messageHash, request, messageHash);
    }

    async watchTicker (symbol, params = {}) {
        return await this.watchPublic (symbol, 'ticker');
    }

    async watchTrades (symbol, since = undefined, limit = undefined, params = {}) {
        const future = this.watchPublic (symbol, 'trade');
        return await this.after (future, this.filterBySinceLimit, since, limit, true);
    }

    async watchOrderBook (symbol, limit = undefined, params = {}) {
        const future = this.watchPublic (symbol, 'orderbook');
        return await this.after (future, this.limitOrderBook, symbol, limit, params);
    }

    handleTicker (client, message) {
        // 2020-03-17T23:07:36.511Z 'onMessage' <Buffer 7b 22 74 79 70 65 22 3a 22 74 69 63 6b 65 72 22 2c 22 63 6f 64 65 22 3a 22 42 54 43 2d 45 54 48 22 2c 22 6f 70 65 6e 69 6e 67 5f 70 72 69 63 65 22 3a ... >
        // { type: 'ticker',
        //   code: 'BTC-ETH',
        //   opening_price: 0.02295092,
        //   high_price: 0.02295092,
        //   low_price: 0.02161249,
        //   trade_price: 0.02161249,
        //   prev_closing_price: 0.02185802,
        //   acc_trade_price: 2.32732482,
        //   change: 'FALL',
        //   change_price: 0.00024553,
        //   signed_change_price: -0.00024553,
        //   change_rate: 0.0112329479,
        //   signed_change_rate: -0.0112329479,
        //   ask_bid: 'ASK',
        //   trade_volume: 2.12,
        //   acc_trade_volume: 106.11798418,
        //   trade_date: '20200317',
        //   trade_time: '215843',
        //   trade_timestamp: 1584482323000,
        //   acc_ask_volume: 90.16935908,
        //   acc_bid_volume: 15.9486251,
        //   highest_52_week_price: 0.03537414,
        //   highest_52_week_date: '2019-04-08',
        //   lowest_52_week_price: 0.01614901,
        //   lowest_52_week_date: '2019-09-06',
        //   trade_status: null,
        //   market_state: 'ACTIVE',
        //   market_state_for_ios: null,
        //   is_trading_suspended: false,
        //   delisting_date: null,
        //   market_warning: 'NONE',
        //   timestamp: 1584482323378,
        //   acc_trade_price_24h: 2.5955306323568927,
        //   acc_trade_volume_24h: 118.38798416,
        //   stream_type: 'SNAPSHOT' }
        const marketId = this.safeString (message, 'code');
        const messageHash = 'ticker:' + marketId;
        const ticker = this.parseTicker (message);
        const symbol = ticker['symbol'];
        this.tickers[symbol] = ticker;
        client.resolve (ticker, messageHash);
    }

    handleOrderBook (client, message) {
        // { type: 'orderbook',
        //   code: 'BTC-ETH',
        //   timestamp: 1584486737444,
        //   total_ask_size: 16.76384456,
        //   total_bid_size: 168.9020623,
        //   orderbook_units:
        //    [ { ask_price: 0.02295077,
        //        bid_price: 0.02161249,
        //        ask_size: 3.57100696,
        //        bid_size: 22.5303265 },
        //      { ask_price: 0.02295078,
        //        bid_price: 0.02152658,
        //        ask_size: 0.52451651,
        //        bid_size: 2.30355128 },
        //      { ask_price: 0.02295086,
        //        bid_price: 0.02150802,
        //        ask_size: 1.585,
        //        bid_size: 5 }, ... ],
        //   stream_type: 'SNAPSHOT' }
        const marketId = this.safeString (message, 'code');
        const symbol = this.safeSymbol (marketId, undefined, '-');
        const type = this.safeString (message, 'stream_type');
        const options = this.safeValue (this.options, 'watchOrderBook', {});
        const limit = this.safeInteger (options, 'limit', 15);
        if (type === 'SNAPSHOT') {
            this.orderbooks[symbol] = this.orderBook ({}, limit);
        }
        const orderBook = this.orderbooks[symbol];
        // upbit always returns a snapshot of 15 topmost entries
        // the "REALTIME" deltas are not incremental
        // therefore we reset the orderbook on each update
        // and reinitialize it again with new bidasks
        orderBook.reset ({});
        const bids = orderBook['bids'];
        const asks = orderBook['asks'];
        const data = this.safeValue (message, 'orderbook_units', []);
        for (let i = 0; i < data.length; i++) {
            const entry = data[i];
            const ask_price = this.safeFloat (entry, 'ask_price');
            const ask_size = this.safeFloat (entry, 'ask_size');
            const bid_price = this.safeFloat (entry, 'bid_price');
            const bid_size = this.safeFloat (entry, 'bid_size');
            asks.store (ask_price, ask_size);
            bids.store (bid_price, bid_size);
        }
        const timestamp = this.safeInteger (message, 'timestamp');
        const datetime = this.iso8601 (timestamp);
        orderBook['timestamp'] = timestamp;
        orderBook['datetime'] = datetime;
        const messageHash = 'orderbook:' + marketId;
        client.resolve (orderBook, messageHash);
    }

    handleTrades (client, message) {
        // { type: 'trade',
        //   code: 'KRW-BTC',
        //   timestamp: 1584508285812,
        //   trade_date: '2020-03-18',
        //   trade_time: '05:11:25',
        //   trade_timestamp: 1584508285000,
        //   trade_price: 6747000,
        //   trade_volume: 0.06499468,
        //   ask_bid: 'ASK',
        //   prev_closing_price: 6774000,
        //   change: 'FALL',
        //   change_price: 27000,
        //   sequential_id: 1584508285000002,
        //   stream_type: 'REALTIME' }
        const trade = this.parseTrade (message);
        const symbol = trade['symbol'];
        let stored = this.safeValue (this.trades, symbol);
        if (stored === undefined) {
            const limit = this.safeInteger (this.options, 'tradesLimit', 1000);
            stored = new ArrayCache (limit);
            this.trades[symbol] = stored;
        }
        stored.append (trade);
        const marketId = this.safeString (message, 'code');
        const messageHash = 'trade:' + marketId;
        client.resolve (stored, messageHash);
    }

    handleMessage (client, message) {
        const methods = {
            'ticker': this.handleTicker,
            'orderbook': this.handleOrderBook,
            'trade': this.handleTrades,
        };
        const methodName = this.safeString (message, 'type');
        const method = this.safeValue (methods, methodName);
        if (method) {
            method.call (this, client, message);
        }
    }
};
