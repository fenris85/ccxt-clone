'use strict';

//  ---------------------------------------------------------------------------

const okex = require ('./okex.js');

// ---------------------------------------------------------------------------

module.exports = class okcoin extends okex {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'okcoin',
            'name': 'OKCoin',
            'countries': [ 'CN', 'US' ],
            'hostname': 'okcoin.com',
            'pro': true,
            'urls': {
                'api': {
                    'ws': 'wss://real.okcoin.com:8443/ws/v3',
                },
                'logo': 'https://user-images.githubusercontent.com/1294454/27766791-89ffb502-5ee5-11e7-8a5b-c5950b68ac65.jpg',
                'www': 'https://www.okcoin.com',
                'doc': 'https://www.okcoin.com/docs/en/',
                'fees': 'https://www.okcoin.com/coin-fees',
                'referral': 'https://www.okcoin.com/account/register?flag=activity&channelId=600001513',
            },
            'fees': {
                'trading': {
                    'taker': 0.002,
                    'maker': 0.001,
                },
            },
            'options': {
                'fetchMarkets': [ 'spot' ],
            },
        });
    }
};
