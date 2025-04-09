const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { z } = require("zod");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// =====================================================
// Schemas pour la collection "documents" (démo)
// =====================================================
const DocumentSchema = z.object({
  a: z.number()
});

// =====================================================
// Schemas pour Products & Categories avec agrégation
// =====================================================

// Schéma complet pour un produit stocké en base
const ProductSchema = z.object({
  _id: z.string(),       // Généré automatiquement par MongoDB
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
  categoryIds: z.array(z.string())
});
// Schéma pour la création d'un produit : on omet "_id"
const CreateProductSchema = ProductSchema.omit({ _id: true });
// Pour la mise à jour, on accepte des champs optionnels
const UpdateProductSchema = CreateProductSchema.partial();

// Schéma complet pour une catégorie stockée en base
const CategorySchema = z.object({
  _id: z.string(),       // Généré automatiquement par MongoDB
  name: z.string(),
});
// Schéma pour la création d'une catégorie : on omet "_id"
const CreateCategorySchema = CategorySchema.omit({ _id: true });

client.connect().then(async () => {
  db = client.db("myDB");

  // Collections utilisées dans l'application
  const documentsCollection = db.collection("documents");
  const productsCollection = db.collection("products");
  const categoriesCollection = db.collection("categories");

  // -----------------------------------------------------
  // Opérations CRUD classiques sur la collection "documents" (démo)
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
  // Routes pour gérer les catégories et les produits
  // -----------------------------------------------------

  // --- Route pour créer une catégorie avec safeParse ---
  app.post("/categories", async (req, res) => {
    const result = await CreateCategorySchema.safeParse(req.body);
    if (result.success) {
      const { name } = result.data;
      const ack = await db.collection("categories").insertOne({ name });
      res.status(201).send({ _id: ack.insertedId, name });
    } else {
      res.status(400).send(result);
    }
  });

  // --- Route pour créer un produit avec safeParse et conversion des categoryIds en ObjectId ---
  app.post("/products", async (req, res) => {
    const result = await CreateProductSchema.safeParse(req.body);
    if (result.success) {
      const { name, about, price, categoryIds } = result.data;
      const categoryObjectIds = categoryIds.map((id) => new ObjectId(id));
 
      const ack = await db
        .collection("products")
        .insertOne({ name, about, price, categoryIds: categoryObjectIds });
 
      res.status(201).send({
        _id: ack.insertedId,
        name,
        about,
        price,
        categoryIds: categoryObjectIds,
      });
    } else {
      res.status(400).send(result);
    }
  });

  // --- Route GET pour récupérer la liste des produits avec leurs catégories (agrégation) ---
  app.get("/products", async (req, res) => {
    const result = await db
      .collection("products")
      .aggregate([
        { $match: {} },
        {
          $lookup: {
            from: "categories",
            localField: "categoryIds",
            foreignField: "_id",
            as: "categories",
          },
        },
      ])
      .toArray();
    res.send(result);
  });

  // --- Route GET pour récupérer un produit par son ID avec agrégation ---
  app.get("/products/:id", async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Identifiant produit invalide" });
    }
    const result = await db.collection("products").aggregate([
      { $match: { _id: new ObjectId(id) } },
      {
        $lookup: {
          from: "categories",
          localField: "categoryIds",
          foreignField: "_id",
          as: "categories",
        },
      },
    ]).toArray();
    if (result.length === 0) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }
    res.json(result[0]);
  });

  // --- Route PUT pour mettre à jour un produit ---
  app.put("/products/:id", async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Identifiant produit invalide" });
    }
    const result = await UpdateProductSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).send(result.error);
    }
    const updateData = { ...result.data };
    if (updateData.categoryIds) {
      updateData.categoryIds = updateData.categoryIds.map((cid) => new ObjectId(cid));
    }
    const updateResult = await db.collection("products").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }
    const updatedProduct = await db.collection("products").findOne({ _id: new ObjectId(id) });
    res.json(updatedProduct);
  });

  // --- Route DELETE pour supprimer un produit ---
  app.delete("/products/:id", async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Identifiant produit invalide" });
    }
    const deleteResult = await db.collection("products").deleteOne({ _id: new ObjectId(id) });
    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ error: "Produit non trouvé" });
    }
    res.status(204).send(); // Pas de contenu à renvoyer
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
