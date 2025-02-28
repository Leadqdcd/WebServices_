const express = require("express");
const postgres = require("postgres");
const z = require("zod");

const bcrypt = require("bcrypt");
const saltRounds = 10; // Niveau de hachage

const app = express();
const port = 8000;
const sql = postgres({ db: "mydb", user: "user", password: "password", port: "5433" });

app.use(express.json());

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
        CreateProductSchema.parse({ name, about, price });
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

// POST /users - Créer un nouvel utilisateur
app.post("/users", async (req, res) => {
    try {
        const parsedUser = CreateUserSchema.parse(req.body);
        const { username, password, email } = parsedUser;

        // Hachage du mot de passe avant de l'enregistrer
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        await sql `INSERT INTO users(username, password, email) VALUES(${ username }, ${ hashedPassword }, ${ email })`;

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

        const users = await sql `SELECT * FROM users LIMIT ${ limit } OFFSET ${ offset }`;
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: "Erreur serveur", details: error.message });
    }
});


app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
});
