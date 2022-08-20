const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mongoose = require("mongoose");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const uid2 = require("uid2");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

const app = express();
app.use(cors());

const key = process.env.API_KEY;

mongoose.connect(process.env.MONGODB_URL);

const convertToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
};

app.use(express.json());

const User = require("./models/User");
const Review = require("./models/Review");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY_CLOUD,
  api_secret: process.env.API_SECRET,
});

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

app.post("/signup", fileUpload(), async (req, res) => {
  try {
    if (req.body.username === undefined) {
      res.status(400).json({ message: "Missing parameter" });
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
          avatar: req.body.avatar,
          token: token,
          hash: hash,
          salt: salt,
        });

        const resultImage = await cloudinary.uploader.upload({
          folder: `api/gamepad/users/${newUser._id}`,
          public_id: "avatar",
        });

        newUser.avatar = resultImage;
        await newUser.save();

        res.json({
          _id: newUser._id,
          email: newUser.email,
          avatar: newUser.avatar,
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
          username: userToCheck.username,
        });
      } else {
        res.status(400).json({ message: "Unauthorized" });
      }
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// creation d'une review

const isAuthenticated = async (req, res, next) => {
  console.log(req.headers);
  if (req.headers.authorization) {
    const user = await User.findOne({
      token: req.headers.authorization.replace("Bearer ", ""),
    });

    if (user) {
      req.user = user;
      next();
    } else {
      res.status(401).json({ error: "Token présent mais non valide !" });
    }
  } else {
    res.status(401).json({ error: "Token non envoyé !" });
  }
};

app.post("/review/publish", isAuthenticated, async (req, res) => {
  try {
    const review = new Review({
      title: req.body.title,
      description: req.body.description,
      user: req.user,
    });

    await review.save();

    res.json({
      _id: review._id,
      title: review.title,
      description: review.description,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route afficher les reviews

app.get("/review", async (req, res) => {
  try {
    const reviews = await Review.find();
    res.status(200).json(reviews);
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
