const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { z } = require("zod");

const app = express();
const port = 8000;
const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// =====================================================================
// Schémas Zod pour valider les données des ressources Analytics
// =====================================================================

// Préprocesseur pour "createdAt" qui convertit la donnée en Date,
// ou utilise la date courante si la donnée n'est pas fournie.
const CreatedAtSchema = z.preprocess((arg) => {
  if (typeof arg === "string" || arg instanceof Date) {
    return new Date(arg);
  }
  return new Date();
}, z.date());

// Schéma pour la ressource /views
const ViewSchema = z.object({
  source: z.string(),
  url: z.string().url(),
  visitor: z.string(),
  createdAt: CreatedAtSchema,
  meta: z.record(z.any()) // Champs meta flexibles
});

// Schéma pour la ressource /actions
const ActionSchema = z.object({
  source: z.string(),
  url: z.string().url(),
  action: z.string(),
  visitor: z.string(),
  createdAt: CreatedAtSchema,
  meta: z.record(z.any())
});

// Schéma pour la ressource /goals
const GoalSchema = z.object({
  source: z.string(),
  url: z.string().url(),
  goal: z.string(),
  visitor: z.string(),
  createdAt: CreatedAtSchema,
  meta: z.record(z.any())
});

// =====================================================================
// Connexion à MongoDB et lancement de l'API Analytics
// =====================================================================
client.connect().then(async () => {
  db = client.db("analyticsDB");

  // Collections pour les différentes ressources
  const viewsCollection = db.collection("views");
  const actionsCollection = db.collection("actions");
  const goalsCollection = db.collection("goals");

  // -------------------------------------------------------------------
  // Ressource : /views
  // -------------------------------------------------------------------

  // POST /views - Création d'une view
  app.post("/views", async (req, res) => {
    const parsed = ViewSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error });
    }
    try {
      const data = parsed.data;
      const ack = await viewsCollection.insertOne(data);
      return res.status(201).json({ _id: ack.insertedId, ...data });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /views - Récupération de toutes les views
  app.get("/views", async (req, res) => {
    try {
      const allViews = await viewsCollection.find({}).toArray();
      return res.json(allViews);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // -------------------------------------------------------------------
  // Ressource : /actions
  // -------------------------------------------------------------------

  // POST /actions - Création d'une action
  app.post("/actions", async (req, res) => {
    const parsed = ActionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error });
    }
    try {
      const data = parsed.data;
      const ack = await actionsCollection.insertOne(data);
      return res.status(201).json({ _id: ack.insertedId, ...data });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /actions - Récupération de toutes les actions
  app.get("/actions", async (req, res) => {
    try {
      const allActions = await actionsCollection.find({}).toArray();
      return res.json(allActions);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // -------------------------------------------------------------------
  // Ressource : /goals
  // -------------------------------------------------------------------

  // POST /goals - Création d'un goal
  app.post("/goals", async (req, res) => {
    const parsed = GoalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error });
    }
    try {
      const data = parsed.data;
      const ack = await goalsCollection.insertOne(data);
      return res.status(201).json({ _id: ack.insertedId, ...data });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // GET /goals - Récupération de tous les goals
  app.get("/goals", async (req, res) => {
    try {
      const allGoals = await goalsCollection.find({}).toArray();
      return res.json(allGoals);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // -------------------------------------------------------------------
  // Nouvelle Route : GET /goals/:goalId/details
  // Permet de récupérer un Goal et d'agréger toutes les views et actions
  // associées au même visiteur que le goal
  // -------------------------------------------------------------------
  app.get("/goals/:goalId/details", async (req, res) => {
    const { goalId } = req.params;
    if (!ObjectId.isValid(goalId)) {
      return res.status(400).json({ error: "Identifiant de goal invalide" });
    }
    try {
      const results = await goalsCollection.aggregate([
        { $match: { _id: new ObjectId(goalId) } },
        {
          $lookup: {
            from: "views",
            localField: "visitor",
            foreignField: "visitor",
            as: "views"
          }
        },
        {
          $lookup: {
            from: "actions",
            localField: "visitor",
            foreignField: "visitor",
            as: "actions"
          }
        }
      ]).toArray();

      if (!results || results.length === 0) {
        return res.status(404).json({ error: "Goal non trouvé" });
      }
      return res.json(results[0]);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  });

  // -------------------------------------------------------------------
  // Lancement du serveur Express
  // -------------------------------------------------------------------
  app.listen(port, () => {
    console.log(`REST-ANALYTICS API listening on http://localhost:${port}`);
  });
}).catch((error) => {
  console.error("Erreur de connexion à MongoDB :", error);
});
