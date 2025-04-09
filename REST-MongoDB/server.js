const express = require("express");
const { MongoClient } = require("mongodb");
const { z } = require("zod");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// =====================================================
// Schemas pour les opérations sur la collection "documents" (démo)
// =====================================================
const DocumentSchema = z.object({
  a: z.number()
});

// =====================================================
// Schemas pour Products & Categories avec agrégation
// =====================================================

// Schéma complet pour un produit stocké en base
const ProductSchema = z.object({
  _id: z.string(),       // Géré automatiquement par MongoDB si absent
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
  categoryIds: z.array(z.string())
});
// Schéma pour la création d'un produit : on omet "_id"
const CreateProductSchema = ProductSchema.omit({ _id: true });

// Schéma complet pour une catégorie stockée en base
const CategorySchema = z.object({
  _id: z.string(),       // Géré automatiquement par MongoDB
  name: z.string(),
});
// Schéma pour la création d'une catégorie : on omet "_id"
const CreateCategorySchema = CategorySchema.omit({ _id: true });

// =====================================================
// Connexion à MongoDB et configuration de l'application
// =====================================================
client.connect().then(async () => {
  db = client.db("myDB");

  // Collections utilisées dans l'application
  const documentsCollection = db.collection("documents");
  const productsCollection = db.collection("products");
  const categoriesCollection = db.collection("categories");

  // -----------------------------------------------------
  // Opérations CRUD classiques sur la collection "documents"
  // -----------------------------------------------------
  const insertResult = await documentsCollection.insertMany([{ a: 1 }, { a: 2 }, { a: 3 }]);
  console.log('Inserted documents =>', insertResult);

  const findResult = await documentsCollection.find({}).toArray();
  console.log('Found documents =>', findResult);

  const filteredDocs = await documentsCollection.find({ a: 3 }).toArray();
  console.log('Found documents filtered by { a: 3 } =>', filteredDocs);

  const updateResult = await documentsCollection.updateOne({ a: 3 }, { $set: { b: 1 } });
  console.log('Updated documents =>', updateResult);

  const deleteResult = await documentsCollection.deleteMany({ a: 3 });
  console.log('Deleted documents =>', deleteResult);

  const indexName = await documentsCollection.createIndex({ a: 1 });
  console.log('Index name =', indexName);
  // -----------------------------------------------------
  // Fin des opérations sur "documents"
  // -----------------------------------------------------

  // -----------------------------------------------------
  // Routes pour gérer les produits et les catégories
  // -----------------------------------------------------

  // Route pour créer une catégorie en utilisant safeParse
  app.post("/categories", async (req, res) => {
    const result = await CreateCategorySchema.safeParse(req.body);
 
    // Si la validation Zod réussit, insérer la catégorie dans la collection
    if (result.success) {
      const { name } = result.data;
      const ack = await db.collection("categories").insertOne({ name });
      res.send({ _id: ack.insertedId, name });
    } else {
      res.status(400).send(result);
    }
  });

  // Route pour créer un produit en utilisant safeParse
  // Le produit contient désormais un tableau d'identifiants de catégories
  app.post("/products", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);
    if (result.success) {
      const { name, about, price, categoryIds } = result.data;
      const ack = await db
        .collection("products")
        .insertOne({ name, about, price, categoryIds });
      res.send({ _id: ack.insertedId, name, about, price, categoryIds });
    } else {
      res.status(400).send(result);
    }
  });

  // Route d'agrégation pour joindre les produits et les catégories associées
  app.get("/products-with-categories", async (req, res) => {
    try {
      // L'agrégation via $lookup associe chaque produit aux catégories dont les IDs sont présents dans product.categoryIds
      const aggregatedProducts = await productsCollection.aggregate([
        {
          $lookup: {
            from: "categories",
            localField: "categoryIds",
            foreignField: "_id",
            as: "categories"
          }
        }
      ]).toArray();
      res.status(200).json(aggregatedProducts);
    } catch (error) {
      console.error("Erreur lors de l'agrégation :", error);
      res.status(500).json({ error: error.message });
    }
  });

  // -----------------------------------------------------
  // Lancement du serveur Express
  // -----------------------------------------------------
  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
}).catch(error => {
  console.error("Erreur de connexion à MongoDB :", error);
});
