const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");
require("dotenv").config();

const app = express();
app.use(cors());

mongoose.connect(process.env.MONGODB_URL);

app.use(express.json());

const key = process.env.API_KEY;

// Homepage avec tous les jeux

app.get("/game", async (req, res) => {
  try {
    const url = `https://api.rawg.io/api/games?key=${key}&dates=2022-01-01,2022-12-30`;
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    res.status(400).json("route games not found");
  }
});

// Route detail d'un jeu

app.get("/game/:id", async (req, res) => {
  try {
    const url = `https://api.rawg.io/api/games/${req.params.id}?key=${key}`;
    const response = await axios.get(url);
    res.status(200).json(response.data);
    console.log(response.data);
  } catch (error) {
    res.status(400).json("route of the game not found");
  }
});

// Route jeux de la même série
app.get("/samegames/:id", async (req, res) => {
  try {
    const url = `https://api.rawg.io/api/games/${req.params.id}/game-series?key=${key}`;
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    res.status(400).json("route of same games not found");
  }
});

// Création d'un user

app.post("/signup", async (req, res) => {
  try {
    if (req.body.username === undefined) {
      res.status(400).json({ message: "Missing parameters" });
    } else {
      const isEmailAlreadyinDB = await User.findOne({ email: req.body.email });
      if (isEmailAlreadyinDB !== null) {
        res.json({ message: "This email already has an account" });
      } else {
        const salt = uid2(16);
        const hash = SHA256(req.body.password + salt).toString(encBase64);
        const token = uid2(32);

        const newUser = new User({
          email: req.body.email,
          username: req.body.username,
          // avatar: req.body.avatar,
          token: token,
          hash: hash,
          salt: salt,
        });
        await newUser.save();
        res.json({
          _id: newUser._id,
          email: newUser.email,
          token: newUser.token,
          account: newUser.account,
        });
      }
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Login d'un User
app.post("/login", async (req, res) => {
  try {
    const userToCheck = await User.findOne({ email: req.body.email });
    if (userToCheck === null) {
      res.status(401).json({ message: "Unauthorized" });
    } else {
      const newHash = SHA256(req.body.password + userToCheck.salt).toString(
        encBase64
      );
      if (newHash === userToCheck.hash) {
        res.json({
          _id: userToCheck._id,
          token: userToCheck.token,
          account: userToCheck.account,
        });
      } else {
        res.status(400).json({ message: "Unauthorized" });
      }
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.all("*", (req, res) => {
  res.status(404).json({ message: "route not found !" });
});

app.listen(process.env.PORT, () => {
  console.log("Server has started");
});
