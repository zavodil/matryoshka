import 'regenerator-runtime/runtime'
import React from 'react'
import {login, logout, getContractAddress} from './utils'
import './global.css'
import {utils} from 'near-api-js'
import {BN} from 'bn.js'
import Dropdown from 'react-dropdown';
import 'react-dropdown/style.css';

import matreshka from './assets/matreshka.png';
import {useWindowSize, useTimeout} from 'react-use'
import Confetti from 'react-confetti'

import getConfig from './config'

const {networkId, contractName} = getConfig(process.env.NODE_ENV || 'development')
const MAX_ALLOWANCE = "340282366920938463463374607431768211455";
const FRAC_DIGITS = 5;

function ConvertToYoctoNear(amount) {
    return new BN(Math.round(amount * 100000000)).mul(new BN("10000000000000000")).toString();
}

export default function App() {
    // use React Hooks to store greeting in component state
    const [greeting, set_greeting] = React.useState()

    const [tokenBalance, setTokenBalance] = React.useState(0)
    const [token, setToken] = React.useState("FTT")
    const [allowance, setAllowance] = React.useState(0);

    const [showAllowance, setShowAllowance] = React.useState(false);
    const [showActionButton, setShowActionButton] = React.useState(true);

    const [showConfetti, setShowConfetti] = React.useState(false);

    // when the user has not yet interacted with the form, disable the button
    const [buttonDisabled, setButtonDisabled] = React.useState(true)

    // after submitting the form, we want to show Notification
    const [showNotification, setShowNotification] = React.useState(false)

    // The useEffect hook can be used to fire side-effects during render
    // Learn more: https://reactjs.org/docs/hooks-intro.html
    React.useEffect(
        async () => {
            // in this case, we only care to query the contract when signed in
            if (window.walletConnection.isSignedIn()) {

                await get_balance(token);
                await get_allowance(token);


            }
        },

        // The second argument to useEffect tells React when to re-run the effect
        // Use an empty array to specify "only run on first render"
        // This works because signing into NEAR Wallet reloads the page
        []
    )

    // if not signed in, return early with sign-in prompt
    if (!window.walletConnection.isSignedIn()) {
        return (
            <main>
                <h1>Welcome to NEAR!</h1>
                <p>
                    To make use of the NEAR blockchain, you need to sign in. The button
                    below will sign you in using NEAR Wallet.
                </p>
                <p>
                    By default, when your app runs in "development" mode, it connects
                    to a test network ("testnet") wallet. This works just like the main
                    network ("mainnet") wallet, but the NEAR Tokens on testnet aren't
                    convertible to other currencies – they're just for testing!
                </p>
                <p>
                    Go ahead and click the button below to try it out:
                </p>
                <p style={{textAlign: 'center', marginTop: '2.5em'}}>
                    <button onClick={login}>Sign in</button>
                </p>
            </main>
        )
    }

    const dropdownOptions = Object.keys(window.tokens);

    const get_balance = (token) => {
        window.token_contracts[token].get_balance({
            owner_id: window.accountId
        })
            .then(balance => {
                const balance_data = JSON.parse(window.localStorage.getItem('balance'));

                if (balance_data && balance_data.hasOwnProperty("user") && balance_data.hasOwnProperty("balance") && balance_data.balance > 0) {
                    if (balance_data.user === window.accountId && new BN(balance) > new BN(balance_data.balance)) {
                        console.log("Farming!");
                        setShowConfetti(true);
                    }
                }

                setTokenBalance(balance);
                SaveAccountsToLocalStorage({user: window.accountId, balance: balance});
            });

        setToken(token);
    }

    const get_allowance = (token) => {
        window.token_contracts[token].get_allowance({
            owner_id: window.accountId,
            escrow_account_id: contractName
        })
            .then(allowance => {
                console.log(`User allowance [${window.accountId}] for ${token} at ${contractName}: ${allowance}`);
                setAllowance(allowance)
                setShowActionButton(allowance > 0)
                setShowAllowance(allowance == 0)
            })
    }

    const ChangeToken = async (token) => {
        await get_balance(token);
        await get_allowance(token)
    };


    const AllowanceButton = () => {
        return showAllowance ?
            <button
                style={{width: '200px'}}
                onClick={async event => {
                    event.preventDefault()
                    try {
                        const tokensToAttach = ConvertToYoctoNear(0.04);
                        // make an update call to the smart contract
                        await window.token_contracts[token].inc_allowance({
                            escrow_account_id: contractName,
                            amount: new BN(MAX_ALLOWANCE).toString()
                        }, 300000000000000, tokensToAttach)
                            .then(allowance => {
                                console.log(allowance)
                            })

                    } catch (e) {
                        ContractCallAlert();
                        throw e
                    }

                    setShowNotification({method: "call", data: "withdraw"})

                    setTimeout(() => {
                        setShowNotification(false)
                    }, 11000)


                }}
            >
                Set Allowance
            </button>
            : null;
    }

    const ActionButton = () => {
        return showActionButton ?
            <button
                disabled={buttonDisabled}
                style={{borderRadius: '0 5px 5px 0'}}
                onClick={async event => {
                    event.preventDefault()

                    // get elements from the form using their id attribute
                    //const {fieldset, greeting} = event.target.elements

                    // hold onto new user-entered value from React's SynthenticEvent for use after `await` call
                    //const newGreeting = greeting.value

                    // disable the form while the value gets updated on-chain
                    //fieldset.disabled = true

                    try {
                        // make an update call to the smart contract
                        const tokens_attached = tokenBalance > 0 ? 0 : ConvertToYoctoNear(0.04);
                        await window.contract.farm({
                            // pass the value that the user entered in the greeting field
                            amount: tokenBalance,
                            contract_address: getContractAddress(window.tokens[token])
                        }, 300000000000000, tokens_attached)
                    } catch (e) {
                        alert(
                            'Something went wrong! ' +
                            'Maybe you need to sign out and back in? ' +
                            'Check your browser console for more info.'
                        )
                        throw e
                    } finally {
                        // re-enable the form, whether the call succeeded or failed
                        //fieldset.disabled = false
                        await get_balance(token);
                    }

                    // update local `greeting` variable to match persisted value
                    // set_greeting(newGreeting)


                    // show Notification
                    setShowNotification(true)

                    // remove Notification again after css animation completes
                    // this allows it to be shown again next time the form is submitted
                    setTimeout(() => {
                        setShowNotification(false)
                    }, 11000)
                }}
            >
                Farm
            </button>
            : null;
    }

    const {width, height} = useWindowSize()

    const FarmingAlert = () => {
        return showConfetti ?
            <Confetti
                width={width}
                height={height}
                recycle={false}
                numberOfPieces={500}
            /> : null;
    }

    return (
        // use React Fragment, <>, to avoid wrapping elements in unnecessary divs
        <>

            <FarmingAlert/>

            <button className="link" style={{float: 'right'}} onClick={logout}>
                Sign out
            </button>
            <main>
                <img src={matreshka} width={649} height={290}/>

                <form>
                    <fieldset id="fieldset">
                        <label
                            htmlFor="greeting"
                            style={{
                                display: 'block',
                                color: 'var(--gray)',
                                marginBottom: '0.5em'
                            }}
                        >
                            Martryoshka Yield Farming
                        </label>
                        <div style={{display: 'flex'}}>

                            <Dropdown
                                options={dropdownOptions}
                                onChange={e => ChangeToken(e.value)}
                                value={dropdownOptions[0]}
                                placeholder="Select an option"/>

                            <input
                                autoComplete="off"
                                autoFocus
                                value={tokenBalance}
                                onChange={e => {
                                    setTokenBalance(e.target.value);
                                    setButtonDisabled(!(parseFloat(e.target.value) > 0));
                                }}
                                id="balance"
                                style={{flex: 1}}
                            />
                            <AllowanceButton/>
                            <ActionButton/>

                        </div>
                    </fieldset>
                </form>
                <p>
                    Pure YIELD FARMING! Accelerate your bridged tokens farming with Matryoshka.
                </p>
                <p>
                    Hurry up! Matryoshka farming pool is limited.
                </p>
            </main>
            {showNotification && <Notification/>}
        </>
    )
}

function SaveAccountsToLocalStorage(balance) {
    window.localStorage.setItem('balance', balance ? JSON.stringify(balance) : "{}");
}

// this component gets rendered by App after the form is submitted
function Notification() {
    const urlPrefix = `https://explorer.${networkId}.near.org/accounts`
    return (
        <aside>
            <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.accountId}`}>
                {window.accountId}
            </a>
            {' '/* React trims whitespace around tags; insert literal space character when needed */}
            called method: 'set_greeting' in contract:
            {' '}
            <a target="_blank" rel="noreferrer" href={`${urlPrefix}/${window.contract.contractId}`}>
                {window.contract.contractId}
            </a>
            <footer>
                <div>✔ Succeeded</div>
                <div>Just now</div>
            </footer>
        </aside>
    )
}
