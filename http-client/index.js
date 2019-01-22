const crypto = require('crypto');
const https = require("https");
const { generateKeyPairSync } = crypto;

const SECRET = 'Eu sou demais, você também';
const url = 'encrypted-login-poc-23im34m6a.now.sh';
const letMeInPath = '/let-me-in';
const loginPath = '/login';

async function post(hostname, path, body) {
  return new Promise(resolve => {
    const htttpsOptions = {
      method: 'POST',
      hostname,
      path,
      headers: {
        "content-type": 'application/json'
      }
    };

    var req = https.request(htttpsOptions, res => {
      var responseChunks = [];

      res.on('data', function (chunk) {
        responseChunks.push(chunk);
      });

      res.on('end', function () {
        const responseBody = Buffer.concat(responseChunks);
        resolve(JSON.parse(responseBody.toString().replace(/\\\\n/g, '\\n')));
      });
    });
    const requestBody = JSON.stringify(body).replace(/\\\\n/g, '\\n');
    req.write(requestBody);
    req.end();
  });
}

/**
 *
 * @param {string} str
 */
const onlyOdds = str => (
  str.split('')
    .filter((_, index) => (index % 2) !== 0)
    .join('')
);
const hasher = (id, publicKey) => {

  const hash = `${id}${onlyOdds(publicKey)}${publicKey}`;

  return crypto.createHash('sha256', hash)
    .update(hash)
    .digest('hex');
};

const idGenerator = () => Array.from(new Array(4))
  .map((_, index) => (new Date().getTime() + index).toString(16))
  .join('');

const decrypt = (data, privateKey, secret) => crypto.privateDecrypt({
  key: privateKey,
  padding: crypto.constants.RSA_PKCS1_PADDING,
  passphrase: secret,
}, Buffer.from(data, 'base64'));

const encryptToBase64 = (data, publicKey) => crypto.publicEncrypt({
  key: publicKey,
  padding: crypto.constants.RSA_PKCS1_PADDING,
}, Buffer.from(data)).toString('base64');

const areHashesTheSame = (cryptedHash, deviceId, hashPublicKey, privateKey, secret) => {
  const clientHash = hasher(deviceId, hashPublicKey);
  const decryptedBackHash = decrypt(cryptedHash, privateKey, secret).toString();

  return decryptedBackHash === clientHash
};

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

async function doTheMagic() {
  const { publicKey: clientPublicKey, privateKey: clientPrivateKey } = generateKeyPair(SECRET);

  const id = idGenerator();
  const letMeInbody = { data: id, lookAtMeNow: clientPublicKey };
  const backendKey = await post(url, letMeInPath, letMeInbody);
  console.log({ backendKey })

  if (!areHashesTheSame(backendKey.data, id, backendKey.IAmLookingAtYou, clientPrivateKey, SECRET)) {
    throw new Error('The hashes are different from each other!');
  }

  const login = 'My super secret login';
  const password = 'my super secret password';
  const loginAndPassword = JSON.stringify({ login, password });
  const cryptedCredentials = encryptToBase64(loginAndPassword, backendKey.IAmLookingAtYou);

  const { token } = await post(url, loginPath, { id, data: cryptedCredentials });

  const withSpecialCharacteres = phrase => phrase.replace(/\n/g, '\\n');

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
  "token": "${withSpecialCharacteres(token)}"
}
\`\`\`
`;

  console.log(apiContract);
}

doTheMagic();
