import React, { useState, useEffect } from 'react'
import * as nearAPI from 'near-api-js';
import { get, set, del } from '../utils/storage'
import { contractName, createAccessKeyAccount, postJson } from '../utils/near-utils'

const LOCAL_APP_KEYS = '__LOCAL_APP_KEYS'
const {
    KeyPair
} = nearAPI;

import { signFetch } from '../state/near';

export const Keys = ({ near }) => {

    const [key, setKey] = useState()
    const [keys, setKeys] = useState([])


    useEffect(() => {
        if (!keys.length) loadAndCheckKeys()
    }, [])

    const loadAndCheckKeys = async () => {
        const keys = get(LOCAL_APP_KEYS, [])
        await Promise.all(keys.map(async (k) => {
            const isValid = await checkKey(KeyPair.fromString(k))
            if (!isValid) keys.splice(keys.indexOf(k), 1)
            set(LOCAL_APP_KEYS, keys)
        }))
        setKeys(keys)
    }

    const generateKey = () => {
        const keyPair = KeyPair.fromRandom('ed25519')
        setKey(keyPair)
    }

    const checkKey = async (key) => {
        const accessKeyAccount = createAccessKeyAccount(near, key)
        const result = await dispatch(signFetch(accessKeyAccount, 'http://localhost:3000/has-access-key'))
        return result && result.success
    }

    const addKey = async () => {
        const result = await postJson('http://localhost:3000/add-key', { publicKey: key.publicKey.toString() })
        if (result && result.success) {
            const isValid = await checkKey(key)
            if (isValid) {
                keys.push(key.toString())
                setKey(null)
                setKeys(keys)
                set(LOCAL_APP_KEYS, keys)
            } else {
                alert('key was not added')
            }
        } else {
            alert(result.error)
        }
    }

	return <>
        <h4>Add Keys</h4>
        <button onClick={() => generateKey()}>Generate Key</button>
        { key && <>
            <p>Key: {key.publicKey.toString()}</p>
            <button onClick={() => addKey()}>Add Key</button>
        </> }

        <h4>My Keys</h4>
        {
            keys.length > 0 ?
            keys.map((k) => {
                const keyPair = KeyPair.fromString(k)
                const publicKey = keyPair.publicKey.toString()
                return <div key={publicKey}>
                    <span style={{display: 'inline-block', margin: '4px 16px'}}>{ publicKey }</span>
                    <button onClick={async () => {
                        const isValid = await checkKey(keyPair)
                        if (isValid) alert('key exists on account ' + contractName)
                        else alert('key does not exist on account ' + contractName)
                    }}>Check Key</button>
                </div>
            }) :
            <p>You have no keys in localStorage</p>
        }

        <h4>Delete All Access Keys</h4>
        <button onClick={async () => {
            // WARNING NO RESTRICTION ON THIS ENDPOINT
            const result = await fetch('http://localhost:3000/delete-access-keys').then((res) => res.json())
            if (result && result.success) {
                setKeys([])
            }
        }}>Delete All Access Keys</button>

	</>;
};

