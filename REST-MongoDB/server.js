const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// Connexion à MongoDB et exécution des opérations asynchrones
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

  // Mise à jour d'un document
  const updateResult = await collection.updateOne({ a: 3 }, { $set: { b: 1 } });
  console.log('Updated documents =>', updateResult);

  // Suppression d'un document
  const deleteResult = await collection.deleteMany({ a: 3 });
  console.log('Deleted documents =>', deleteResult);

  // Création d'un index sur le champ a
  const indexName = await collection.createIndex({ a: 1 });
  console.log('Index name =', indexName);

  // Lancement du serveur
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
}).catch(error => {
  console.error("Erreur de connexion à MongoDB :", error);
});
