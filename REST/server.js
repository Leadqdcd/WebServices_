const express = require("express");
const postgres = require("postgres");
const z = require("zod");

const app = express();
const port = 8000;
const sql = postgres({ db: "mydb", user: "user", password: "password", port: "5433" });

app.use(express.json());

// Schemas
const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
});

app.get("/", (req, res) => {
    res.send("Hello World!");
  });

// GET products/:id - Récupère un produit par son ID
app.get("/products/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const product = await sql`SELECT * FROM products WHERE id = ${id}`;
    if (product.length === 0) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    res.json(product[0]);
  } catch (error) {
    res.status(500).json({ message: "Erreur du serveur", error });
  }
});

// GET products/ - Récupère tous les produits avec pagination
app.get("/products", async (req, res) => {
  const { page = 1, limit = 10 } = req.query; // Pagination
  const offset = (page - 1) * limit;

  try {
    const products = await sql`
      SELECT * FROM products 
      LIMIT ${limit} OFFSET ${offset}`;
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: "Erreur du serveur", error });
  }
});

// POST products/ - Crée un nouveau produit
app.post("/products", async (req, res) => {
  const { name, about, price } = req.body;

  // Validation du corps de la requête avec Zod
  try {
    ProductSchema.parse({ name, about, price });
  } catch (error) {
    return res.status(400).json({ message: "Données invalides", error: error.errors });
  }

  try {
    const result = await sql`
      INSERT INTO products (name, about, price)
      VALUES (${name}, ${about}, ${price})
      RETURNING *`;
    res.status(201).json(result[0]);
  } catch (error) {
    res.status(500).json({ message: "Erreur lors de la création du produit", error });
  }
});

// DELETE products/:id - Supprime un produit par son ID
app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await sql`DELETE FROM products WHERE id = ${id} RETURNING *`;
    if (result.length === 0) {
      return res.status(404).json({ message: "Produit non trouvé" });
    }
    res.status(200).json({ message: "Produit supprimé avec succès", product: result[0] });
  } catch (error) {
    res.status(500).json({ message: "Erreur du serveur", error });
  }
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
