// @ts-check
import express from 'express';
import bodyParser from 'body-parser';

import { getBackendKey, getLoginToken } from './encrypt';

const app = express();

app.use(bodyParser.json());

const handleError = async (fn, res) => {
  try {
    await fn();
  } catch (e) {
    console.error({ error: e })
    res.status(400);
    res.json({ error: e.message });
  }
};

app.post('/let-me-in', async (req, res) => {
  handleError(async () => {
    console.log({ body: req.body })
    const backendKey = await getBackendKey(req.body || {});
    res.json(backendKey);
  }, res);
});
app.post('/login', async (req, res) => {
  handleError(async () => {
    console.log({ body: req.body })
    const { token } = await getLoginToken(req.body || {});
    res.json({ token });
  }, res);
});

// @ts-ignore
app.listen();
