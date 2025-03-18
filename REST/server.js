const express = require("express");
const { MongoClient } = require("mongodb");
const z = require("zod");
const fetch = require("node-fetch");

const bcrypt = require("bcrypt");
const saltRounds = 10; // Niveau de hachage

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

client.connect().then(() => {
    db = client.db("myDB");
    app.listen(port, () => {
        console.log(`Listening on http://localhost:${port}`);
    });
});

// Schemas Products
const ProductSchema = z.object({
    id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
});

const CreateProductSchema = ProductSchema.omit({ id: true });

//Schemas User
const UserSchema = z.object({
    id: z.string(),
    username: z.string(),
    password: z.string().min(6), // Sécurité minimale
    email: z.string().email()
});

const CreateUserSchema = UserSchema.omit({ id: true });

// Schemas Orders
const OrderSchema = z.object({
    userId: z.string(),
    productIds: z.array(z.string()),
    total: z.number().positive(),
    payment: z.boolean().default(false),
    createdAt: z.date().default(new Date()),
    updatedAt: z.date().default(new Date()),
});

const CreateOrderSchema = OrderSchema.omit({ createdAt: true, updatedAt: true });

// Fonction pour hasher le mot de passe
const hashPassword = (password) => {
    return crypto.createHash("sha512").update(password).digest("hex");
};

app.get("/", (req, res) => {
    res.send("Hello World!");
});

// GET products/:id - Récupère un produit par son ID
app.get("/products/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const product = await db.collection("products").findOne({ _id: new MongoClient.ObjectId(id) });
        if (!product) {
            return res.status(404).json({ message: "Produit non trouvé" });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Erreur du serveur", error });
    }
});

// GET products/ - Récupère tous les produits avec pagination et filtres
app.get("/products", async (req, res) => {
    try {
        const products = await db.collection("products").find().toArray();
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: "Erreur du serveur", error });
    }
});


// POST products/ - Crée un nouveau produit
app.post("/products", async (req, res) => {
    const result = CreateProductSchema.safeParse(req.body);

    // Vérification du succès de la validation
    if (!result.success) {
        return res.status(400).json({ message: "Données invalides", errors: result.error.errors });
    }

    const { name, about, price } = result.data;

    try {
        const product = await db.collection("products").insertOne({ name, about, price });

        res.status(201).json({ _id: product.insertedId, name, about, price });
        console.log("Produit créé avec succès");
    } catch (error) {
        console.error("Erreur lors de la création du produit :", error);
        res.status(500).json({ message: "Erreur serveur", error });
    }
});


// DELETE products/:id - Supprime un produit par son ID
app.delete("/products/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.collection("products").deleteOne({ _id: new MongoClient.ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Produit non trouvé" });
        }
        res.status(200).json({ message: "Produit supprimé avec succès" });
    } catch (error) {
        res.status(500).json({ message: "Erreur du serveur", error });
    }
});

// POST /users - Créer un nouvel utilisateur
app.post("/users", async (req, res) => {
    try {
        const parsedUser = CreateUserSchema.parse(req.body);
        const { username, password, email } = parsedUser;

        // Hachage du mot de passe avant de l'enregistrer
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await db.collection("users").insertOne({ username, password: hashedPassword, email });

        res.status(201).json({
            message: "Utilisateur créé avec succès",
            user: { username, email } // Ne jamais renvoyer le mot de passe
        });

    } catch (error) {
        console.error(error);
        res.status(400).json({ error: "Données invalides", details: error.message });
    }
});

app.get("/users", async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const users = await db.collection("users").find().skip(offset).limit(limit).toArray();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur", details: error.message });
    }
});

// Nouvelle route pour /f2p-games
app.get("/f2p-games", async (req, res) => {
    try {
        const response = await fetch("https://www.freetogame.com/api/games");
        const games = await response.json();
        res.json(games);
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la récupération des jeux Free-to-Play", error });
    }
});

app.get("/f2p-games/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const response = await fetch(`https://www.freetogame.com/api/game?id=${id}`);
        const game = await response.json();
        res.json(game);
    } catch (error) {
        res.status(500).json({ message: "Erreur lors de la récupération du jeu Free-to-Play", error });
    }
});

// POST /orders - Créer une nouvelle commande
app.post("/orders", async (req, res) => {
    try {
        const parsedOrder = CreateOrderSchema.parse(req.body);
        const { userId, productIds } = parsedOrder;

        const products = await db.collection("products").find({ _id: { $in: productIds.map(id => new MongoClient.ObjectId(id)) } }).toArray();
        const total = products.reduce((sum, product) => sum + product.price, 0) * 1.2;

        const result = await db.collection("orders").insertOne({ userId, productIds, total, payment: false, createdAt: new Date(), updatedAt: new Date() });
        res.status(201).json(result.ops[0]);
    } catch (error) {
        res.status(400).json({ message: "Données invalides", error: error.errors });
    }
});

// GET /orders - Récupère toutes les commandes
app.get("/orders", async (req, res) => {
    try {
        const orders = await db.collection("orders").find().toArray();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: "Erreur du serveur", error });
    }
});

// GET /orders/:id - Récupère une commande par son ID
app.get("/orders/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const order = await db.collection("orders").findOne({ _id: new MongoClient.ObjectId(id) });
        if (!order) {
            return res.status(404).json({ message: "Commande non trouvée" });
        }
        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Erreur du serveur", error });
    }
});

// PUT /orders/:id - Met à jour une commande par son ID
app.put("/orders/:id", async (req, res) => {
    const { id } = req.params;
    const { userId, productIds, payment } = req.body;

    try {
        const products = await db.collection("products").find({ _id: { $in: productIds.map(id => new MongoClient.ObjectId(id)) } }).toArray();
        const total = products.reduce((sum, product) => sum + product.price, 0) * 1.2;

        const result = await db.collection("orders").updateOne(
            { _id: new MongoClient.ObjectId(id) },
            { $set: { userId, productIds, total, payment, updatedAt: new Date() } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "Commande non trouvée" });
        }
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: "Données invalides", error: error.errors });
    }
});

// DELETE /orders/:id - Supprime une commande par son ID
app.delete("/orders/:id", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await db.collection("orders").deleteOne({ _id: new MongoClient.ObjectId(id) });
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: "Commande non trouvée" });
        }
        res.status(200).json({ message: "Commande supprimée avec succès" });
    } catch (error) {
        res.status(500).json({ message: "Erreur du serveur", error });
    }
});
