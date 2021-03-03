import {connect, Contract, keyStores, WalletConnection} from 'near-api-js'
import getConfig from './config'

const nearConfig = getConfig(process.env.NODE_ENV || 'development')

// Initialize contract & set global variables
export async function initContract() {
    // Initialize connection to the NEAR testnet
    const near = await connect(Object.assign({deps: {keyStore: new keyStores.BrowserLocalStorageKeyStore()}}, nearConfig))

    // Initializing Wallet based Account. It can work with NEAR testnet wallet that
    // is hosted at https://wallet.testnet.near.org
    window.walletConnection = new WalletConnection(near)

    // Getting the Account ID. If still unauthorized, it's just empty string
    window.accountId = window.walletConnection.getAccountId()

    // Initializing our contract APIs by contract name and configuration
    window.contract = await new Contract(window.walletConnection.account(), nearConfig.contractName, {
        // View methods are read only. They don't modify the state, but usually return some value.
        viewMethods: [''],
        // Change methods can modify the state. But you don't receive the returned value when called.
        changeMethods: ['farm', 'airdrop'],
    })

    window.token_contracts = [];

    const methods = {
        viewMethods: ['get_allowance', 'get_balance'],
        changeMethods: ['inc_allowance'],
    };

    window.tokens = {
        "FTT": "722dd3f80bac40c951b51bdd28dd19d435762180",
        "FAU": "fab46e002bbf0b4509813474841e0716e6730136",
        "USDT": "bf4d811e6891ed044d245cafcc4caa96c969204d"
    };

    const AddContractWithPromise = async key => { //a function that returns a promise
        window.token_contracts[key] = await new Contract(
            window.walletConnection.account(),
            getContractAddress(window.tokens[key]), methods);
        return Promise.resolve('ok')
    };


    const AddContract = async key => {
        return AddContractWithPromise(key)
    }

    const setTokenContracts = async () => {
        return Promise.all(Object.keys(window.tokens).map(key => AddContract(key)))
    };

    await setTokenContracts().then(data => {
        console.log(window.token_contracts);
    })
}

export function getContractAddress(token_address) {
    return token_address + ".f290121.ropsten.testnet";
}

export function logout() {
    window.walletConnection.signOut()
    // reload page
    window.location.replace(window.location.origin + window.location.pathname)
}

export function login() {
    // Allow the current app to make calls to the specified contract on the
    // user's behalf.
    // This works by creating a new access key for the user's account and storing
    // the private key in localStorage.
    window.walletConnection.requestSignIn(nearConfig.contractName)
}
