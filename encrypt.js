import crypto from 'crypto';
import keypair from 'keypair';

import { connectAsync, getSecretAsync, setSecretAsync } from './database';
const SECRET = process.env.My_PRIVATE_SECRET;

/**
 *
 * @param {string} strdddd
 * @returns {string}
 */
const onlyOdds = str => (
  str.split('')
    .filter((_, index) => (index % 2) !== 0)
    .join('')
);
/**
 * 
 * @param {string} id 
 * @param {string} publicKey 
 * @returns {string}
 */
const hasher = (id, publicKey) => {
  const hash = `${id}${onlyOdds(publicKey)}${publicKey}`;
  return crypto.createHash('sha256', hash)
    .update(hash)
    .digest('hex');
};

/**
 * 
 * @param {string} data 
 * @param {string} privateKey 
 * @param {string} secret 
 * @returns {Buffer}
 */
const decrypt = (data, privateKey, secret) => crypto.privateDecrypt({
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PADDING,
  passphrase: secret,
}, Buffer.from(data, 'base64'));

/**
 * 
 * @param {string} data 
 * @param {string} publicKey 
 * @returns {string}
 */
const encryptToBase64 = (data, publicKey) => crypto.publicEncrypt({
  key: publicKey,
  padding: crypto.constants.RSA_PKCS1_PADDING,
}, Buffer.from(data)).toString('base64');
/**
 * 
 * @param {string} data 
 * @param {string} privateKey 
 * @param {string} secret 
 * @returns {string}
 */
const encryptPrivateToBase64 = (data, privateKey, secret) => crypto.privateEncrypt({
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PADDING,
  passphrase: secret,
}, Buffer.from(data)).toString('base64');

/**
 * 
 * @param {string} secret
 * @returns {{ privateKey: string, publicKey: string }}
 */
function generateKeyPair(secret) {
  const { public: publicKey, private: privateKey } = keypair();
  return { publicKey, privateKey };
}

const ERROR_MESSAGE_CONFIG_INVALID = 'The server configuration is invalid!';
const ERROR_MESSAGE_BODY_INVALID = 'The request body is invalid!';
/**
 * 
 * @param {{ data: string, lookAtMeNow: string }} preLoginCredentials
 * @returns {{ data: string, IAmLookingAtYou: string }} 
 */
export async function getBackendKey({ data: mobileId, lookAtMeNow: clientPublicKey }) {
  if (!mobileId || !clientPublicKey) {
    throw new Error(ERROR_MESSAGE_BODY_INVALID);
  }

  const { publicKey, privateKey } = generateKeyPair(SECRET);
  try {
    await setSecretAsync(mobileId, privateKey);
  } catch (err) {
    throw err;
  }

  if (!publicKey) {
    throw new Error(ERROR_MESSAGE_CONFIG_INVALID);
  }

  const mobileIdHash = hasher(mobileId, publicKey);
  try {
    const cryptedHash = encryptToBase64(mobileIdHash, clientPublicKey);

    return {
      data: cryptedHash,
      IAmLookingAtYou: publicKey,
    };
  } catch (err) {
    console.error(`Error on trying to encrypt "${mobileIdHash}": ${err.message}`);
    throw new Error(ERROR_MESSAGE_BODY_INVALID);
  }
}

/**
 * 
 * @param {{ id: string, data: string }} credentials
 * @returns {{ token: string }} 
 */
export async function getLoginToken({ id: mobileId, data: cryptedCredentials }) {
  let decryptedCredentials;

  let privateKey;

  try {
    const secret = await getSecretAsync(mobileId);
    console.log({ secret })
    privateKey = secret.privateKey;
  } catch (err) {
    throw err;
  }

  if (!privateKey || !SECRET) {
    throw new Error(ERROR_MESSAGE_CONFIG_INVALID);
  }

  try {
    decryptedCredentials = decrypt(cryptedCredentials, privateKey, SECRET).toString();
  } catch (err) {
    console.error(`Error on trying to decrypt "${cryptedCredentials}": ${err.message}`);
    throw new Error(ERROR_MESSAGE_BODY_INVALID);
  }

  const { login, password } = decryptedCredentials && JSON.parse(decryptedCredentials) || {};

  if (!!login && !!password) {
    const logonDataReversed = JSON.stringify({ login, password }).split('').reverse().join('');
    console.warn('Login success!', { login, password });
    return {
      token: encryptPrivateToBase64(onlyOdds(logonDataReversed, privateKey), privateKey, SECRET),
    };
  }

  throw new Error(ERROR_MESSAGE_BODY_INVALID);
}
