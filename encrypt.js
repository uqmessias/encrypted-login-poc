const crypto = require('crypto');
const { connectAsync, getSecretAsync, setSecretAsync } = require('./database');
const { generateKeyPairSync } = crypto;

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
  return generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: secret
    }
  });
}
/**
 * 
 * @param {{ data: string, lookAtMeNow: string }} preLoginCredentials
 * @returns {{ data: string, IAmLookingAtYou: string }} 
 */
async function getBackendKey({ data: mobileId, lookAtMeNow: clientPublicKey }) {
  if (!mobileId || !clientPublicKey) {
    throw new Error('The request body is invalid!');
  }

  const { publicKey, privateKey } = generateKeyPair(SECRET);
  const db = await connectAsync();
  try {
    await setSecretAsync(mobileId, privateKey);
  } catch (err) {
    throw err;
  } finally {
    db.close();
  }

  if (!publicKey) {
    throw new Error('The server configuration is invalid!');
  }

  const mobileIdHash = hasher(mobileId, publicKey);
  const cryptedHash = encryptToBase64(mobileIdHash, clientPublicKey);

  return {
    data: cryptedHash,
    IAmLookingAtYou: publicKey,
  };
}

/**
 * 
 * @param {{ id: string, data: string }} credentials
 * @returns {{ token: string }} 
 */
function getLoginToken({ id: mobileId, data: cryptedCredentials }) {
  let decryptedCredentials;

  const db = await connectAsync();
  let privateKey;

  try {
    const secret = await getSecretAsync(mobileId);
    privateKey = secret.data;
  } catch (err) {
    throw err;
  } finally {
    db.close();
  }

  if (!privateKey || !SECRET) {
    throw new Error('The server configuration is invalid!');
  }

  try {
    decryptedCredentials = decrypt(cryptedCredentials, privateKey, SECRET).toString();
  } finally { }

  const { login, password } = decryptedCredentials && JSON.parse(decryptedCredentials) || {};

  if (!!login && !!password) {
    const logonDataReversed = JSON.stringify({ login, password }).split('').reverse().join('');
    return {
      token: encryptPrivateToBase64(onlyOdds(logonDataReversed, privateKey), privateKey, SECRET),
    };
  }

  throw new Error('The request body is invalid!');
}

module.exports = { getBackendKey, getLoginToken };
