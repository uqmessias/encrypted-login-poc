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
  privateKey: String,
});
const SecretModel = mongoose.model("secrets", SecretSchema);

export function getSecretAsync(deviceId) {
  return new Promise(async resolve => {

    const db = await connectAsync();
    try {
      SecretModel.findOne({ deviceId }, async (err, secretDocument) => {
        if (!err && !!secretDocument) {
          console.error("secret found", { secretDocument, err });
          db.close();
          resolve(secretDocument);
          return;
        }

        console.error("secret not found", { deviceId, err });
        throw err;
      });
    } catch (err) {
      db.close();
      throw err;
    }
  });
}

export async function setSecretAsync(deviceId, privateKey) {
  return new Promise(async resolve => {
    const db = await connectAsync();
    let updateResult;

    try {
      updateResult = await db
        .collection('secrets')
        .updateOne(
          { deviceId },
          { $set: { privateKey } },
          { upsert: true },
        );
    } catch (err) {
      console.error("secret not saved", { deviceId, err });
      throw err;
    }
    finally {
      db.close();
    }
    console.log('setSecretAsync', { updateResult });
    resolve(updateResult);
  });
}
