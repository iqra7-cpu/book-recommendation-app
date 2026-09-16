const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },

    author: {
        type: String,
        required: true
    },

    category: {
        type: String,
        required: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false,
        default: undefined
    },

    rating: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model("Book", bookSchema);