const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(cors());

app.use(express.json());

const key = process.env.API_KEY;

// Homepage avec tous les jeux

app.get("/home", async (req, res) => {
  try {
    const url = `https://api.rawg.io/api/games?key=${key}&dates=2021-01-01,2022-12-30`;
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    res.status(400).json("route games not found");
  }
});

// Route detail d'un jeu

app.get("/games/:id", async (req, res) => {
  try {
    const url = `https://api.rawg.io/api/games/${id}?key=${key}`;
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    res.status(400).json("route of the game not found");
  }
});

app.all("*", (req, res) => {
  res.status(404).json({ message: "route not found !" });
});

app.listen(process.env.PORT, () => {
  console.log("Server has started");
});
