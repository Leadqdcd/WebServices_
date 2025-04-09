const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// Connexion à MongoDB
client.connect().then(async () => {
  db = client.db("myDB");
  const collection = db.collection("documents");

  // Insertion de documents
  const insertResult = await collection.insertMany([{ a: 1 }, { a: 2 }, { a: 3 }]);
  console.log('Inserted documents =>', insertResult);

  // Récupération de tous les documents
  const findResult = await collection.find({}).toArray();
  console.log('Found documents =>', findResult);

  // Récupération des documents filtrés
  const filteredDocs = await collection.find({ a: 3 }).toArray();
  console.log('Found documents filtered by { a: 3 } =>', filteredDocs);

  // Lancement du serveur
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
});
