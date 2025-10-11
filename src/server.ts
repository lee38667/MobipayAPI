import app from './index';
import { config } from './config';

const port = config.port;
app.listen(port, () => {
  console.log(`Mobipay API listening on port ${port}`);
});
