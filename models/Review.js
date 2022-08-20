const mongoose = require("mongoose");

//création du model Review
const Review = mongoose.model("Review", {
  title: String,
  description: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

module.exports = Review;
