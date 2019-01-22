// @ts-check
import express from 'express';
import bodyParser from 'body-parser';

import { getBackendKey, getLoginToken } from './encrypt';

const app = express();

app.use(bodyParser.json());

const handleError = (fn, res) => {
  try {
    fn();
  } catch (e) {
    console.error({ error: e })
    res.status(400);
    res.json({ error: e.message });
  }
};

app.post('/let-me-in', (req, res) => {
  handleError(() => {
    console.log({ body: req.body })
    const backendKey = getBackendKey(req.body || {});
    res.json(backendKey);
  }, res);
});
app.post('/login', async (req, res) => {
  handleError(() => {
    console.log({ body: req.body })
    const { token } = getLoginToken(req.body || {});
    res.json({ token });
  }, res);
});

// @ts-ignore
app.listen();
