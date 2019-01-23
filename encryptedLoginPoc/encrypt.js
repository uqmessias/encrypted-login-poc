// @ts-check
import { RSA } from 'react-native-rsa-native';
import { sha256 } from 'react-native-sha256';

const url = 'https://encrypted-login-poc-7db29bkq2.now.sh';
const letMeInPath = '/let-me-in';
const loginPath = '/login';

/**
 * 
 * @param {string} hostname 
 * @param {string | undefined} path 
 * @param {any} body 
 * @returns {any}
 */
const post = async (hostname, path, body) => {
  const fullUrl = `${hostname}${path || ''}`;
  const requestBody = {
    body: JSON.stringify(body).replace(/\\\\n/g, '\\n'),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  };
  const response = await fetch(fullUrl, requestBody);
  return response.ok ? response.json() : null;
};

/**
 *
 * @param {string} str
 * @returns {string}
 */
const onlyOdds = (str) =>
  str
    .split('')
    .filter((_, index) => index % 2 !== 0)
    .join('');

/**
 * 
 * @param {string} deviceId 
 * @param {string} publicKey 
 * @returns {string}
 */
const hasher = async (deviceId, publicKey) => {
  const hash = `${deviceId}${onlyOdds(publicKey)}${publicKey}`;
  const hashed = await sha256(hash);

  return hashed;
};

/**
 * @returns {string} Generated id in hex
 */
const generateNewId = () => Array.from(new Array(4))
  .map((_, index) => (new Date().getTime() + index).toString(16))
  .join('');

/**
 * @returns {{ privateKey: string, publicKey: string }} Public and Private RSA key
 */
const generateKeyPair = async () => {
  const keys = await RSA.generateKeys(2048);

  return {
    privateKey: keys.private,
    publicKey: keys.public,
  };
};

/**
 * 
 * @param {string} data 
 * @param {string} privateKey 
 * @returns {string}
 */
const decrypt = async (data, privateKey) => {
  const decrypted = await RSA.decrypt(data, privateKey);
  return decrypted;
};

/**
 * 
 * @param {string} data 
 * @param {string} publicKey 
 * @returns {string}
 */
const encryptToBase64 = async (data, publicKey) => {
  const encryptedData = await RSA.encrypt(data, publicKey);
  return encryptedData;
};

/**
 * 
 * @param {string} cryptedHash 
 * @param {string} deviceId 
 * @param {string} hashPublicKey 
 * @param {string} privateKey
 * @returns {boolean} 
 */
const areHashesTheSame = async (cryptedHash, deviceId, hashPublicKey, privateKey) => {
  const clientHash = await hasher(deviceId, hashPublicKey);
  const decryptedBackHash = await decrypt(cryptedHash, privateKey);
  const encryptedBackHash = await encryptToBase64(
    decryptedBackHash,
    hashPublicKey,
  );

  return decryptedBackHash === clientHash;
};

/**
 * 
 * @param {string} login 
 * @param {string} password 
 * @param {{ (string) => void }} logHandler 
 * @param {{ (string) => void }} warnHandler 
 */
export const doLoginAsync = async (login, password, logHandler, warnHandler, omitData) => {
  logHandler('Generating keys...');
  const {
    publicKey: clientPublicKey,
    privateKey: clientPrivateKey,
  } = await generateKeyPair();

  logHandler('Keys generetated');
  logHandler('Generating id...');
  const id = generateNewId();
  logHandler('Id generetated ({sensible})...', id);

  const letMeInbody = { data: id, lookAtMeNow: clientPublicKey };
  logHandler('Calling "/let-me-in" service ({sensible})', JSON.stringify(letMeInbody));
  let backendKey;
  try {
    backendKey = await post(url, letMeInPath, letMeInbody);
  } catch (err) {
    throw new Error(`Something went wrong on calling "/let-me-in" service (${err.message})...`);
  }

  warnHandler('Service "/let-me-in" returned successfully ({sensible})', JSON.stringify(backendKey));

  logHandler('Checking if there is not any man in the middle or if the token was invalidated');
  const areTheSame = await areHashesTheSame(
    backendKey.data,
    id,
    backendKey.IAmLookingAtYou,
    clientPrivateKey,
  );

  if (!areTheSame) {
    throw new Error('The hashes are different from each other');
  }

  warnHandler('The hashes are the same');

  const loginAndPassword = JSON.stringify({ login, password });
  warnHandler('{sensible}', `Encrypting login and password (${loginAndPassword})`);

  const cryptedCredentials = await encryptToBase64(
    loginAndPassword,
    backendKey.IAmLookingAtYou,
  );

  const loginBody = { id, data: cryptedCredentials };
  logHandler('Calling "/login" service ({sensible})', JSON.stringify(loginBody));
  let loginResponse;

  try {
    loginResponse = await post(url, loginPath, loginBody);
  } catch (err) {
    throw new Error(`Something went wrong on calling "/login" service (${err.message})...`);
  }

  warnHandler('Service "/login" returned successfully ({sensible})', JSON.stringify(loginResponse));
  const { token } = loginResponse;
  warnHandler('Token returned "{sensible}"', token);

  const withSpecialCharacteres = (phrase: string) =>
    phrase.replace(/\n/g, '\\n');

  const apiContract = `\`\`\`
    >> POST domain/let-me-in
    {
      "data": "${id}",
      "lookAtMeNow": "${withSpecialCharacteres(clientPublicKey)}"
    }
    << Response HTTP 200
    {
      "data": "${withSpecialCharacteres(backendKey.data)}",
      "IAmLookingAtYou": "${withSpecialCharacteres(backendKey.IAmLookingAtYou)}"
    }
    \`\`\`
    
    \`\`\`
    >> POST domain/login
    {
      "id": "${id}",
      "data": "${withSpecialCharacteres(cryptedCredentials)}"
    }
    << Response  HTTP 200
    {
      "token": "${withSpecialCharacteres(token || '')}"
    }
    \`\`\`
    `;

  return apiContract;
};
