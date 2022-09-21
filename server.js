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
app.use(express.json());

app.use(cors());

const key = process.env.API_KEY;

mongoose.connect(process.env.MONGODB_URL);

const convertToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
};

const User = require("./models/User");
const Review = require("./models/Review");
const Favorite = require("./models/Favorite");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY_CLOUD,
  api_secret: process.env.API_SECRET,
});

// Homepage avec les jeux

app.get("/game", async (req, res) => {
  const page = req.query.page;
  const search = req.query.search;
  try {
    const url = `https://api.rawg.io/api/games?key=${key}&page=${page}&search=${search}`;
    const response = await axios.get(url);

    res.status(200).json(response.data.results);
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
          token: token,
          hash: hash,
          salt: salt,
        });

        const resultImage = await cloudinary.uploader.upload(
          convertToBase64(req.files.avatar),
          {
            folder: `api/gamepad/users/${newUser._id}`,
            public_id: "avatar",
          }
        );

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

    if (userToCheck) {
      if (
        SHA256(req.body.password + userToCheck.salt).toString(encBase64) ===
        userToCheck.hash
      ) {
        res.status(200).json({
          _id: userToCheck._id,
          token: userToCheck.token,
          username: userToCheck.username,
        });
      } else {
        res.status(401).json({ error: "Unauthorized" });
      }
    } else {
      res.status(400).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// creation d'une review

const isAuthenticated = async (req, res, next) => {
  console.log(req.headers.authorization);
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

app.post("/game/review/publish/:id", isAuthenticated, async (req, res) => {
  try {
    const id = req.params.id;
    if (id) {
      const review = new Review({
        title: req.body.title,
        description: req.body.description,
        gameId: id,
        user: req.user,
      });

      await review.save();

      res.json({
        title: review.title,
        description: review.description,
        user: review.user,
        gameId: review.id,
      });
      //   console.log(review);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route afficher les reviews

app.get("/review/:id", async (req, res) => {
  try {
    const reviews = await Review.find({
      gameId: req.params.id,
    }).populate({
      path: "user",
      select: "user.username",
    });

    res.status(200).json(reviews);
    console.log(reviews);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route ajouter un favoris

app.post("/games/favorite", isAuthenticated, async (req, res) => {
  try {
    const favoriteToCheck = await Favorite.findOne({ id: req.body.id });
    if (!favoriteToCheck) {
      const newFavorite = new Favorite({
        id: String(req.body.id),
        name: req.body.name,
        image: req.body.image,
        user: req.user,
      });
      await newFavorite.save();

      res.json({
        id: newFavorite.id,
        name: newFavorite.name,
        image: newFavorite.image,
        user: newFavorite.user,
      });
    } else {
      res.status(401).json({ message: "Already in favorites" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route afficher ses favoris

app.get("/collection", isAuthenticated, async (req, res) => {
  try {
    const newCollection = await Favorite.find({ user: req.user });
    res.status(200).json(newCollection);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Route profil

app.get("/profil", async (req, res) => {
  try {
    const userProfil = await User.findById(req.query.id);
    res.json({
      id: userProfil.id,
      username: userProfil.username,
      email: userProfil.email,
      token: userProfil.token,
    });
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
