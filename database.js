import mongoose from 'mongoose';

function connectAsync() {
  return new Promise(resolve => {
    if (!process.env.MONGODB_URL)
      throw new Error('There\'s no database URL connection available');

    mongoose.connect(process.env.MONGODB_URL, err => {
      if (!!err) {
        console.error("connection failure", err);
        throw err;
      }

      console.log("connected to database");
      resolve(mongoose.connection);
    });
  });
}

const SecretSchema = new mongoose.Schema({
  deviceId: String,
  data: String,
});
const SecretModel = mongoose.model("secrets", SecretSchema);

function getSecretAsync(deviceId: string) {
  return new Promise(resolve =>
    SecretModel.findOne({ deviceId }, async (err, secretDocument) => {
      if (!err && !!secretDocument) {
        console.error("secret found", { secretDocument, err });
        resolve(secretDocument);
        return;
      }

      console.error("brand not found", { deviceId, err });
      resolve(null);
    }));
}

async function setSecretAsync(deviceId, privateKey) {
  return new Promise(async resolve => {
    const secretModel = new SecretModel({ deviceId, data: privateKey });
    const brandItem = await secretModel.save();
    resolve(brandItem);
  });
}

module.exports = {
  connectAsync,
  getSecretAsync,
  setSecretAsync,
};
