// @ts-check
const express = require('express');
const bodyParser = require('body-parser');

const { getBackendKey, getLoginToken } = require('./encrypt');

const app = express();

app.use(bodyParser.json());

const handleError = (fn, res) => {
  try {
    fn();
  } catch (e) {
    res.status(400);
    res.json({ error: e.message });
  }
};

app.post('/let-me-in', (req, res) => {
  handleError(() => {
    const backendKey = getBackendKey(req.body || {});
    res.json(backendKey);
  }, res);
});
app.post('/login', async (req, res) => {
  handleError(() => {
    const { token } = getLoginToken(req.body || {});
    res.json({ token });
  }, res);
});

// @ts-ignore
app.listen();
