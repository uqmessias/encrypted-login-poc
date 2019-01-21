const crypto = require('crypto');
const { generateKeyPairSync } = crypto;

const secret = process.env.My_PRIVATE_SECRET;
const privateKey = process.env.My_PRIVATE_KEY && Buffer.from(process.env.My_PRIVATE_KEY, 'base64').toString();
const publicKey = process.env.My_PUBLIC_KEY && Buffer.from(process.env.My_PUBLIC_KEY, 'base64').toString();

/**
 *
 * @param {string} str
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
 * @param {{ data: string, lookAtMeNow: string }} preLoginCredentials
 * @returns {{ data: string, IAmLookingAtYou: string }} 
 */
function getBackendKey({ data: mobileId, lookAtMeNow: clientPublicKey }) {
  if (!mobileId || !clientPublicKey) {
    throw new Error('The request body is invalid!');
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
 * @param {{ data: string }} credentials
 * @returns {{ token: string }} 
 */
function getLoginToken({ data: cryptedCredentials }) {
  let decryptedCredentials;

  if (!privateKey || !secret) {
    throw new Error('The server configuration is invalid!');
  }

  try {
    decryptedCredentials = decrypt(cryptedCredentials, privateKey, secret).toString();
  } finally { }

  const { login, password } = decryptedCredentials && JSON.parse(decryptedCredentials) || {};

  if (!!login && !!password) {
    return {
      token: encryptToBase64(onlyOdds(JSON.stringify({ login, password })), publicKey),
    };
  }

  throw new Error('The request body is invalid!');
}

module.exports = { getBackendKey, getLoginToken };
