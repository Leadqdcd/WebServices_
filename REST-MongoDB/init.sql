// All other imports here.
const { MongoClient } = require("mongodb");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// Product Schema + Product Route here.

// Init mongodb client connection
client.connect().then(() => {
  // Select db to use in mongodb
  db = client.db("myDB");
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});
