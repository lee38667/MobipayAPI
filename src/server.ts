import app from './index';

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Mobipay API listening on port ${port}`);
});
